"""DB-backed store exposing the same method shape as FixtureStore so the
/api routes can switch by changing one FastAPI dependency.

Reads come straight from SQLAlchemy. Reads that the backend schema
cannot answer today (evaluation criteria, enriched document category /
size / page-count) are synthesised from the bidder row using the same
pure helpers that the fixture store used, so /api consumers keep the
same shape they've always had.
"""

from __future__ import annotations

import uuid
from datetime import date, datetime
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import async_session
from app.fixtures.criteria import build_criteria
from app.fixtures.documents import build_documents
from app.models import Attachment, Bid, BidAttachment, Tender


class DbStore:
    """Thin repository over the SQLAlchemy session. One instance per
    request — FastAPI's Depends() creates a new one per call via
    `get_db_store`."""

    def __init__(self, session: AsyncSession) -> None:
        self._s = session

    # ── Tender reads ──────────────────────────────────────────────────

    async def list_tenders(self) -> list[dict[str, Any]]:
        rows = (
            await self._s.execute(select(Tender).order_by(Tender.created_at.desc()))
        ).scalars().all()
        return [self._tender_to_dict(t) for t in rows]

    async def get_tender(self, tender_id: str | uuid.UUID) -> dict[str, Any] | None:
        row = await self._s.get(Tender, _as_uuid(tender_id))
        return self._tender_to_dict(row) if row else None

    # ── Bidder reads ──────────────────────────────────────────────────

    async def list_bidders(self, tender_id: str | uuid.UUID) -> list[dict[str, Any]]:
        tid = _as_uuid(tender_id)
        rows = (
            await self._s.execute(
                select(Bid)
                .where(Bid.tender_id == tid)
                .order_by(Bid.rank, Bid.created_at)
            )
        ).scalars().all()
        return [self._bid_to_dict(b) for b in rows]

    async def get_bidder(
        self, tender_id: str | uuid.UUID, bidder_id: str | uuid.UUID
    ) -> dict[str, Any] | None:
        tid = _as_uuid(tender_id)
        bid = _as_uuid(bidder_id)
        if tid is None or bid is None:
            return None
        row = await self._s.get(Bid, bid)
        if row is None or row.tender_id != tid:
            return None
        return self._bid_to_dict(row)

    # ── Derived reads ─────────────────────────────────────────────────

    async def get_evaluation(
        self, tender_id: str | uuid.UUID, bidder_id: str | uuid.UUID
    ) -> dict[str, Any] | None:
        summary = await self.get_bidder(tender_id, bidder_id)
        if summary is None:
            return None
        return {**summary, "criteria": build_criteria(summary)}

    async def list_documents(
        self, tender_id: str | uuid.UUID, bidder_id: str | uuid.UUID
    ) -> list[dict[str, Any]] | None:
        """Today: derive documents from the bidder summary (keeps the
        demo rich). When real attachments are present on the bid, layer
        them over the top — a real file wins over a synthesised one if
        the file_name matches."""
        summary = await self.get_bidder(tender_id, bidder_id)
        if summary is None:
            return None
        synthetic = build_documents(summary)
        bid_uuid = _as_uuid(bidder_id)
        tender_uuid = _as_uuid(tender_id)

        real_rows = (
            await self._s.execute(
                select(BidAttachment, Attachment)
                .join(Attachment, BidAttachment.attachment_ref_id == Attachment.attachment_ref_id)
                .where(BidAttachment.bid_id == bid_uuid)
            )
        ).all()

        for idx, (ba, att) in enumerate(real_rows):
            entry = {
                "id": f"{bid_uuid}-REAL-{idx + 1}",
                "tender_id": str(tender_uuid) if tender_uuid else None,
                "bidder_id": str(bid_uuid) if bid_uuid else None,
                "file_name": att.file_name,
                "mime_type": att.content_type,
                "size_bytes": len(att.data) if att.data is not None else 0,
                "uploaded_on": (att.created_at.date().isoformat()
                                if att.created_at else date.today().isoformat()),
                "page_count": ba.page_count,
                "category": ba.category or "Other",
                "description": ba.description,
            }
            # Replace a synthetic entry with the real one if file_name matches.
            replaced = False
            for i, s in enumerate(synthetic):
                if s["file_name"].lower() == att.file_name.lower():
                    synthetic[i] = entry
                    replaced = True
                    break
            if not replaced:
                synthetic.append(entry)

        return synthetic

    # ── Writes ────────────────────────────────────────────────────────

    async def add_tender(self, payload: dict[str, Any]) -> dict[str, Any]:
        today = date.today()
        # Per-call unique reference — clerks can edit later. This is only
        # used if the caller didn't supply one.
        default_ref = f"ITE/{today.year}/NEW-{datetime.utcnow():%H%M%S}-{uuid.uuid4().hex[:4]}"

        tender = Tender(
            # tender_id auto-generated by DB default
            tender_name=payload["name"],
            reference=payload.get("reference") or default_ref,
            authority=payload.get("authority") or "—",
            description=payload.get("description") or "",
            status="Pending Review",
            estimated_value=payload.get("estimated_value") or "—",
            closing_date=today,
            uploaded_date=today,
            bidders_count=0,
            document_name=payload.get("document_name") or "",
            document_size=payload.get("document_size") or "—",
            tender_ref=None,
        )
        self._s.add(tender)
        await self._s.commit()
        await self._s.refresh(tender)
        return self._tender_to_dict(tender)

    async def add_bidder(
        self, tender_id: str | uuid.UUID, payload: dict[str, Any]
    ) -> dict[str, Any] | None:
        tid = _as_uuid(tender_id)
        if tid is None:
            return None
        tender = await self._s.get(Tender, tid)
        if tender is None:
            return None

        rank = ((await self._s.execute(
            select(func.count()).select_from(Bid).where(Bid.tender_id == tid)
        )).scalar_one() or 0) + 1

        total_size_bytes = payload.get("total_size_bytes") or 0
        bid = Bid(
            # bid_id auto-generated by DB default
            tender_id=tid,
            bidder_name=payload["bidder_name"],
            registration_no=f"CIN-PENDING-{rank}",
            submitted_on=date.today(),
            documents_count=payload.get("file_count") or 0,
            total_size=self._human_size(total_size_bytes),
            confidence_score=70,
            rank=rank,
            overall_status="Under Review",
            technical_score=0,
            financial_score=0,
            compliance_score=0,
            bid_amount="—",
        )
        self._s.add(bid)

        tender.bidders_count = rank
        if tender.status == "Pending Review":
            tender.status = "Technical Evaluation"

        await self._s.commit()
        await self._s.refresh(bid)
        return self._bid_to_dict(bid)

    # ── Mapping helpers ──────────────────────────────────────────────

    @staticmethod
    def _tender_to_dict(t: Tender) -> dict[str, Any]:
        # UUID-typed columns are serialised to strings here so downstream
        # helpers (criterion/document synthesis) can concatenate them
        # freely. Pydantic re-parses into UUID on the response boundary.
        return {
            "id": str(t.tender_id),
            "reference": t.reference,
            "name": t.tender_name,
            "authority": t.authority,
            "uploaded_date": t.uploaded_date.isoformat() if t.uploaded_date else "",
            "closing_date": t.closing_date.isoformat() if t.closing_date else "",
            "status": t.status,
            "bidders_count": t.bidders_count,
            "document_name": t.document_name,
            "document_size": t.document_size,
            "estimated_value": t.estimated_value,
            "description": t.description,
        }

    @staticmethod
    def _bid_to_dict(b: Bid) -> dict[str, Any]:
        return {
            "id": str(b.bid_id),
            "tender_id": str(b.tender_id),
            "name": b.bidder_name,
            "registration_no": b.registration_no,
            "submitted_on": b.submitted_on.isoformat() if b.submitted_on else "",
            "documents_count": b.documents_count,
            "total_size": b.total_size,
            "confidence_score": b.confidence_score,
            "rank": b.rank,
            "overall_status": b.overall_status,
            "technical_score": b.technical_score,
            "financial_score": b.financial_score,
            "compliance_score": b.compliance_score,
            "bid_amount": b.bid_amount,
        }

    @staticmethod
    def _human_size(n: int) -> str:
        if n <= 0:
            return "—"
        if n < 1024 * 1024:
            return f"{n / 1024:.1f} KB"
        if n < 1024 * 1024 * 1024:
            return f"{n / (1024 * 1024):.1f} MB"
        return f"{n / (1024 * 1024 * 1024):.2f} GB"


def _as_uuid(value: str | uuid.UUID | None) -> uuid.UUID | None:
    """Coerce a UUID or UUID-string to UUID; return None if it can't be parsed."""
    if value is None:
        return None
    if isinstance(value, uuid.UUID):
        return value
    try:
        return uuid.UUID(str(value))
    except (ValueError, TypeError):
        return None


# FastAPI dependency — one session per request, auto-closed at end.
async def get_db_store() -> Any:
    async with async_session() as session:
        yield DbStore(session)

"""In-memory state + mutation rules for the /api/* fixture routes.

This is the single writable surface. Read-only data (criteria/documents)
is derived on demand from the mutable state held here. Replace this with
an SQLAlchemy-backed equivalent to move off fixtures — the method
signatures are the contract the routes depend on.
"""

import copy
from datetime import date
from typing import Any

from .bidders import BIDDERS_BY_TENDER
from .criteria import build_criteria
from .documents import build_documents
from .tenders import TENDERS


class FixtureStore:
    def __init__(self) -> None:
        # Deep-copy so mutations never bleed back into the module-level
        # defaults — useful if someone imports TENDERS directly elsewhere.
        self._tenders: list[dict[str, Any]] = [copy.deepcopy(t) for t in TENDERS]
        self._bidders_by_tender: dict[str, list[dict[str, Any]]] = {
            k: [copy.deepcopy(b) for b in v] for k, v in BIDDERS_BY_TENDER.items()
        }

    # ── Tender reads ──────────────────────────────────────────────────

    def list_tenders(self) -> list[dict[str, Any]]:
        return list(self._tenders)

    def get_tender(self, tender_id: str) -> dict[str, Any] | None:
        return next((t for t in self._tenders if t["id"] == tender_id), None)

    # ── Bidder reads ──────────────────────────────────────────────────

    def list_bidders(self, tender_id: str) -> list[dict[str, Any]]:
        rows = self._bidders_by_tender.get(tender_id, [])
        return sorted(rows, key=lambda b: b["rank"])

    def get_bidder(
        self, tender_id: str, bidder_id: str
    ) -> dict[str, Any] | None:
        return next(
            (
                b
                for b in self._bidders_by_tender.get(tender_id, [])
                if b["id"] == bidder_id
            ),
            None,
        )

    # ── Derived reads (criteria, documents) ──────────────────────────

    def get_evaluation(
        self, tender_id: str, bidder_id: str
    ) -> dict[str, Any] | None:
        summary = self.get_bidder(tender_id, bidder_id)
        if not summary:
            return None
        return {**summary, "criteria": build_criteria(summary)}

    def list_documents(
        self, tender_id: str, bidder_id: str
    ) -> list[dict[str, Any]] | None:
        summary = self.get_bidder(tender_id, bidder_id)
        if not summary:
            return None
        return build_documents(summary)

    # ── Writes ────────────────────────────────────────────────────────

    def add_bidder(
        self, tender_id: str, payload: dict[str, Any]
    ) -> dict[str, Any] | None:
        """Appends a bidder and applies the Pending Review → Technical
        Evaluation transition rule when the first bidder lands."""
        tender = self.get_tender(tender_id)
        if tender is None:
            return None

        existing = self._bidders_by_tender.setdefault(tender_id, [])
        rank = len(existing) + 1

        total_size_bytes = payload.get("total_size_bytes") or 0
        size_str = self._human_size(total_size_bytes)

        summary: dict[str, Any] = {
            "id": f"{tender_id}-BID-{rank}",
            "tender_id": tender_id,
            "name": payload["bidder_name"],
            "registration_no": f"CIN-PENDING-{rank}",
            "confidence_score": 70,
            "rank": rank,
            "overall_status": "Under Review",
            "technical_score": 0,
            "financial_score": 0,
            "compliance_score": 0,
            "bid_amount": "—",
            "submitted_on": date.today().isoformat(),
            "documents_count": payload.get("file_count") or 0,
            "total_size": size_str,
        }
        existing.append(summary)
        tender["bidders_count"] = len(existing)
        if tender["status"] == "Pending Review":
            tender["status"] = "Technical Evaluation"
        return summary

    # ── Helpers ──────────────────────────────────────────────────────

    @staticmethod
    def _human_size(b: int) -> str:
        if b <= 0:
            return "—"
        if b < 1024 * 1024:
            return f"{b / 1024:.1f} KB"
        if b < 1024 * 1024 * 1024:
            return f"{b / (1024 * 1024):.1f} MB"
        return f"{b / (1024 * 1024 * 1024):.2f} GB"


# Process-wide singleton. The real persistence layer replaces this with
# a SQLAlchemy session dependency.
_store = FixtureStore()


def get_store() -> FixtureStore:
    return _store

"""Idempotent DB seeder — populates tenders + bids from the fixture
modules on first boot. Safe to run on every startup: if the tenders
table already has rows, it's a no-op.

Fixture data uses friendly string IDs like `TEND-2026-041` / `BID-041-01`.
Those live in the `reference` column; DB-minted UUIDs become the actual
primary keys. The fixture-to-UUID mapping is built on the fly so the
bidder rows can wire their foreign keys correctly.
"""

import logging
from datetime import date

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import async_session
from app.fixtures.bidders import BIDDERS_BY_TENDER
from app.fixtures.tenders import TENDERS
from app.models import Bid, Tender

logger = logging.getLogger("ite.seed")


async def seed_if_empty() -> None:
    async with async_session() as s:  # type: AsyncSession
        existing = (await s.execute(select(func.count()).select_from(Tender))).scalar_one()
        if existing and existing > 0:
            logger.info("Seed skipped — %d tender row(s) already present", existing)
            return

        # Insert tenders and remember the fixture-id → new UUID mapping.
        fixture_to_uuid: dict[str, object] = {}
        for t in TENDERS:
            tender = Tender(
                # tender_id will be DB-generated
                tender_name=t["name"],
                reference=t["reference"],
                authority=t["authority"],
                description=t["description"],
                status=t["status"],
                estimated_value=t["estimated_value"],
                closing_date=date.fromisoformat(t["closing_date"]),
                uploaded_date=date.fromisoformat(t["uploaded_date"]),
                bidders_count=t["bidders_count"],
                document_name=t["document_name"],
                document_size=t["document_size"],
            )
            s.add(tender)
            await s.flush()
            fixture_to_uuid[t["id"]] = tender.tender_id

        # Insert bidders against the new tender UUIDs.
        for fixture_tender_id, bidders in BIDDERS_BY_TENDER.items():
            new_tender_uuid = fixture_to_uuid.get(fixture_tender_id)
            if new_tender_uuid is None:
                continue
            for b in bidders:
                s.add(
                    Bid(
                        # bid_id DB-generated
                        tender_id=new_tender_uuid,
                        bidder_name=b["name"],
                        registration_no=b["registration_no"],
                        submitted_on=date.fromisoformat(b["submitted_on"]),
                        documents_count=b["documents_count"],
                        total_size=b["total_size"],
                        confidence_score=b["confidence_score"],
                        rank=b["rank"],
                        overall_status=b["overall_status"],
                        technical_score=b["technical_score"],
                        financial_score=b["financial_score"],
                        compliance_score=b["compliance_score"],
                        bid_amount=b["bid_amount"],
                    )
                )

        await s.commit()
        logger.info(
            "Seeded %d tenders and %d bids",
            len(TENDERS),
            sum(len(v) for v in BIDDERS_BY_TENDER.values()),
        )

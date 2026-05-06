import logging
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import Bid, Tender
from app.schemas import ProcessTenderRequest, ProcessTenderResponse
from app.services.criteria_service import extract_criteria

logger = logging.getLogger("ite.process_tender")

router = APIRouter(prefix="/process-tender", tags=["process-tender"])

# TODO: Replace mock text loader with actual OCR / TextLayout extraction
#       from the tender's uploaded attachment once the OCR service is available.
MOCK_TENDER_TEXT_PATH = Path(__file__).resolve().parent.parent / "mock" / "data" / "tender1" / "tender1.txt"


def _load_mock_tender_pages() -> list[str]:
    """Load mock tender text as a single-page list.
    Replace this with real OCR / TextLayout extraction later.
    """
    text = MOCK_TENDER_TEXT_PATH.read_text(encoding="utf-8")
    return [text]


@router.post("/", response_model=ProcessTenderResponse)
async def process_tender(
    payload: ProcessTenderRequest,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Tender).where(Tender.tender_id == payload.tender_id))
    tender = result.scalar_one_or_none()
    if not tender:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tender not found")

    for bid_id in payload.bidder_ids:
        bid_result = await db.execute(
            select(Bid).where(Bid.bid_id == bid_id, Bid.tender_id == payload.tender_id)
        )
        if not bid_result.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Bid {bid_id} not found for tender {payload.tender_id}",
            )

    # TODO: Replace with actual OCR / TextLayout extraction from tender attachment
    pages = _load_mock_tender_pages()

    criteria = await extract_criteria(pages)

    return ProcessTenderResponse(
        tender_id=tender.tender_id,
        tender_name=tender.tender_name,
        criteria=criteria,
        bidder_ids=payload.bidder_ids,
    )

"""Frontend-facing routes under /api. camelCase JSON, DB-backed via DbStore."""

from fastapi import APIRouter, Depends, HTTPException, status

from app.api_models import (
    AddBidderPayload,
    AddTenderPayload,
    BidderDocument,
    BidderEvaluation,
    BidderSummary,
    ProcessedTender,
)
from app.db_store import DbStore, get_db_store

router = APIRouter(prefix="/api", tags=["frontend-api"])


# ── Tenders ────────────────────────────────────────────────────────────


@router.get("/tenders", response_model=list[ProcessedTender])
async def list_tenders(store: DbStore = Depends(get_db_store)):
    return await store.list_tenders()


@router.get("/tenders/{tender_id}", response_model=ProcessedTender)
async def get_tender(tender_id: str, store: DbStore = Depends(get_db_store)):
    tender = await store.get_tender(tender_id)
    if tender is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tender not found")
    return tender


@router.post(
    "/tenders",
    response_model=ProcessedTender,
    status_code=status.HTTP_201_CREATED,
)
async def create_tender(
    payload: AddTenderPayload,
    store: DbStore = Depends(get_db_store),
):
    return await store.add_tender(payload.model_dump(by_alias=False))


# ── Bidders ────────────────────────────────────────────────────────────


@router.get(
    "/tenders/{tender_id}/bidders",
    response_model=list[BidderSummary],
)
async def list_bidders(tender_id: str, store: DbStore = Depends(get_db_store)):
    if (await store.get_tender(tender_id)) is None:
        return []
    return await store.list_bidders(tender_id)


@router.get(
    "/tenders/{tender_id}/bidders/{bidder_id}/evaluation",
    response_model=BidderEvaluation,
)
async def get_bidder_evaluation(
    tender_id: str,
    bidder_id: str,
    store: DbStore = Depends(get_db_store),
):
    ev = await store.get_evaluation(tender_id, bidder_id)
    if ev is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Bidder not found"
        )
    return ev


@router.get(
    "/tenders/{tender_id}/bidders/{bidder_id}/documents",
    response_model=list[BidderDocument],
)
async def list_bidder_documents(
    tender_id: str,
    bidder_id: str,
    store: DbStore = Depends(get_db_store),
):
    docs = await store.list_documents(tender_id, bidder_id)
    if docs is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Bidder not found"
        )
    return docs


@router.post(
    "/tenders/{tender_id}/bidders",
    response_model=BidderSummary,
    status_code=status.HTTP_201_CREATED,
)
async def add_bidder(
    tender_id: str,
    payload: AddBidderPayload,
    store: DbStore = Depends(get_db_store),
):
    result = await store.add_bidder(tender_id, payload.model_dump(by_alias=False))
    if result is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Tender not found"
        )
    return result

"""Frontend-facing routes under /api. camelCase JSON, fixture-backed."""

from fastapi import APIRouter, Depends, HTTPException, status

from app.api_models import (
    AddBidderPayload,
    BidderDocument,
    BidderEvaluation,
    BidderSummary,
    ProcessedTender,
)
from app.fixtures.store import FixtureStore, get_store

router = APIRouter(prefix="/api", tags=["frontend-api"])


# ── Tenders ────────────────────────────────────────────────────────────


@router.get("/tenders", response_model=list[ProcessedTender])
def list_tenders(store: FixtureStore = Depends(get_store)):
    return store.list_tenders()


@router.get("/tenders/{tender_id}", response_model=ProcessedTender)
def get_tender(tender_id: str, store: FixtureStore = Depends(get_store)):
    tender = store.get_tender(tender_id)
    if tender is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tender not found")
    return tender


# ── Bidders ────────────────────────────────────────────────────────────


@router.get(
    "/tenders/{tender_id}/bidders",
    response_model=list[BidderSummary],
)
def list_bidders(tender_id: str, store: FixtureStore = Depends(get_store)):
    # A missing tender returns an empty list rather than 404 — the frontend
    # already handles the "zero bidders" empty state.
    if store.get_tender(tender_id) is None:
        return []
    return store.list_bidders(tender_id)


@router.get(
    "/tenders/{tender_id}/bidders/{bidder_id}/evaluation",
    response_model=BidderEvaluation,
)
def get_bidder_evaluation(
    tender_id: str,
    bidder_id: str,
    store: FixtureStore = Depends(get_store),
):
    ev = store.get_evaluation(tender_id, bidder_id)
    if ev is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Bidder not found"
        )
    return ev


@router.get(
    "/tenders/{tender_id}/bidders/{bidder_id}/documents",
    response_model=list[BidderDocument],
)
def list_bidder_documents(
    tender_id: str,
    bidder_id: str,
    store: FixtureStore = Depends(get_store),
):
    docs = store.list_documents(tender_id, bidder_id)
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
def add_bidder(
    tender_id: str,
    payload: AddBidderPayload,
    store: FixtureStore = Depends(get_store),
):
    result = store.add_bidder(tender_id, payload.model_dump(by_alias=False))
    if result is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Tender not found"
        )
    return result

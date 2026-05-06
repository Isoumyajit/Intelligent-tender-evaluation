"""Pydantic schemas for the /tenders and /tenders/{id}/bid endpoints.
Snake_case on the wire — the frontend adapts to this shape directly."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


# ── Attachment schemas ───────────────────────────────────────────────


class AttachmentResponse(BaseModel):
    attachment_ref_id: UUID
    file_name: str
    content_type: str
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Tender schemas (legacy upload path) ──────────────────────────────


class TenderUpdate(BaseModel):
    tender_name: str | None = None


class TenderResponse(BaseModel):
    tender_id: UUID
    tender_name: str
    tender_ref: UUID | None = None
    created_at: datetime
    updated_at: datetime
    attachment: AttachmentResponse | None = None

    model_config = {"from_attributes": True}


class TenderListResponse(BaseModel):
    tender_id: UUID
    tender_name: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ── Bid schemas ──

class BidUpdate(BaseModel):
    bidder_name: str | None = None


class BidResponse(BaseModel):
    bid_id: UUID
    tender_id: UUID
    bidder_name: str
    created_at: datetime
    updated_at: datetime
    attachments: list[AttachmentResponse]

    model_config = {"from_attributes": True}


class BidListResponse(BaseModel):
    bid_id: UUID
    tender_id: UUID
    bidder_name: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ── Criteria schemas ──

class EvaluationCondition(BaseModel):
    name: str
    predicate: str


class CriteriaGroup(BaseModel):
    criteria: str
    evaluation_conditions: list[EvaluationCondition]


# ── Process Tender schemas ──

class ProcessTenderRequest(BaseModel):
    tender_id: UUID
    bidder_ids: list[UUID]


class ProcessTenderResponse(BaseModel):
    tender_id: UUID
    tender_name: str
    criteria: list[CriteriaGroup]
    bidder_ids: list[UUID]

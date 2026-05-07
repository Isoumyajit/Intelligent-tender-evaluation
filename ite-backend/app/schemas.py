from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


# ── Item schemas ──

class ItemBase(BaseModel):
    name: str
    description: str | None = None


class ItemCreate(ItemBase):
    pass


class ItemUpdate(BaseModel):
    name: str | None = None
    description: str | None = None


class ItemResponse(ItemBase):
    id: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ── Attachment schemas ──

class AttachmentResponse(BaseModel):
    attachment_ref_id: UUID
    file_name: str
    content_type: str
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Tender schemas ──

class TenderUpdate(BaseModel):
    tender_name: str | None = None


class TenderResponse(BaseModel):
    tender_id: UUID
    tender_name: str
    tender_ref: UUID
    created_at: datetime
    updated_at: datetime
    attachment: AttachmentResponse

    model_config = {"from_attributes": True}


class TenderListResponse(BaseModel):
    tender_id: UUID
    tender_name: str
    tender_ref: UUID
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
    mandatory: bool = True


class CriteriaGroup(BaseModel):
    criteria: str
    criteria_desc: str = ""
    evaluation_conditions: list[EvaluationCondition]


# ── Process Tender schemas ──

class ProcessTenderRequest(BaseModel):
    tender_id: UUID
    bidder_ids: list[UUID]


class ProcessTenderResponse(BaseModel):
    job_id: UUID


class JobBidderResponse(BaseModel):
    bid_id: UUID
    bidder_name: str
    status: str


class JobResponse(BaseModel):
    job_id: UUID
    tender_id: UUID
    tender_name: str
    status: str
    criteria: list[CriteriaGroup]
    bidders: list[JobBidderResponse]
    created_at: datetime
    updated_at: datetime

"""Legacy (non-/api) Pydantic schemas used by the original Postgres-backed
`/tenders/*` upload + `/items/*` scaffold. The frontend-facing contract
lives in app/api_models.py."""

from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel


# ── Item schemas ──────────────────────────────────────────────────────


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
    reference: str | None = None
    authority: str | None = None
    description: str | None = None
    status: str | None = None
    closing_date: date | None = None
    estimated_value: str | None = None


class TenderResponse(BaseModel):
    tender_id: UUID
    tender_name: str
    reference: str
    authority: str
    description: str
    status: str
    bidders_count: int
    estimated_value: str
    closing_date: date | None = None
    uploaded_date: date | None = None
    document_name: str
    document_size: str
    tender_ref: UUID | None = None
    created_at: datetime
    updated_at: datetime
    attachment: AttachmentResponse | None = None

    model_config = {"from_attributes": True}


class TenderListResponse(BaseModel):
    tender_id: UUID
    tender_name: str
    reference: str
    authority: str
    status: str
    bidders_count: int
    closing_date: date | None = None
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

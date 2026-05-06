"""Pydantic models used by the frontend-facing /api/* routes.

These models emit and accept camelCase JSON so the Angular frontend can
consume the payloads without a response-reshape layer. Internal Python
code still reads/writes the snake_case field names — the conversion
happens at the pydantic boundary.
"""

from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel


class CamelModel(BaseModel):
    """Common base for every API model: camelCase wire format, but also
    accepts the snake_case Python form when callers construct them."""

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True,
    )


# ── Tender ─────────────────────────────────────────────────────────────

TenderStatus = Literal[
    "Pending Review",
    "Technical Evaluation",
    "Financial Comparison",
    "Award Recommended",
    "On Hold",
    "Closed",
]


class ProcessedTender(CamelModel):
    id: UUID
    reference: str
    name: str
    authority: str
    uploaded_date: str
    closing_date: str
    status: TenderStatus
    bidders_count: int
    document_name: str
    document_size: str
    estimated_value: str
    description: str


# ── Bidder ─────────────────────────────────────────────────────────────

BidderOverallStatus = Literal["Qualified", "Disqualified", "Under Review"]


class BidderSummary(CamelModel):
    id: UUID
    tender_id: UUID
    name: str
    registration_no: str
    submitted_on: str
    documents_count: int
    total_size: str
    confidence_score: int
    rank: int
    overall_status: BidderOverallStatus
    technical_score: int
    financial_score: int
    compliance_score: int
    bid_amount: str


# ── Criterion & evidence ──────────────────────────────────────────────

CriterionStatus = Literal["passed", "failed", "partial"]
CriterionCategory = Literal["Eligibility", "Technical", "Financial", "Compliance"]


class DocumentEvidence(CamelModel):
    document_name: str
    page_or_section: str
    excerpt: str
    extracted_value: str | None = None
    confidence: int


class EvaluationCriterion(CamelModel):
    id: str
    category: CriterionCategory
    title: str
    requirement: str
    status: CriterionStatus
    weight: int
    score: int
    evidence: list[DocumentEvidence]
    notes: str | None = None


class BidderEvaluation(BidderSummary):
    criteria: list[EvaluationCriterion]


# ── Documents listing ─────────────────────────────────────────────────

BidderDocumentCategory = Literal[
    "Eligibility", "Technical", "Financial", "Compliance", "Other"
]


class BidderDocument(CamelModel):
    id: str  # synthesised prefix like "<bidderUuid>-DOC-1"; stays string for now
    tender_id: UUID
    bidder_id: UUID
    file_name: str
    mime_type: str
    size_bytes: int
    uploaded_on: str
    page_count: int | None = None
    category: BidderDocumentCategory
    description: str | None = None


# ── Write payload ─────────────────────────────────────────────────────


class AddBidderPayload(CamelModel):
    bidder_name: str
    upload_mode: Literal["folder", "zip"] = "folder"
    total_size_bytes: int | None = None
    file_count: int | None = None


class AddTenderPayload(CamelModel):
    """Payload the frontend sends when a clerk uploads a new tender.
    Metadata only — the backend mints the ID. File-blob persistence
    happens separately via the team's `/tenders/` multipart upload."""

    name: str
    document_name: str
    document_size: str | None = None
    authority: str | None = None
    description: str | None = None

"""SQLAlchemy ORM — the persistence shape of the domain.

Shapes here mirror the API models in app/api_models.py exactly, so the
eventual migration away from in-memory fixtures is a routing change
(swap the FixtureStore for a DB-backed repository), not a schema
redesign.

Columns use snake_case at the DB level; Pydantic's alias_generator on
CamelModel handles the camelCase on the wire.
"""

import uuid
from datetime import datetime

from sqlalchemy import (
    Date,
    ForeignKey,
    Integer,
    LargeBinary,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


# ── Legacy Item (untouched) ────────────────────────────────────────────


class Item(Base):
    __tablename__ = "items"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        default=datetime.utcnow, onupdate=datetime.utcnow
    )


# ── Attachment: storage for tender + document bytes ──────────────────────


class Attachment(Base):
    __tablename__ = "attachments"

    attachment_ref_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    file_name: Mapped[str] = mapped_column(String(512), nullable=False)
    content_type: Mapped[str] = mapped_column(String(255), nullable=False)
    data: Mapped[bytes] = mapped_column(LargeBinary, nullable=False)
    created_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)

    tender: Mapped["Tender | None"] = relationship(back_populates="attachment")


# ── Tender (widened to match ProcessedTender) ───────────────────────────


class Tender(Base):
    __tablename__ = "tenders"

    # Human-readable id (e.g. 'TEND-2026-041') to match fixtures; the real
    # system can still assign UUIDs here — the column takes any short string.
    tender_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    tender_name: Mapped[str] = mapped_column(String(512), nullable=False)
    reference: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    authority: Mapped[str] = mapped_column(String(256), nullable=False)
    description: Mapped[str] = mapped_column(Text, default="", nullable=False)

    status: Mapped[str] = mapped_column(String(64), nullable=False, default="Pending Review")
    estimated_value: Mapped[str] = mapped_column(String(64), default="", nullable=False)
    closing_date: Mapped[str | None] = mapped_column(Date, nullable=True)
    uploaded_date: Mapped[str | None] = mapped_column(Date, nullable=True)
    bidders_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # Original document metadata + pointer to the blob row.
    document_name: Mapped[str] = mapped_column(String(512), default="", nullable=False)
    document_size: Mapped[str] = mapped_column(String(32), default="", nullable=False)
    tender_ref: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("attachments.attachment_ref_id", ondelete="SET NULL"),
        nullable=True,
    )

    created_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        default=datetime.utcnow, onupdate=datetime.utcnow
    )

    attachment: Mapped[Attachment | None] = relationship(
        back_populates="tender", lazy="selectin"
    )
    bidders: Mapped[list["Bidder"]] = relationship(
        back_populates="tender",
        cascade="all, delete-orphan",
        lazy="selectin",
    )


# ── Bidder ──────────────────────────────────────────────────────────────


class Bidder(Base):
    __tablename__ = "bidders"

    bidder_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    tender_id: Mapped[str] = mapped_column(
        String(64),
        ForeignKey("tenders.tender_id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(256), nullable=False)
    registration_no: Mapped[str] = mapped_column(String(128), default="", nullable=False)
    submitted_on: Mapped[str | None] = mapped_column(Date, nullable=True)

    documents_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    total_size: Mapped[str] = mapped_column(String(32), default="—", nullable=False)

    confidence_score: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    rank: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    overall_status: Mapped[str] = mapped_column(
        String(32), default="Under Review", nullable=False
    )
    technical_score: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    financial_score: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    compliance_score: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    bid_amount: Mapped[str] = mapped_column(String(32), default="—", nullable=False)

    created_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)

    tender: Mapped[Tender] = relationship(back_populates="bidders")
    criteria: Mapped[list["EvaluationCriterion"]] = relationship(
        back_populates="bidder",
        cascade="all, delete-orphan",
        lazy="selectin",
        order_by="EvaluationCriterion.ordinal",
    )
    documents: Mapped[list["BidderDocument"]] = relationship(
        back_populates="bidder",
        cascade="all, delete-orphan",
        lazy="selectin",
    )


# ── EvaluationCriterion + CriterionEvidence ────────────────────────────


class EvaluationCriterion(Base):
    __tablename__ = "evaluation_criteria"

    criterion_id: Mapped[str] = mapped_column(String(80), primary_key=True)
    bidder_id: Mapped[str] = mapped_column(
        String(64),
        ForeignKey("bidders.bidder_id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    category: Mapped[str] = mapped_column(String(32), nullable=False)
    title: Mapped[str] = mapped_column(String(256), nullable=False)
    requirement: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String(16), nullable=False)
    weight: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    score: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    ordinal: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    bidder: Mapped[Bidder] = relationship(back_populates="criteria")
    evidence: Mapped[list["CriterionEvidence"]] = relationship(
        back_populates="criterion",
        cascade="all, delete-orphan",
        lazy="selectin",
        order_by="CriterionEvidence.ordinal",
    )


class CriterionEvidence(Base):
    __tablename__ = "criterion_evidence"

    evidence_id: Mapped[int] = mapped_column(primary_key=True)
    criterion_id: Mapped[str] = mapped_column(
        String(80),
        ForeignKey("evaluation_criteria.criterion_id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    document_name: Mapped[str] = mapped_column(String(512), nullable=False)
    page_or_section: Mapped[str] = mapped_column(String(256), nullable=False)
    excerpt: Mapped[str] = mapped_column(Text, nullable=False)
    extracted_value: Mapped[str | None] = mapped_column(String(512), nullable=True)
    confidence: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    ordinal: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    criterion: Mapped[EvaluationCriterion] = relationship(back_populates="evidence")


# ── BidderDocument ──────────────────────────────────────────────────────


class BidderDocument(Base):
    __tablename__ = "bidder_documents"

    document_id: Mapped[str] = mapped_column(String(96), primary_key=True)
    bidder_id: Mapped[str] = mapped_column(
        String(64),
        ForeignKey("bidders.bidder_id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    tender_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)

    file_name: Mapped[str] = mapped_column(String(512), nullable=False)
    mime_type: Mapped[str] = mapped_column(String(128), nullable=False)
    size_bytes: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    uploaded_on: Mapped[str | None] = mapped_column(Date, nullable=True)
    page_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    category: Mapped[str] = mapped_column(String(32), nullable=False)
    description: Mapped[str | None] = mapped_column(String(512), nullable=True)

    # Optional: FK to the blob row if/when we persist document bytes.
    blob_ref: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("attachments.attachment_ref_id", ondelete="SET NULL"),
        nullable=True,
    )

    bidder: Mapped[Bidder] = relationship(back_populates="documents")

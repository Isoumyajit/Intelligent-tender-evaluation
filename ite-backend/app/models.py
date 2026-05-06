"""SQLAlchemy ORM — the persistence shape of the domain.

Shapes mirror app/api_models.py. Tenders and bids use VARCHAR ids
(VARCHAR(64)) so the friendly identifiers the frontend uses
(`TEND-2026-041`, `TEND-NEW-001-BID-1`) fit directly. Attachments keep
an internal UUID — they're a storage detail and no one outside the
backend references them by id.
"""

import uuid
from datetime import date, datetime

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


# ── Legacy Item ──────────────────────────────────────────────────────


class Item(Base):
    __tablename__ = "items"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        default=datetime.utcnow, onupdate=datetime.utcnow
    )


# ── Attachment (internal UUID key) ───────────────────────────────────


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
    bid_attachments: Mapped[list["BidAttachment"]] = relationship(
        back_populates="attachment"
    )


# ── Tender ───────────────────────────────────────────────────────────


class Tender(Base):
    __tablename__ = "tenders"

    tender_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    tender_name: Mapped[str] = mapped_column(String(512), nullable=False)
    reference: Mapped[str] = mapped_column(
        String(128), nullable=False, unique=True, index=True
    )
    authority: Mapped[str] = mapped_column(String(256), nullable=False, default="—")
    description: Mapped[str] = mapped_column(Text, default="", nullable=False)

    status: Mapped[str] = mapped_column(
        String(64), nullable=False, default="Pending Review"
    )
    estimated_value: Mapped[str] = mapped_column(String(64), default="—", nullable=False)
    closing_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    uploaded_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    bidders_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

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
    bids: Mapped[list["Bid"]] = relationship(
        back_populates="tender",
        cascade="all, delete-orphan",
        lazy="selectin",
    )


# ── Bid (= bidder) ───────────────────────────────────────────────────


class Bid(Base):
    __tablename__ = "bids"

    bid_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    tender_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tenders.tender_id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    bidder_name: Mapped[str] = mapped_column(String(512), nullable=False)
    registration_no: Mapped[str] = mapped_column(
        String(128), default="", nullable=False
    )
    submitted_on: Mapped[date | None] = mapped_column(Date, nullable=True)

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
    updated_at: Mapped[datetime] = mapped_column(
        default=datetime.utcnow, onupdate=datetime.utcnow
    )

    tender: Mapped[Tender] = relationship(back_populates="bids")
    bid_attachments: Mapped[list["BidAttachment"]] = relationship(
        back_populates="bid", lazy="selectin", cascade="all, delete-orphan"
    )


# ── BidAttachment (join row) ─────────────────────────────────────────


class BidAttachment(Base):
    __tablename__ = "bid_attachments"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    bid_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("bids.bid_id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    attachment_ref_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("attachments.attachment_ref_id", ondelete="CASCADE"),
        nullable=False,
    )
    category: Mapped[str | None] = mapped_column(String(32), nullable=True)
    description: Mapped[str | None] = mapped_column(String(512), nullable=True)
    page_count: Mapped[int | None] = mapped_column(Integer, nullable=True)

    bid: Mapped[Bid] = relationship(back_populates="bid_attachments")
    attachment: Mapped[Attachment] = relationship(
        back_populates="bid_attachments", lazy="selectin"
    )

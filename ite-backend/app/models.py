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
    bid_attachments: Mapped[list["BidAttachment"]] = relationship(back_populates="attachment")


class Tender(Base):
    __tablename__ = "tenders"

    tender_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    tender_name: Mapped[str] = mapped_column(String(512), nullable=False)
    tender_ref: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("attachments.attachment_ref_id", ondelete="CASCADE"), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(default=datetime.utcnow, onupdate=datetime.utcnow)

    attachment: Mapped[Attachment] = relationship(back_populates="tender", lazy="selectin")
    bids: Mapped[list["Bid"]] = relationship(back_populates="tender", lazy="selectin")


class Bid(Base):
    __tablename__ = "bids"

    bid_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    tender_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tenders.tender_id", ondelete="CASCADE"), nullable=False
    )
    bidder_name: Mapped[str] = mapped_column(String(512), nullable=False)
    created_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(default=datetime.utcnow, onupdate=datetime.utcnow)

    tender: Mapped[Tender] = relationship(back_populates="bids")
    bid_attachments: Mapped[list["BidAttachment"]] = relationship(
        back_populates="bid", lazy="selectin", cascade="all, delete-orphan"
    )


class BidAttachment(Base):
    __tablename__ = "bid_attachments"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    bid_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("bids.bid_id", ondelete="CASCADE"), nullable=False
    )
    attachment_ref_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("attachments.attachment_ref_id", ondelete="CASCADE"), nullable=False
    )

    bid: Mapped[Bid] = relationship(back_populates="bid_attachments")
    attachment: Mapped[Attachment] = relationship(back_populates="bid_attachments", lazy="selectin")

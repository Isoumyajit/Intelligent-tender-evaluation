import uuid
from datetime import datetime

from sqlalchemy import ForeignKey, LargeBinary, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


class Item(Base):
    __tablename__ = "items"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(default=datetime.utcnow, onupdate=datetime.utcnow)


class Attachment(Base):
    __tablename__ = "attachments"

    attachment_ref_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    file_name: Mapped[str] = mapped_column(String(512), nullable=False)
    content_type: Mapped[str] = mapped_column(String(255), nullable=False)
    data: Mapped[bytes] = mapped_column(LargeBinary, nullable=False)
    ocr_status: Mapped[str] = mapped_column(String(32), nullable=False, default="pending")
    ocr_text: Mapped[str | None] = mapped_column(Text, nullable=True)
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
    jobs: Mapped[list["Job"]] = relationship(back_populates="tender", lazy="selectin")


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


class Job(Base):
    __tablename__ = "jobs"

    job_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    tender_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tenders.tender_id", ondelete="CASCADE"), nullable=False
    )
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="pending")
    created_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(default=datetime.utcnow, onupdate=datetime.utcnow)

    tender: Mapped[Tender] = relationship(back_populates="jobs", lazy="selectin")
    job_bidders: Mapped[list["JobBidder"]] = relationship(
        back_populates="job", lazy="selectin", cascade="all, delete-orphan"
    )
    tender_criteria: Mapped[list["TenderCriteria"]] = relationship(
        back_populates="job", lazy="selectin", cascade="all, delete-orphan"
    )


class JobBidder(Base):
    __tablename__ = "job_bidders"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    job_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("jobs.job_id", ondelete="CASCADE"), nullable=False
    )
    bid_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("bids.bid_id", ondelete="CASCADE"), nullable=False
    )
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="pending")

    job: Mapped[Job] = relationship(back_populates="job_bidders")
    bid: Mapped[Bid] = relationship()


class TenderCriteria(Base):
    __tablename__ = "tender_criteria"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    job_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("jobs.job_id", ondelete="CASCADE"), nullable=False
    )
    criteria: Mapped[str] = mapped_column(String(255), nullable=False)
    criteria_desc: Mapped[str] = mapped_column(Text, nullable=False, default="")
    created_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)

    job: Mapped[Job] = relationship(back_populates="tender_criteria")
    evaluation_conditions: Mapped[list["TenderEvaluationCondition"]] = relationship(
        back_populates="tender_criteria", lazy="selectin", cascade="all, delete-orphan"
    )


class TenderEvaluationCondition(Base):
    __tablename__ = "tender_evaluation_conditions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    tender_criteria_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tender_criteria.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(512), nullable=False)
    predicate: Mapped[str] = mapped_column(Text, nullable=False)
    mandatory: Mapped[bool] = mapped_column(nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)

    tender_criteria: Mapped[TenderCriteria] = relationship(back_populates="evaluation_conditions")


class AuditLog(Base):
    __tablename__ = "audit_logs"

    audit_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    tender_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tenders.tender_id", ondelete="CASCADE"), nullable=False
    )
    bidder_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("bids.bid_id", ondelete="SET NULL"), nullable=True
    )
    event: Mapped[str] = mapped_column(String(64), nullable=False)
    audit_desc: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)

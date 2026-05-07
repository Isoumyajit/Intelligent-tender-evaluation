from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.models import AuditLog


async def log_audit(
    db: AsyncSession,
    tender_id: UUID,
    event: str,
    audit_desc: str,
    bidder_id: UUID | None = None,
) -> None:
    db.add(AuditLog(
        tender_id=tender_id,
        bidder_id=bidder_id,
        event=event,
        audit_desc=audit_desc,
    ))

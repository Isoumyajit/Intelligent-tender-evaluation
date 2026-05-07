from enum import Enum
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import AuditLog
from app.schemas import AuditLogResponse

router = APIRouter(prefix="/audits", tags=["audits"])


class SortOrder(str, Enum):
    asc = "asc"
    desc = "desc"


@router.get("/", response_model=list[AuditLogResponse])
async def list_audits(
    tender_id: UUID | None = Query(default=None),
    bidder_id: UUID | None = Query(default=None),
    sort_order: SortOrder = Query(default=SortOrder.asc, alias="sort-order"),
    count: int = Query(default=20, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
):
    order_col = AuditLog.created_at.asc() if sort_order == SortOrder.asc else AuditLog.created_at.desc()
    stmt = select(AuditLog).order_by(order_col).limit(count)

    if tender_id is not None:
        stmt = stmt.where(AuditLog.tender_id == tender_id)
    if bidder_id is not None:
        stmt = stmt.where(AuditLog.bidder_id == bidder_id)

    result = await db.execute(stmt)
    return result.scalars().all()

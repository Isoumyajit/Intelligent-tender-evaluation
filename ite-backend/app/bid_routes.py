from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, UploadFile, status
from fastapi.responses import Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import Attachment, Bid, BidAttachment, Tender
from app.schemas import BidListResponse, BidResponse, BidUpdate
from app.services.audit_service import log_audit
from app.services.ocr_service import run_ocr

router = APIRouter(prefix="/tenders/{tender_id}/bid", tags=["bids"])


async def _get_tender_or_404(tender_id: UUID, db: AsyncSession) -> Tender:
    result = await db.execute(select(Tender).where(Tender.tender_id == tender_id))
    tender = result.scalar_one_or_none()
    if not tender:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tender not found")
    return tender


@router.post("/", response_model=BidResponse, status_code=status.HTTP_201_CREATED)
async def create_bid(
    tender_id: UUID,
    bidder_name: Annotated[str, Form()],
    documents: Annotated[list[UploadFile], File(description="Upload one or more files")],
    background_tasks: BackgroundTasks = BackgroundTasks(),
    db: AsyncSession = Depends(get_db),
):
    await _get_tender_or_404(tender_id, db)

    attachments: list[Attachment] = []
    for doc in documents:
        file_bytes = await doc.read()
        attachment = Attachment(
            file_name=doc.filename or "unknown",
            content_type=doc.content_type or "application/octet-stream",
            data=file_bytes,
        )
        db.add(attachment)
        attachments.append(attachment)

    await db.flush()

    bid = Bid(tender_id=tender_id, bidder_name=bidder_name)
    db.add(bid)
    await db.flush()

    for attachment in attachments:
        bid_attachment = BidAttachment(
            bid_id=bid.bid_id,
            attachment_ref_id=attachment.attachment_ref_id,
        )
        db.add(bid_attachment)

    await log_audit(
        db,
        tender_id=tender_id,
        event="bidder_added",
        audit_desc=f"Bidder '{bidder_name}' (bid {bid.bid_id}) added to tender {tender_id}",
        bidder_id=bid.bid_id,
    )

    await db.commit()
    await db.refresh(bid)

    for attachment in attachments:
        background_tasks.add_task(run_ocr, attachment.attachment_ref_id)

    return _bid_to_response(bid)


@router.get("/", response_model=list[BidListResponse])
async def list_bids(
    tender_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    await _get_tender_or_404(tender_id, db)
    result = await db.execute(
        select(Bid).where(Bid.tender_id == tender_id).order_by(Bid.created_at.desc())
    )
    return result.scalars().all()


@router.get("/{bid_id}", response_model=BidResponse)
async def get_bid(
    tender_id: UUID,
    bid_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    bid = await _get_bid_or_404(tender_id, bid_id, db)
    return _bid_to_response(bid)


@router.put("/{bid_id}", response_model=BidResponse)
async def update_bid(
    tender_id: UUID,
    bid_id: UUID,
    payload: BidUpdate,
    db: AsyncSession = Depends(get_db),
):
    bid = await _get_bid_or_404(tender_id, bid_id, db)

    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(bid, field, value)

    await db.commit()
    await db.refresh(bid)
    return _bid_to_response(bid)


@router.delete("/{bid_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_bid(
    tender_id: UUID,
    bid_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    bid = await _get_bid_or_404(tender_id, bid_id, db)

    attachment_ref_ids = [ba.attachment_ref_id for ba in bid.bid_attachments]

    await db.delete(bid)

    if attachment_ref_ids:
        att_result = await db.execute(
            select(Attachment).where(Attachment.attachment_ref_id.in_(attachment_ref_ids))
        )
        for attachment in att_result.scalars().all():
            await db.delete(attachment)

    await db.commit()


@router.put("/{bid_id}/documents", response_model=BidResponse)
async def add_bid_document(
    tender_id: UUID,
    bid_id: UUID,
    document: Annotated[UploadFile, File(description="Upload a file to add to the bid")],
    background_tasks: BackgroundTasks = BackgroundTasks(),
    db: AsyncSession = Depends(get_db),
):
    bid = await _get_bid_or_404(tender_id, bid_id, db)

    file_bytes = await document.read()
    attachment = Attachment(
        file_name=document.filename or "unknown",
        content_type=document.content_type or "application/octet-stream",
        data=file_bytes,
    )
    db.add(attachment)
    await db.flush()

    bid_attachment = BidAttachment(
        bid_id=bid.bid_id,
        attachment_ref_id=attachment.attachment_ref_id,
    )
    db.add(bid_attachment)

    await db.commit()
    await db.refresh(bid)

    background_tasks.add_task(run_ocr, attachment.attachment_ref_id)

    return _bid_to_response(bid)


@router.delete("/{bid_id}/documents/{attachment_ref_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_bid_document(
    tender_id: UUID,
    bid_id: UUID,
    attachment_ref_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    bid = await _get_bid_or_404(tender_id, bid_id, db)

    linked_ids = {ba.attachment_ref_id for ba in bid.bid_attachments}
    if attachment_ref_id not in linked_ids:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found for this bid",
        )

    ba_result = await db.execute(
        select(BidAttachment).where(
            BidAttachment.bid_id == bid_id,
            BidAttachment.attachment_ref_id == attachment_ref_id,
        )
    )
    bid_attachment = ba_result.scalar_one()
    await db.delete(bid_attachment)

    att_result = await db.execute(
        select(Attachment).where(Attachment.attachment_ref_id == attachment_ref_id)
    )
    attachment = att_result.scalar_one_or_none()
    if attachment:
        await db.delete(attachment)

    await db.commit()


@router.get("/{bid_id}/documents/{attachment_ref_id}")
async def download_bid_document(
    tender_id: UUID,
    bid_id: UUID,
    attachment_ref_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    bid = await _get_bid_or_404(tender_id, bid_id, db)

    linked_ids = {ba.attachment_ref_id for ba in bid.bid_attachments}
    if attachment_ref_id not in linked_ids:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found for this bid",
        )

    att_result = await db.execute(
        select(Attachment).where(Attachment.attachment_ref_id == attachment_ref_id)
    )
    attachment = att_result.scalar_one_or_none()
    if not attachment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    return Response(
        content=attachment.data,
        media_type=attachment.content_type,
        headers={"Content-Disposition": f'attachment; filename="{attachment.file_name}"'},
    )


async def _get_bid_or_404(tender_id: UUID, bid_id: UUID, db: AsyncSession) -> Bid:
    await _get_tender_or_404(tender_id, db)
    result = await db.execute(
        select(Bid).where(Bid.bid_id == bid_id, Bid.tender_id == tender_id)
    )
    bid = result.scalar_one_or_none()
    if not bid:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bid not found")
    return bid


def _bid_to_response(bid: Bid) -> dict:
    return {
        "bid_id": bid.bid_id,
        "tender_id": bid.tender_id,
        "bidder_name": bid.bidder_name,
        "created_at": bid.created_at,
        "updated_at": bid.updated_at,
        "attachments": [ba.attachment for ba in bid.bid_attachments],
    }

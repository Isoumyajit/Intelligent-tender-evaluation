"""Tender CRUD + document upload/download routes under /tenders.
Postgres-backed. Consumed directly by the frontend."""

from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from fastapi.responses import Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import Attachment, Tender
from app.schemas import TenderListResponse, TenderResponse, TenderUpdate

router = APIRouter(prefix="/tenders", tags=["tenders"])


@router.post("/", response_model=TenderResponse, status_code=status.HTTP_201_CREATED)
async def create_tender(
    tender_name: str = Form(...),
    document: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
):
    file_bytes = await document.read()

    attachment = Attachment(
        file_name=document.filename or "unknown",
        content_type=document.content_type or "application/octet-stream",
        data=file_bytes,
    )
    db.add(attachment)
    await db.flush()

    tender = Tender(
        tender_name=tender_name,
        tender_ref=attachment.attachment_ref_id,
    )
    db.add(tender)
    await db.commit()
    await db.refresh(tender)

    return tender


@router.get("/", response_model=list[TenderListResponse])
async def list_tenders(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Tender).order_by(Tender.created_at.desc()))
    return result.scalars().all()


@router.get("/{tender_id}", response_model=TenderResponse)
async def get_tender(tender_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Tender).where(Tender.tender_id == tender_id))
    tender = result.scalar_one_or_none()
    if not tender:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tender not found")
    return tender


@router.put("/{tender_id}", response_model=TenderResponse)
async def update_tender(
    tender_id: UUID,
    payload: TenderUpdate,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Tender).where(Tender.tender_id == tender_id))
    tender = result.scalar_one_or_none()
    if not tender:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tender not found")

    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(tender, field, value)

    await db.commit()
    await db.refresh(tender)
    return tender


@router.delete("/{tender_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_tender(tender_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Tender).where(Tender.tender_id == tender_id))
    tender = result.scalar_one_or_none()
    if not tender:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tender not found")

    attachment_ref = tender.tender_ref
    await db.delete(tender)

    if attachment_ref is not None:
        att_result = await db.execute(
            select(Attachment).where(Attachment.attachment_ref_id == attachment_ref)
        )
        attachment = att_result.scalar_one_or_none()
        if attachment:
            await db.delete(attachment)

    await db.commit()


@router.get("/{tender_id}/document")
async def download_tender_document(tender_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Tender).where(Tender.tender_id == tender_id))
    tender = result.scalar_one_or_none()
    if not tender:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tender not found")
    if tender.tender_ref is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    att_result = await db.execute(
        select(Attachment).where(Attachment.attachment_ref_id == tender.tender_ref)
    )
    attachment = att_result.scalar_one_or_none()
    if not attachment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    return Response(
        content=attachment.data,
        media_type=attachment.content_type,
        headers={"Content-Disposition": f'attachment; filename="{attachment.file_name}"'},
    )

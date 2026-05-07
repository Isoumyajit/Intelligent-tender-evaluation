import logging
import traceback
from pathlib import Path
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import async_session, get_db
from app.models import Bid, Job, JobBidder, Tender, TenderCriteria, TenderEvaluationCondition
from app.schemas import (
    CriteriaGroup,
    EvaluationCondition,
    JobBidderResponse,
    JobResponse,
    ProcessTenderRequest,
    ProcessTenderResponse,
)
from app.services.criteria_service import extract_criteria

logger = logging.getLogger("ite.process_tender")

router = APIRouter(prefix="/process-tender", tags=["process-tender"])

# TODO: Replace mock text loader with actual OCR / TextLayout extraction
#       from the tender's uploaded attachment once the OCR service is available.
MOCK_TENDER_TEXT_PATH = Path(__file__).resolve().parent.parent / "mock" / "data" / "tender1" / "tender1.txt"


def _load_mock_tender_pages() -> list[str]:
    """Load mock tender text as a single-page list.
    Replace this with real OCR / TextLayout extraction later.
    """
    text = MOCK_TENDER_TEXT_PATH.read_text(encoding="utf-8")
    return [text]


async def _process_job(job_id: UUID) -> None:
    async with async_session() as db:
        try:
            result = await db.execute(select(Job).where(Job.job_id == job_id))
            job = result.scalar_one()

            job.status = "processing"
            await db.commit()

            # TODO: Replace with actual OCR / TextLayout extraction from tender attachment
            pages = _load_mock_tender_pages()

            criteria_groups = await extract_criteria(pages)

            for group in criteria_groups:
                tc = TenderCriteria(job_id=job_id, criteria=group.criteria)
                db.add(tc)
                await db.flush()

                for condition in group.evaluation_conditions:
                    ec = TenderEvaluationCondition(
                        tender_criteria_id=tc.id,
                        name=condition.name,
                        predicate=condition.predicate,
                        mandatory=condition.mandatory,
                    )
                    db.add(ec)

            job.status = "completed"
            await db.commit()
            logger.info("Job %s completed successfully", job_id)

        except Exception:
            logger.error("Job %s failed:\n%s", job_id, traceback.format_exc())
            try:
                result = await db.execute(select(Job).where(Job.job_id == job_id))
                job = result.scalar_one()
                job.status = "failed"
                await db.commit()
            except Exception:
                logger.error("Could not mark job %s as failed:\n%s", job_id, traceback.format_exc())


@router.post("/", response_model=ProcessTenderResponse, status_code=status.HTTP_202_ACCEPTED)
async def process_tender(
    payload: ProcessTenderRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Tender).where(Tender.tender_id == payload.tender_id))
    tender = result.scalar_one_or_none()
    if not tender:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tender not found")

    for bid_id in payload.bidder_ids:
        bid_result = await db.execute(
            select(Bid).where(Bid.bid_id == bid_id, Bid.tender_id == payload.tender_id)
        )
        if not bid_result.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Bid {bid_id} not found for tender {payload.tender_id}",
            )

    job = Job(tender_id=payload.tender_id, status="pending")
    db.add(job)
    await db.flush()

    for bid_id in payload.bidder_ids:
        db.add(JobBidder(job_id=job.job_id, bid_id=bid_id))

    await db.commit()
    await db.refresh(job)

    background_tasks.add_task(_process_job, job.job_id)

    return ProcessTenderResponse(job_id=job.job_id)


@router.get("/{job_id}", response_model=JobResponse)
async def get_job_result(
    job_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Job).where(Job.job_id == job_id))
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")

    criteria_groups = [
        CriteriaGroup(
            criteria=tc.criteria,
            criteria_desc=tc.criteria_desc,
            evaluation_conditions=[
                EvaluationCondition(name=ec.name, predicate=ec.predicate, mandatory=ec.mandatory)
                for ec in tc.evaluation_conditions
            ],
        )
        for tc in job.tender_criteria
    ]

    bidders = [
        JobBidderResponse(
            bid_id=jb.bid_id,
            bidder_name=jb.bid.bidder_name,
            status=jb.status,
        )
        for jb in job.job_bidders
    ]

    return JobResponse(
        job_id=job.job_id,
        tender_id=job.tender_id,
        tender_name=job.tender.tender_name,
        status=job.status,
        criteria=criteria_groups,
        bidders=bidders,
        created_at=job.created_at,
        updated_at=job.updated_at,
    )

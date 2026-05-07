import logging
import traceback
from collections import defaultdict
from pathlib import Path
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import async_session, get_db
from app.models import (
    Bid,
    BidderEvaluation,
    Job,
    JobBidder,
    Tender,
    TenderCriteria,
    TenderEvaluationCondition,
)
from app.schemas import (
    BidderEvaluationResponse,
    ConditionEvidenceResponse,
    CriteriaGroup,
    EvaluationCondition,
    JobResponse,
    ProcessTenderRequest,
    ProcessTenderResponse,
)
from app.services.audit_service import log_audit
from app.services.classification_service import DocumentInfo, classify_documents
from app.services.criteria_service import extract_criteria
from app.services.evidence_service import ConditionInput, evaluate_conditions

logger = logging.getLogger("ite.process_tender")

router = APIRouter(prefix="/process-tender", tags=["process-tender"])

# TODO: Replace mock text loaders with actual OCR / TextLayout extraction
#       from uploaded attachments once the OCR service is integrated.
MOCK_DATA_DIR = Path(__file__).resolve().parent.parent / "mock" / "data"
MOCK_TENDER_TEXT_PATH = MOCK_DATA_DIR / "tender1" / "tender1.txt"


def _load_mock_tender_pages() -> list[str]:
    """Load mock tender text as a single-page list."""
    text = MOCK_TENDER_TEXT_PATH.read_text(encoding="utf-8")
    return [text]


def _load_bidder_docs(bid: Bid) -> list[DocumentInfo]:
    """Load document texts from a bid's attachments using ocr_text.
    Falls back to mock files if ocr_text is not available.
    """
    docs: list[DocumentInfo] = []
    # TODO: Remove mock fallback once OCR is reliably producing ocr_text
    mock_dir = MOCK_DATA_DIR / "tender1" / "bid-document"
    mock_files = sorted(mock_dir.glob("*")) if mock_dir.exists() else []

    for i, ba in enumerate(bid.bid_attachments):
        att = ba.attachment
        if False: # att.ocr_text:
            docs.append(DocumentInfo(file_name=att.file_name, text=att.ocr_text))
        elif i < len(mock_files):
            mock_path = mock_files[i]
            docs.append(DocumentInfo(
                file_name=att.file_name,
                text=mock_path.read_text(encoding="utf-8"),
            ))
            logger.warning(
                "Using mock file '%s' for attachment '%s' (ocr_text is empty)",
                mock_path.name, att.file_name,
            )
    return docs


async def _find_existing_criteria(
    db: AsyncSession,
    tender_id: UUID,
    current_job_id: UUID,
) -> list[TenderCriteria]:
    """Look for criteria already extracted by a previous completed job for the same tender."""
    prev_job_result = await db.execute(
        select(Job)
        .where(
            Job.tender_id == tender_id,
            Job.job_id != current_job_id,
            Job.status.in_(["completed", "processing"]),
        )
        .order_by(Job.created_at.desc())
        .limit(1)
    )
    prev_job = prev_job_result.scalar_one_or_none()

    if prev_job is None:
        return []

    criteria_result = await db.execute(
        select(TenderCriteria).where(TenderCriteria.job_id == prev_job.job_id)
    )
    criteria = criteria_result.scalars().all()

    if not criteria:
        return []

    for tc in criteria:
        await db.refresh(tc, ["evaluation_conditions"])

    return list(criteria)


async def _process_job(job_id: UUID) -> None:
    async with async_session() as db:
        try:
            result = await db.execute(select(Job).where(Job.job_id == job_id))
            job = result.scalar_one()

            job.status = "processing"
            await db.commit()

            # ── Phase 1: Criteria extraction (reuse existing or call LLM) ──
            criteria_category_to_tc: dict[str, TenderCriteria] = {}

            existing_criteria = await _find_existing_criteria(db, job.tender_id, job_id)

            if existing_criteria:
                logger.info(
                    "Job %s: reusing %d criteria groups from previous job for tender %s",
                    job_id, len(existing_criteria), job.tender_id,
                )
                for src_tc in existing_criteria:
                    tc = TenderCriteria(
                        job_id=job_id,
                        criteria=src_tc.criteria,
                        criteria_desc=src_tc.criteria_desc,
                    )
                    db.add(tc)
                    await db.flush()
                    criteria_category_to_tc[tc.criteria.lower()] = tc

                    for src_ec in src_tc.evaluation_conditions:
                        db.add(TenderEvaluationCondition(
                            tender_criteria_id=tc.id,
                            name=src_ec.name,
                            predicate=src_ec.predicate,
                            mandatory=src_ec.mandatory,
                        ))

                await db.flush()
                await log_audit(
                    db,
                    tender_id=job.tender_id,
                    event="tender_criteria_identification_completed",
                    audit_desc=(
                        f"Criteria identification for job {job_id} reused from previous job — "
                        f"{len(existing_criteria)} criteria groups copied"
                    ),
                )
                await db.commit()
            else:
                await log_audit(
                    db,
                    tender_id=job.tender_id,
                    event="tender_criteria_identification_started",
                    audit_desc=f"Criteria identification started for job {job_id}, tender {job.tender_id}",
                )
                await db.commit()

                # TODO: Replace with actual OCR / TextLayout extraction from tender attachment
                pages = _load_mock_tender_pages()

                criteria_groups = await extract_criteria(pages)

                for group in criteria_groups:
                    tc = TenderCriteria(
                        job_id=job_id,
                        criteria=group.criteria,
                        criteria_desc=group.criteria_desc,
                    )
                    db.add(tc)
                    await db.flush()
                    criteria_category_to_tc[group.criteria.lower()] = tc

                    for condition in group.evaluation_conditions:
                        db.add(TenderEvaluationCondition(
                            tender_criteria_id=tc.id,
                            name=condition.name,
                            predicate=condition.predicate,
                            mandatory=condition.mandatory,
                        ))

                await db.flush()
                await log_audit(
                    db,
                    tender_id=job.tender_id,
                    event="tender_criteria_identification_completed",
                    audit_desc=(
                        f"Criteria identification completed for job {job_id}, "
                        f"tender {job.tender_id} -- {len(criteria_groups)} criteria groups extracted"
                    ),
                )
                await db.commit()

            logger.info("Job %s: criteria ready, %d groups", job_id, len(criteria_category_to_tc))

            for tc in criteria_category_to_tc.values():
                await db.refresh(tc)

            # ── Phase 2: Bidder document evaluation ──
            bidder_rows = await db.execute(
                select(JobBidder).where(JobBidder.job_id == job_id)
            )
            job_bidders = bidder_rows.scalars().all()

            categories = list(criteria_category_to_tc.keys())

            for idx, jb in enumerate(job_bidders, start=1):
                await db.refresh(jb, ["bid"])
                bidder_name = jb.bid.bidder_name

                jb.status = "processing"
                await db.commit()
                logger.info("Job %s: evaluating bidder %d/%d '%s'", job_id, idx, len(job_bidders), bidder_name)

                docs = _load_bidder_docs(jb.bid)
                doc_names = [d.file_name for d in docs]
                logger.info(
                    "Loaded %d document(s) for bidder '%s': %s",
                    len(docs), bidder_name, doc_names,
                )

                if not docs:
                    _mark_all_not_met(db, job_id, jb.bid_id, criteria_category_to_tc)
                    jb.status = "completed"
                    await db.commit()
                    logger.info("Bidder '%s' evaluation completed (no docs)", bidder_name)
                    continue

                # Step 1: Classify documents into criteria categories
                classification = await classify_documents(docs, categories)
                logger.info("Classification result for bidder '%s': %s", bidder_name, classification)

                # Group docs by category
                category_docs: dict[str, list[dict[str, str]]] = defaultdict(list)
                for doc in docs:
                    cat = classification.get(doc.file_name, "").lower()
                    if cat in criteria_category_to_tc:
                        category_docs[cat].append({"file_name": doc.file_name, "text": doc.text})

                # Step 2: Evaluate conditions for each category
                for cat_name, tc in criteria_category_to_tc.items():
                    matching_docs = category_docs.get(cat_name, [])

                    conditions_input = [
                        ConditionInput(name=ec.name, predicate=ec.predicate, mandatory=ec.mandatory)
                        for ec in tc.evaluation_conditions
                    ]

                    if not matching_docs:
                        logger.info(
                            "No docs for category '%s', marking %d conditions as not_met",
                            cat_name, len(conditions_input),
                        )
                        for ec in tc.evaluation_conditions:
                            db.add(BidderEvaluation(
                                job_id=job_id,
                                bid_id=jb.bid_id,
                                condition_id=ec.id,
                                verdict="not_met",
                                evidence="No relevant document provided for this criteria category",
                                source_file=None,
                                page_index=0,
                            ))
                        continue

                    evidence_results = await evaluate_conditions(
                        conditions=conditions_input,
                        doc_texts=matching_docs,
                        criteria=cat_name,
                    )

                    condition_id_map = {ec.name: ec.id for ec in tc.evaluation_conditions}

                    for ev in evidence_results:
                        cond_id = condition_id_map.get(ev.condition_name)
                        if cond_id is None:
                            logger.warning(
                                "LLM returned unknown condition '%s', skipping", ev.condition_name,
                            )
                            continue
                        logger.info(
                            "Evidence for bidder '%s', category '%s': %s -> %s",
                            bidder_name, cat_name, ev.condition_name, ev.verdict,
                        )
                        db.add(BidderEvaluation(
                            job_id=job_id,
                            bid_id=jb.bid_id,
                            condition_id=cond_id,
                            verdict=ev.verdict,
                            evidence=ev.evidence,
                            source_file=ev.source_file,
                            page_index=ev.page_index,
                        ))

                jb.status = "completed"
                await db.commit()
                logger.info("Bidder '%s' evaluation completed", bidder_name)

            # Mark job complete
            result = await db.execute(select(Job).where(Job.job_id == job_id))
            job = result.scalar_one()
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


def _mark_all_not_met(
    db: AsyncSession,
    job_id: UUID,
    bid_id: UUID,
    criteria_map: dict[str, TenderCriteria],
) -> None:
    """Mark all evaluation conditions as not_met when a bidder has no documents."""
    for tc in criteria_map.values():
        for ec in tc.evaluation_conditions:
            db.add(BidderEvaluation(
                job_id=job_id,
                bid_id=bid_id,
                condition_id=ec.id,
                verdict="not_met",
                evidence="No documents provided by bidder",
                source_file=None,
                page_index=0,
            ))


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

    await log_audit(
        db,
        tender_id=payload.tender_id,
        event="tender_criteria_evaluation_requested",
        audit_desc=(
            f"Criteria evaluation requested for tender {payload.tender_id}, "
            f"job {job.job_id} created with {len(payload.bidder_ids)} bidders"
        ),
    )

    await db.commit()
    await db.refresh(job)

    background_tasks.add_task(_process_job, job.job_id)

    return ProcessTenderResponse(job_id=job.job_id)


async def _build_job_response(job: Job, db: AsyncSession) -> JobResponse:
    """Build a full JobResponse including bidder evaluation results."""
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

    evals_result = await db.execute(
        select(BidderEvaluation).where(BidderEvaluation.job_id == job.job_id)
    )
    all_evals = evals_result.scalars().all()

    evals_by_bid: dict[UUID, list[ConditionEvidenceResponse]] = defaultdict(list)
    for ev in all_evals:
        evals_by_bid[ev.bid_id].append(
            ConditionEvidenceResponse(
                condition_name=ev.condition.name,
                verdict=ev.verdict,
                evidence=ev.evidence,
                source_file=ev.source_file,
                page_index=ev.page_index,
            )
        )

    bidders = [
        BidderEvaluationResponse(
            bid_id=jb.bid_id,
            bidder_name=jb.bid.bidder_name,
            status=jb.status,
            evaluations=evals_by_bid.get(jb.bid_id, []),
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


@router.get("/tender/{tender_id}/latest", response_model=JobResponse)
async def get_latest_tender_job(
    tender_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Job)
        .where(Job.tender_id == tender_id)
        .order_by(Job.updated_at.desc())
        .limit(1)
    )
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")

    return await _build_job_response(job, db)


@router.get("/{job_id}", response_model=JobResponse)
async def get_job_result(
    job_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Job).where(Job.job_id == job_id))
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")

    return await _build_job_response(job, db)

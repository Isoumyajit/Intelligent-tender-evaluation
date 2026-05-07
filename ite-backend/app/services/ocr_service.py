import logging
import traceback
from uuid import UUID

from sqlalchemy import select

from app.database import async_session
from app.models import Attachment
from app.services.ocr_processor import OCRProcessor, SarvamOCRProcessor

logger = logging.getLogger("ite.ocr_service")

_processor: OCRProcessor = SarvamOCRProcessor()


def set_ocr_processor(processor: OCRProcessor) -> None:
    """Swap the active OCR processor at runtime."""
    global _processor
    _processor = processor
    logger.info("OCR processor changed to %s", type(processor).__name__)


async def run_ocr(attachment_ref_id: UUID) -> None:
    async with async_session() as db:
        try:
            result = await db.execute(
                select(Attachment).where(Attachment.attachment_ref_id == attachment_ref_id)
            )
            attachment = result.scalar_one_or_none()
            if not attachment:
                logger.error("OCR: attachment %s not found", attachment_ref_id)
                return

            attachment.ocr_status = "processing"
            await db.commit()

            ocr_result = await _processor.process(
                file_name=attachment.file_name,
                content_type=attachment.content_type,
                data=attachment.data,
            )

            logger.info(
                "OCR completed for attachment %s: %d words, %d pages",
                attachment_ref_id, ocr_result.word_count, ocr_result.page_count,
            )

            attachment.ocr_text = ocr_result.text
            attachment.ocr_status = "completed"
            await db.commit()

        except Exception:
            logger.error(
                "OCR failed for attachment %s:\n%s",
                attachment_ref_id, traceback.format_exc(),
            )
            try:
                attachment.ocr_status = "failed"
                await db.commit()
            except Exception:
                logger.error(
                    "Could not mark attachment %s as failed:\n%s",
                    attachment_ref_id, traceback.format_exc(),
                )

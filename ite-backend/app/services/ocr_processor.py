import io
import logging
import os
import re
import zipfile
from abc import ABC, abstractmethod
from dataclasses import dataclass

import httpx
from sarvamai import SarvamAI

from app.config import settings

logger = logging.getLogger("ite.ocr_processor")


@dataclass
class OCRResult:
    text: str
    word_count: int
    page_count: int


class OCRProcessor(ABC):
    @abstractmethod
    async def process(self, file_name: str, content_type: str, data: bytes) -> OCRResult:
        ...


class MockOCRProcessor(OCRProcessor):
    """Decodes attachment bytes as UTF-8 text and counts words.
    Replace with a real OCR provider (Tesseract, Azure, Google Vision, etc.).
    """

    async def process(self, file_name: str, content_type: str, data: bytes) -> OCRResult:
        # TODO: Replace with real OCR logic
        try:
            text = "some mock data for testing OCR" # data.decode("utf-8", errors="replace")
        except Exception:
            text = "some mock data for testing OCR"

        words = text.split()
        word_count = len(words)
        page_count = max(1, text.count("\f") + 1)

        preview = " ".join(words[:100])
        logger.info(
            "MockOCR processed '%s' (%s): %d words, %d pages — preview: %s",
            file_name, content_type, word_count, page_count, preview,
        )

        return OCRResult(text=text, word_count=word_count, page_count=page_count)


class SarvamOCRProcessor(OCRProcessor):
    """Uses Sarvam Document Intelligence API for real OCR."""

    def __init__(self, language: str = "en-IN", output_format: str = "md"):
        self._language = language
        self._output_format = output_format

    async def process(self, file_name: str, content_type: str, data: bytes) -> OCRResult:
        if not settings.sarvam_api_key:
            raise RuntimeError("SARVAM_API_KEY is not configured")

        client = SarvamAI(api_subscription_key=settings.sarvam_api_key)

        job = client.document_intelligence.create_job(
            language=self._language,
            output_format=self._output_format,
        )
        logger.info("Sarvam OCR job created: %s for file '%s'", job.job_id, file_name)

        upload_response = client.document_intelligence.get_upload_links(
            job_id=job.job_id, files=[file_name],
        )
        if not upload_response.upload_urls:
            raise ValueError("Sarvam returned no upload URL")

        file_details = upload_response.upload_urls.get(file_name)
        if not file_details:
            raise ValueError(f"No upload URL for file: {file_name}")

        ext = os.path.splitext(file_name)[1].lower()
        ct_map = {
            ".pdf": "application/pdf",
            ".png": "image/png",
            ".jpg": "image/jpeg",
            ".jpeg": "image/jpeg",
            ".zip": "application/zip",
        }
        upload_ct = ct_map.get(ext, content_type)

        resp = httpx.put(
            file_details.file_url,
            content=data,
            headers={
                "Content-Type": upload_ct,
                "x-ms-blob-type": "BlockBlob",
            },
            timeout=300.0,
        )
        resp.raise_for_status()
        logger.info("Sarvam OCR file uploaded for job %s", job.job_id)

        job.start()
        logger.info("Sarvam OCR job %s started, waiting for completion...", job.job_id)

        status = job.wait_until_complete(poll_interval=3.0, timeout=300.0)
        logger.info("Sarvam OCR job %s finished with state: %s", job.job_id, status.job_state)

        if status.job_state == "Failed":
            raise RuntimeError(f"Sarvam OCR job {job.job_id} failed")

        metrics = job.get_page_metrics()
        page_count = metrics.get("total_pages", 1) if metrics else 1

        download_response = client.document_intelligence.get_download_links(job.job_id)
        if not download_response.download_urls:
            raise ValueError("Sarvam returned no download URL")

        first_filename = next(iter(download_response.download_urls.keys()))
        download_url = download_response.download_urls[first_filename].file_url

        dl_resp = httpx.get(download_url, timeout=300.0)
        dl_resp.raise_for_status()

        text = self._extract_text_from_zip(dl_resp.content)

        words = text.split()
        word_count = len(words)

        preview = " ".join(words[:1000])
        logger.info(
            "SarvamOCR processed '%s': %d words, %d pages — preview: %s",
            file_name, word_count, page_count, text,
        )

        return OCRResult(text=text, word_count=word_count, page_count=page_count)

    @staticmethod
    def _extract_text_from_zip(zip_bytes: bytes) -> str:
        """Extract text from the output ZIP and strip markdown syntax to plain words."""
        text_parts: list[str] = []
        with zipfile.ZipFile(io.BytesIO(zip_bytes)) as zf:
            for name in sorted(zf.namelist()):
                if name.endswith((".md", ".txt", ".html")):
                    raw = zf.read(name).decode("utf-8", errors="replace")
                    text_parts.append(SarvamOCRProcessor._strip_markup(raw))
        return "\n\n".join(text_parts)

    @staticmethod
    def _strip_markup(text: str) -> str:
        """Remove HTML tags and markdown formatting, returning plain text."""
        # --- HTML ---
        text = re.sub(r"<img[^>]*>", "", text, flags=re.IGNORECASE)
        text = re.sub(r"!\[([^\]]*)\]\([^)]+\)", "", text)
        text = re.sub(r"<br\s*/?>", "\n", text, flags=re.IGNORECASE)
        text = re.sub(r"</(p|div|tr|li|h[1-6])>", "\n", text, flags=re.IGNORECASE)
        text = re.sub(r"</(td|th)>", " ", text, flags=re.IGNORECASE)
        text = re.sub(r"<[^>]+>", "", text)
        text = re.sub(r"&nbsp;", " ", text)
        text = re.sub(r"&amp;", "&", text)
        text = re.sub(r"&lt;", "<", text)
        text = re.sub(r"&gt;", ">", text)
        text = re.sub(r"&#?\w+;", "", text)

        # --- Markdown ---
        text = re.sub(r"^#{1,6}\s+", "", text, flags=re.MULTILINE)
        text = re.sub(r"\*\*(.+?)\*\*", r"\1", text)
        text = re.sub(r"\*(.+?)\*", r"\1", text)
        text = re.sub(r"__(.+?)__", r"\1", text)
        text = re.sub(r"_(.+?)_", r"\1", text)
        text = re.sub(r"~~(.+?)~~", r"\1", text)
        text = re.sub(r"`(.+?)`", r"\1", text)
        text = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", text)
        text = re.sub(r"^[>\s]*>\s?", "", text, flags=re.MULTILINE)
        text = re.sub(r"^[-*+]\s+", "", text, flags=re.MULTILINE)
        text = re.sub(r"^\d+\.\s+", "", text, flags=re.MULTILINE)
        text = re.sub(r"^---+$", "", text, flags=re.MULTILINE)
        text = re.sub(r"\|", " ", text)
        text = re.sub(r"^[\s:-]+$", "", text, flags=re.MULTILINE)

        # --- Cleanup whitespace ---
        text = re.sub(r"[ \t]+", " ", text)
        text = re.sub(r"\n{3,}", "\n\n", text)
        return text.strip()

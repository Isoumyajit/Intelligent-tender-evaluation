"""Document synthesis for a bidder — derived from criteria evidence.

Matches the frontend's MockBidderRepository.listDocuments: every unique
document_name referenced across the bidder's criteria becomes a document
entry, with synthesised size/date/mime/category.
"""

from datetime import date, timedelta
from typing import Any

from .criteria import build_criteria


_MIME_MAP = {
    ".pdf": "application/pdf",
    ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ".xls": "application/vnd.ms-excel",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".doc": "application/msword",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
}


def _mime(name: str) -> str:
    low = name.lower()
    for ext, mime in _MIME_MAP.items():
        if low.endswith(ext):
            return mime
    return "application/octet-stream"


def _pseudo_size(name: str, salt: str) -> int:
    seed = sum(ord(c) for c in name + salt)
    return 120 * 1024 + (seed * 7919) % (12 * 1024 * 1024)


def _pseudo_pages(name: str, salt: str) -> int | None:
    low = name.lower()
    if not any(low.endswith(x) for x in (".pdf", ".doc", ".docx", ".ppt", ".pptx")):
        return None
    seed = sum(ord(c) for c in name + salt)
    return (seed % 28) + 2


def _description(file_name: str) -> str | None:
    low = file_name.lower()
    if "financial" in low:
        return "Audited financial statement"
    if "gst" in low:
        return "GST registration certificate"
    if "pan" in low:
        return "PAN verification record"
    if "completion" in low:
        return "Project completion certificates"
    if "team" in low or "cv" in low:
        return "Key personnel CVs"
    if "equipment" in low:
        return "Equipment & fleet inventory"
    if "price" in low or "bid" in low:
        return "Priced bid document"
    if "emd" in low or "guarantee" in low:
        return "Earnest money / bank guarantee"
    if "affidavit" in low or "declaration" in low:
        return "Self-declaration affidavit"
    if "epfo" in low or "esic" in low:
        return "EPFO/ESIC compliance record"
    return None


def build_documents(bidder: dict[str, Any]) -> list[dict[str, Any]]:
    bid_id = bidder["id"]
    tender_id = bidder["tender_id"]
    submitted = date.fromisoformat(bidder["submitted_on"])

    seen: dict[str, str] = {}
    for crit in build_criteria(bidder):
        for ev in crit["evidence"]:
            if ev["document_name"] not in seen:
                seen[ev["document_name"]] = crit["category"]

    docs: list[dict[str, Any]] = []
    for idx, (file_name, category) in enumerate(seen.items()):
        docs.append(
            {
                "id": f"{bid_id}-DOC-{idx + 1}",
                "tender_id": tender_id,
                "bidder_id": bid_id,
                "file_name": file_name,
                "mime_type": _mime(file_name),
                "size_bytes": _pseudo_size(file_name, bid_id),
                "uploaded_on": (submitted - timedelta(days=idx)).isoformat(),
                "page_count": _pseudo_pages(file_name, bid_id),
                "category": category,
                "description": _description(file_name),
            }
        )
    return docs

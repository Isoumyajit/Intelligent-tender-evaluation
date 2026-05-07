import json
import logging
from dataclasses import dataclass

from app.services.llm_service import LLMMessage, chat_completion

logger = logging.getLogger("ite.classification_service")

SYSTEM_PROMPT = """You are a document classification expert. You will receive a single bidder document (file name and text content) and a list of tender criteria categories.

Your task: classify this document into the SINGLE most relevant criteria category.

Rules:
1. Pick the one category that best matches the document's content.
2. If the document covers multiple categories, pick the dominant one.
3. If the document does not clearly fit any category, assign it to the closest match.
4. Return ONLY the category name as a plain string. No explanation, no quotes, no JSON, no markdown."""

USER_PROMPT_TEMPLATE = """Categories: {categories}

Document file name: {file_name}

Document content:
{text}

Which single category does this document belong to? Return only the category name."""


@dataclass
class DocumentInfo:
    file_name: str
    text: str


async def classify_documents(
    documents: list[DocumentInfo],
    categories: list[str],
) -> dict[str, str]:
    """Classify each document into one of the given criteria categories using one LLM call per document."""
    if not documents or not categories:
        return {}

    categories_lower = [c.lower() for c in categories]
    classification: dict[str, str] = {}

    logger.info(
        "Classifying %d documents (one call each) into categories: %s",
        len(documents), categories,
    )

    for doc in documents:
        messages = [
            LLMMessage(role="system", content=SYSTEM_PROMPT),
            LLMMessage(
                role="user",
                content=USER_PROMPT_TEMPLATE.format(
                    categories=json.dumps(categories),
                    file_name=doc.file_name,
                    text=doc.text[:4000],
                ),
            ),
        ]

        response = await chat_completion(messages=messages, temperature=0.1, max_tokens=64)
        category = _parse_category(response.content, categories_lower)

        classification[doc.file_name] = category
        logger.info("Classified '%s' -> '%s'", doc.file_name, category)

    logger.info("Final classification: %s", classification)
    return classification


def _parse_category(raw: str, valid_categories: list[str]) -> str:
    """Extract a single category name from the LLM response."""
    text = raw.strip().strip('"').strip("'").lower()

    if text in valid_categories:
        return text

    for cat in valid_categories:
        if cat in text:
            return cat

    return text

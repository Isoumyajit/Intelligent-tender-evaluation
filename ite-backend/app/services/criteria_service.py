import json
import logging
import re

from app.schemas import CriteriaGroup
from app.services.llm_service import LLMMessage, chat_completion

logger = logging.getLogger("ite.criteria_service")

SYSTEM_PROMPT = """You are an expert tender document analyst. Your task is to extract all bidder eligibility criteria from a tender document and group them by category.

Return a JSON array where each element represents a criteria category with its evaluation conditions.

Each element must have exactly these fields:
- "criteria": the category name — one of "financial", "technical", "compliance", "certification", "legal", "experience"
- "evaluation_conditions": an array of conditions under this category, where each condition has:
  - "name": a short kebab-case slug identifying the condition (e.g. "gst-registration", "bank-balance", "quality-assurance-plan")
  - "predicate": a clear statement describing what the bidder must satisfy or provide for this condition
  - "mandatory": true if this condition is explicitly required and the bid will be rejected without it; false if it is optional, preferred, or provides additional scoring advantage

Rules:
1. Extract EVERY eligibility requirement mentioned in the document — documents to submit, certifications needed, financial conditions, technical qualifications, legal declarations, experience requirements.
2. Group related conditions under the most appropriate criteria category.
3. Each predicate must be a distinct, actionable requirement written as a clear evaluation statement, with proper values for evaluation.
4. Do NOT include procedural instructions (how to upload, portal usage, etc.) — only substantive eligibility requirements.
5. Only include a criteria category if it has at least one evaluation condition.
6. Return ONLY a JSON array. No explanation, no markdown fences, no additional text. The response must start with [ and end with ]."""

USER_PROMPT_TEMPLATE = """Extract all bidder eligibility criteria from the following tender document:

{document_text}"""


def _build_document_text(pages: list[str]) -> str:
    if len(pages) == 1:
        return pages[0]
    sections = []
    for i, page in enumerate(pages, start=1):
        sections.append(f"--- Page {i} ---\n{page}")
    return "\n\n".join(sections)


def _parse_criteria_json(raw: str) -> list[dict]:
    text = raw.strip()

    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    match = re.search(r"\[.*\]", text, re.DOTALL)
    if match:
        try:
            return json.loads(match.group())
        except json.JSONDecodeError:
            pass

    raise ValueError(f"Could not parse criteria JSON from LLM response: {text[:200]}...")


async def extract_criteria(pages: list[str]) -> list[CriteriaGroup]:
    if not pages:
        return []

    document_text = _build_document_text(pages)

    logger.info("Extracting criteria from tender document (%d pages, %d chars)",
                len(pages), len(document_text))

    messages = [
        LLMMessage(role="system", content=SYSTEM_PROMPT),
        LLMMessage(role="user", content=USER_PROMPT_TEMPLATE.format(document_text=document_text)),
    ]

    response = await chat_completion(messages=messages, temperature=0.1)

    parsed = _parse_criteria_json(response.content)

    criteria_groups = [CriteriaGroup(**item) for item in parsed]
    logger.info("Extracted %d criteria groups from tender document", len(criteria_groups))
    for group in criteria_groups:
        for cond in group.evaluation_conditions:
            logger.info(
                "LLM criterion: [%s] %s (mandatory=%s) — %s",
                group.criteria, cond.name, cond.mandatory, cond.predicate,
            )

    return criteria_groups

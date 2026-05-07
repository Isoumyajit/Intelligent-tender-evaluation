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


def _strip_trailing_commas(text: str) -> str:
    """Remove trailing commas before } or ] that make JSON invalid."""
    return re.sub(r",\s*([}\]])", r"\1", text)


def _parse_criteria_json(raw: str) -> list[dict]:
    text = raw.strip()

    # Strip markdown code fences the LLM sometimes wraps around the JSON
    text = re.sub(r"^```(?:json)?\s*\n?", "", text)
    text = re.sub(r"\n?```\s*$", "", text)
    text = text.strip()

    for candidate in [text, _strip_trailing_commas(text)]:
        try:
            return json.loads(candidate)
        except json.JSONDecodeError:
            pass

    match = re.search(r"\[.*\]", text, re.DOTALL)
    if match:
        extracted = match.group()
        for candidate in [extracted, _strip_trailing_commas(extracted)]:
            try:
                return json.loads(candidate)
            except json.JSONDecodeError:
                pass

    raise ValueError(f"Could not parse criteria JSON from LLM response: {text[:200]}...")


MIN_EXPECTED_CONDITIONS = 3
MAX_RETRIES = 3


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

    best_groups: list[CriteriaGroup] = []
    best_count = 0

    for attempt in range(1, MAX_RETRIES + 1):
        temp = 0.1 + (attempt - 1) * 0.1
        logger.info("Criteria extraction attempt %d/%d (temperature=%.2f)",
                     attempt, MAX_RETRIES, temp)

        try:
            response = await chat_completion(messages=messages, temperature=temp)
            parsed = _parse_criteria_json(response.content)
            groups = [CriteriaGroup(**item) for item in parsed]
            total_conditions = sum(len(g.evaluation_conditions) for g in groups)

            logger.info("Attempt %d: extracted %d groups, %d conditions",
                        attempt, len(groups), total_conditions)

            if total_conditions > best_count:
                best_groups = groups
                best_count = total_conditions

            if total_conditions >= MIN_EXPECTED_CONDITIONS:
                break

            logger.warning(
                "Only %d conditions extracted (minimum %d). Retrying...",
                total_conditions, MIN_EXPECTED_CONDITIONS,
            )
        except Exception as exc:
            logger.warning("Attempt %d failed: %s", attempt, exc)
            if attempt == MAX_RETRIES and best_count == 0:
                raise

    logger.info("Final result: %d criteria groups, %d total conditions",
                len(best_groups), best_count)
    for group in best_groups:
        for cond in group.evaluation_conditions:
            logger.info(
                "LLM criterion: [%s] %s (mandatory=%s) — %s",
                group.criteria, cond.name, cond.mandatory, cond.predicate,
            )

    return best_groups

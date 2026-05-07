import json
import logging
import re
from dataclasses import dataclass

from app.services.llm_service import LLMMessage, chat_completion

logger = logging.getLogger("ite.evidence_service")

SYSTEM_PROMPT = """You are an expert tender evaluation analyst. You will receive bidder document text and a list of evaluation conditions for a specific criteria category.

For EACH evaluation condition, determine whether the bidder's documents satisfy it.

For each condition return:
- "condition_name": the condition's name (exactly as given)
- "verdict": one of "met", "not_met", or "partial"
  - "met": the document clearly satisfies the condition with supporting evidence
  - "not_met": the document does not contain information satisfying this condition, or the information contradicts the requirement
  - "partial": the document contains some relevant information but it is incomplete or unclear
- "evidence": a concise explanation citing specific facts, values, or quotes from the document that support your verdict. If not_met, explain what is missing.
- "source_file": the file name where evidence was found (or null if not_met)
- "page_index": 0-based page index where evidence was found (default 0)

Rules:
1. Evaluate EVERY condition — do not skip any.
2. Be precise and factual — cite specific numbers, dates, and document references.
3. Return ONLY a JSON array. No explanation, no markdown fences. The response must start with [ and end with ]."""

USER_PROMPT_TEMPLATE = """Criteria category: {criteria}

Evaluation conditions:
{conditions}

Bidder documents:
{documents}

Evaluate each condition against the bidder documents above."""


@dataclass
class ConditionInput:
    name: str
    predicate: str
    mandatory: bool


@dataclass
class ConditionEvidence:
    condition_name: str
    verdict: str
    evidence: str
    source_file: str | None = None
    page_index: int = 0


async def evaluate_conditions(
    conditions: list[ConditionInput],
    doc_texts: list[dict[str, str]],
    criteria: str,
) -> list[ConditionEvidence]:
    """Evaluate each condition against bidder documents using LLM."""
    if not conditions:
        return []

    conditions_text = "\n".join(
        f"- {c.name}: {c.predicate} (mandatory={c.mandatory})"
        for c in conditions
    )

    docs_text = "\n\n".join(
        f"--- {doc['file_name']} ---\n{doc['text']}"
        for doc in doc_texts
    )

    messages = [
        LLMMessage(role="system", content=SYSTEM_PROMPT),
        LLMMessage(
            role="user",
            content=USER_PROMPT_TEMPLATE.format(
                criteria=criteria,
                conditions=conditions_text,
                documents=docs_text if docs_text.strip() else "(No documents provided for this category)",
            ),
        ),
    ]

    logger.info(
        "Evaluating %d conditions for criteria '%s' against %d documents",
        len(conditions), criteria, len(doc_texts),
    )

    response = await chat_completion(messages=messages, temperature=0.1, max_tokens=4096)

    parsed = _parse_evidence_json(response.content)

    results = []
    for item in parsed:
        ce = ConditionEvidence(
            condition_name=item.get("condition_name", ""),
            verdict=item.get("verdict", "not_met"),
            evidence=item.get("evidence", ""),
            source_file=item.get("source_file"),
            page_index=item.get("page_index", 0),
        )
        logger.info(
            "  %s -> %s | evidence: %s",
            ce.condition_name, ce.verdict, ce.evidence[:120],
        )
        results.append(ce)

    return results


def _parse_evidence_json(raw: str) -> list[dict]:
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

    raise ValueError(f"Could not parse evidence JSON from LLM response: {text[:200]}...")

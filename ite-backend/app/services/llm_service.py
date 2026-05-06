import logging
from dataclasses import dataclass

from sarvamai import SarvamAI

from app.config import settings

logger = logging.getLogger("ite.llm_service")


@dataclass
class LLMMessage:
    role: str
    content: str


@dataclass
class LLMResponse:
    content: str
    model: str
    finish_reason: str | None = None


def _get_client() -> SarvamAI:
    if not settings.sarvam_api_key:
        raise RuntimeError("SARVAM_API_KEY is not configured")
    return SarvamAI(api_subscription_key=settings.sarvam_api_key)


async def chat_completion(
    messages: list[LLMMessage],
    model: str = "sarvam-105b",
    temperature: float = 0.2,
    max_tokens: int = 4096,
) -> LLMResponse:
    client = _get_client()

    raw_messages = [{"role": m.role, "content": m.content} for m in messages]

    kwargs: dict = {
        "model": model,
        "messages": raw_messages,
        "temperature": temperature,
    }
    if max_tokens is not None:
        kwargs["max_tokens"] = max_tokens

    logger.info("LLM request: model=%s, messages=%d, temperature=%.2f",
                model, len(messages), temperature)

    response = client.chat.completions(**kwargs)

    choice = response.choices[0]
    result = LLMResponse(
        content=choice.message.content,
        model=response.model,
        finish_reason=choice.finish_reason,
    )

    logger.info("LLM response: model=%s, finish_reason=%s",
                result.model, result.finish_reason)
    logger.info("LLM response: %s", result.content)

    return result

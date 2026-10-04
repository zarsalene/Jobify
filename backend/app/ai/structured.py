import json
import re
import uuid

from pydantic import BaseModel, ValidationError

from app.ai.orchestrator import AIOrchestrator
from app.ai.providers.base import ChatMessage
from app.ai.routing.tasks import AITask
from app.core.errors import AppError

_FENCE = re.compile(r"^```(?:json)?\s*(.*?)\s*```$", re.DOTALL)


class StructuredOutputError(AppError):
    def __init__(self) -> None:
        super().__init__(
            502, "ai_invalid_output", "The AI returned an unusable answer. Please try again."
        )


def parse_json_object(text: str) -> object:
    """Parse model text as JSON, tolerating a markdown code fence around it."""
    cleaned = text.strip()
    fenced = _FENCE.match(cleaned)
    if fenced:
        cleaned = fenced.group(1)
    return json.loads(cleaned)


async def generate_structured[T: BaseModel](
    orchestrator: AIOrchestrator,
    schema: type[T],
    *,
    task: AITask,
    messages: list[ChatMessage],
    user_id: uuid.UUID,
    prompt_name: str,
    prompt_version: int,
    max_repairs: int = 1,
    max_output_tokens: int = 1024,
) -> T:
    """Never trust model JSON: validate with Pydantic, ask for one repair, then fail safely."""
    conversation = list(messages)
    for attempt in range(max_repairs + 1):
        response = await orchestrator.generate(
            task=task,
            messages=conversation,
            user_id=user_id,
            prompt_name=prompt_name,
            prompt_version=prompt_version,
            json_mode=True,
            max_output_tokens=max_output_tokens,
        )
        try:
            return schema.model_validate(parse_json_object(response.text))
        except (ValueError, ValidationError) as exc:
            if attempt == max_repairs:
                break
            problem = (
                "not valid JSON"
                if isinstance(exc, json.JSONDecodeError)
                else "valid JSON that did not match the required format"
            )
            conversation = [
                *conversation,
                ChatMessage("assistant", response.text),
                ChatMessage(
                    "user",
                    f"Your last reply was {problem}. Reply again with only one JSON object in "
                    "the required format.",
                ),
            ]
    raise StructuredOutputError

import json
import uuid
from typing import Any, Self

from pydantic import BaseModel, Field, model_validator

from app.ai.guardrails import GUARDRAIL_RULES
from app.ai.orchestrator import AIOrchestrator
from app.ai.prompts import load_prompt
from app.ai.providers.base import ChatMessage
from app.ai.routing.tasks import AITask
from app.ai.structured import generate_structured
from app.ai.tools.registry import ToolRegistry

PROMPT_NAME = "career_agent"


class ToolCall(BaseModel):
    tool: str = Field(min_length=1, max_length=64)
    args: dict[str, Any] = Field(default_factory=dict)


class AgentStep(BaseModel):
    """One model decision: call exactly one tool, or finish."""

    thought: str = Field(max_length=500)
    tool_call: ToolCall | None = None
    final_answer: str | None = Field(default=None, max_length=4000)

    @model_validator(mode="after")
    def _exactly_one_of_tool_or_answer(self) -> Self:
        if (self.tool_call is None) == (self.final_answer is None):
            raise ValueError("provide exactly one of tool_call or final_answer")
        return self


class CareerAgent:
    """The planner: turns the conversation so far into the next validated step.

    It only proposes. Running tools, permissions, approvals and limits belong to AgentService.
    """

    def __init__(self, orchestrator: AIOrchestrator, registry: ToolRegistry) -> None:
        self._orchestrator = orchestrator
        self._registry = registry
        self._prompt = load_prompt(PROMPT_NAME)

    def system_message(self) -> ChatMessage:
        text = self._prompt.render(rules=GUARDRAIL_RULES, tools=self._registry.describe())
        return ChatMessage("system", text)

    async def next_step(self, transcript: list[dict[str, str]], user_id: uuid.UUID) -> AgentStep:
        messages = [self.system_message()]
        messages += [ChatMessage(m["role"], m["content"]) for m in transcript]  # type: ignore[arg-type]
        return await generate_structured(
            self._orchestrator,
            AgentStep,
            task=AITask.AGENT_REASONING,
            messages=messages,
            user_id=user_id,
            prompt_name=self._prompt.name,
            prompt_version=self._prompt.version,
        )


def tool_result_message(tool: str, *, ok: bool, data: dict[str, Any]) -> dict[str, str]:
    """Tool output goes back to the model as data, labelled so it is not read as instructions."""
    key = "tool_result" if ok else "tool_error"
    return {"role": "user", "content": json.dumps({key: {"tool": tool, **data}})}

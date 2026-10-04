import json
import uuid
from dataclasses import dataclass, field
from typing import Any

from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.ai.providers.base import AIRequest, AIResponse, ProviderError
from app.ai.tools.base import Permission, Tool, ToolContext
from app.ai.tools.builtin import default_registry
from app.ai.tools.registry import ToolRegistry
from app.services.agent_factory import build_agent_service


class ScriptedProvider:
    """A fake model. Replays scripted replies; a ProviderError entry is raised instead."""

    name = "fake"

    def __init__(self) -> None:
        self.replies: list[str | ProviderError] = []
        self.requests: list[AIRequest] = []
        self.repeat_last = False

    def script(self, *replies: str | ProviderError, repeat_last: bool = False) -> None:
        self.replies = list(replies)
        self.repeat_last = repeat_last

    async def generate(self, request: AIRequest) -> AIResponse:
        self.requests.append(request)
        if not self.replies:
            raise AssertionError("ScriptedProvider ran out of scripted replies")
        reply = (
            self.replies[0] if self.repeat_last and len(self.replies) == 1 else self.replies.pop(0)
        )
        if isinstance(reply, ProviderError):
            raise reply
        return AIResponse(
            text=reply,
            provider=self.name,
            model=request.model,
            input_tokens=10,
            output_tokens=5,
            latency_ms=1,
        )


def tool_step(tool: str, args: dict[str, Any] | None = None) -> str:
    return json.dumps(
        {
            "thought": "next step",
            "tool_call": {"tool": tool, "args": args or {}},
            "final_answer": None,
        }
    )


def final_step(text: str) -> str:
    return json.dumps({"thought": "done", "tool_call": None, "final_answer": text})


class NoteArgs(BaseModel):
    text: str


class EmailArgs(BaseModel):
    to: str
    subject: str


@dataclass
class ToolKit:
    """Production READ tool plus a WRITE and a PUBLIC tool. `executed` proves what really ran."""

    executed: list[str] = field(default_factory=list)
    registry: ToolRegistry = field(default_factory=default_registry)

    def __post_init__(self) -> None:
        async def save_note(_: ToolContext, args: NoteArgs) -> dict[str, Any]:
            self.executed.append(f"save_note:{args.text}")
            return {"saved": True}

        async def send_email(_: ToolContext, args: EmailArgs) -> dict[str, Any]:
            self.executed.append(f"send_email:{args.to}")
            return {"sent": True}

        self.registry.register(
            Tool(
                "save_note",
                "Save a note",
                Permission.WRITE,
                NoteArgs,
                save_note,
                preview=lambda a: {"title": "Save note", "text": a.text},
            )
        )
        self.registry.register(
            Tool(
                "send_email",
                "Send an email to a recruiter",
                Permission.PUBLIC,
                EmailArgs,
                send_email,
                preview=lambda a: {"to": a.to, "subject": a.subject},
            )
        )


class ManualRunner:
    """Queues task ids and runs them only when the test asks, one at a time."""

    def __init__(
        self,
        factory: async_sessionmaker[AsyncSession],
        provider: ScriptedProvider,
        registry: ToolRegistry,
    ) -> None:
        self._factory = factory
        self._provider = provider
        self._registry = registry
        self.queue: list[uuid.UUID] = []

    def enqueue(self, task_id: uuid.UUID) -> None:
        self.queue.append(task_id)

    async def run_all(self) -> None:
        while self.queue:
            task_id = self.queue.pop(0)
            async with self._factory() as session:
                service = build_agent_service(session, self._provider, self._registry, self)
                await service.run_task(task_id)

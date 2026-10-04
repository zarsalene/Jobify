import asyncio
import logging
import uuid
from dataclasses import dataclass
from typing import Protocol

from app.ai.providers.base import (
    AIProvider,
    AIRequest,
    AIResponse,
    ChatMessage,
    ProviderError,
)
from app.ai.routing.router import ModelRouter
from app.ai.routing.tasks import AITask
from app.core.errors import AppError

logger = logging.getLogger(__name__)


class AIUnavailableError(AppError):
    def __init__(self) -> None:
        super().__init__(503, "ai_unavailable", "The AI service is temporarily unavailable")


@dataclass(frozen=True)
class UsageRecord:
    """Metadata for one provider attempt. Contains no prompt or response text."""

    request_id: uuid.UUID
    user_id: uuid.UUID | None
    task: str
    provider: str
    model: str
    prompt_name: str
    prompt_version: int
    input_tokens: int
    output_tokens: int
    latency_ms: int
    estimated_cost: float
    status: str
    error_code: str | None = None


class UsagePolicy(Protocol):
    """Per-user limits and usage recording. Implemented in the services layer."""

    async def check_allowed(self, user_id: uuid.UUID) -> None: ...

    async def record(self, record: UsageRecord) -> None: ...


class AIOrchestrator:
    """Single entry point for model calls: limits, routing, retries, fallbacks, usage tracking."""

    def __init__(
        self,
        provider: AIProvider,
        router: ModelRouter,
        policy: UsagePolicy,
        *,
        max_retries: int = 2,
        retry_backoff_seconds: float = 1.0,
        timeout_seconds: float = 60.0,
    ) -> None:
        self._provider = provider
        self._router = router
        self._policy = policy
        self._max_retries = max_retries
        self._backoff = retry_backoff_seconds
        self._timeout = timeout_seconds

    async def generate(
        self,
        *,
        task: AITask,
        messages: list[ChatMessage],
        user_id: uuid.UUID,
        prompt_name: str,
        prompt_version: int,
        json_mode: bool = False,
        max_output_tokens: int = 1024,
    ) -> AIResponse:
        await self._policy.check_allowed(user_id)

        for model in self._router.chain(task):
            request = AIRequest(
                model=model,
                messages=tuple(messages),
                json_mode=json_mode,
                max_output_tokens=max_output_tokens,
                timeout_seconds=self._timeout,
            )
            for attempt in range(self._max_retries + 1):
                try:
                    response = await self._provider.generate(request)
                except ProviderError as exc:
                    await self._record_failure(
                        user_id, task, model, prompt_name, prompt_version, exc.code
                    )
                    logger.warning("ai call failed task=%s model=%s code=%s", task, model, exc.code)
                    # A rate limit will not clear within a retry backoff: move to the next model.
                    if not exc.retryable or exc.code == "http_429":
                        break
                    if attempt < self._max_retries:
                        await asyncio.sleep(self._backoff * (2**attempt))
                    continue
                await self._policy.record(
                    UsageRecord(
                        request_id=uuid.uuid4(),
                        user_id=user_id,
                        task=task.value,
                        provider=response.provider,
                        model=response.model,
                        prompt_name=prompt_name,
                        prompt_version=prompt_version,
                        input_tokens=response.input_tokens,
                        output_tokens=response.output_tokens,
                        latency_ms=response.latency_ms,
                        estimated_cost=response.estimated_cost,
                        status="success",
                    )
                )
                return response
        raise AIUnavailableError

    async def _record_failure(
        self,
        user_id: uuid.UUID,
        task: AITask,
        model: str,
        prompt_name: str,
        prompt_version: int,
        code: str,
    ) -> None:
        await self._policy.record(
            UsageRecord(
                request_id=uuid.uuid4(),
                user_id=user_id,
                task=task.value,
                provider=self._provider.name,
                model=model,
                prompt_name=prompt_name,
                prompt_version=prompt_version,
                input_tokens=0,
                output_tokens=0,
                latency_ms=0,
                estimated_cost=0.0,
                status="error",
                error_code=code,
            )
        )

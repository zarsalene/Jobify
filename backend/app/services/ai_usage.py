import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.orchestrator import UsageRecord
from app.core.errors import AppError
from app.domain.models import AIRequestLog
from app.domain.models.base import utcnow
from app.repositories.ai_requests import AIRequestRepository


class DbUsagePolicy:
    """Per-user daily AI limit and usage recording, backed by the ai_requests table.

    Every provider attempt counts, including failed ones, because free tiers meter attempts.
    """

    def __init__(self, session: AsyncSession, daily_limit: int) -> None:
        self._session = session
        self._repo = AIRequestRepository(session)
        self._daily_limit = daily_limit

    async def check_allowed(self, user_id: uuid.UUID) -> None:
        start_of_day = utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
        if await self._repo.count_since(user_id, start_of_day) >= self._daily_limit:
            raise AppError(
                429,
                "ai_daily_limit_reached",
                "Daily AI usage limit reached. It resets at midnight UTC.",
            )

    async def record(self, record: UsageRecord) -> None:
        self._repo.add(
            AIRequestLog(
                id=record.request_id,
                user_id=record.user_id,
                task=record.task,
                provider=record.provider,
                model=record.model,
                prompt_name=record.prompt_name,
                prompt_version=record.prompt_version,
                input_tokens=record.input_tokens,
                output_tokens=record.output_tokens,
                latency_ms=record.latency_ms,
                estimated_cost=record.estimated_cost,
                status=record.status,
                error_code=record.error_code,
            )
        )
        await self._session.commit()

import uuid
from datetime import datetime

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.models import AIRequestLog


class AIRequestRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    def add(self, entry: AIRequestLog) -> None:
        self._session.add(entry)

    async def count_since(self, user_id: uuid.UUID, since: datetime) -> int:
        result = await self._session.execute(
            select(func.count())
            .select_from(AIRequestLog)
            .where(AIRequestLog.user_id == user_id, AIRequestLog.created_at >= since)
        )
        return int(result.scalar_one())

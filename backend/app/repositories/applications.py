import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.models.application import Application


class ApplicationRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    def add(self, application: Application) -> None:
        self._session.add(application)

    async def list_for_user(self, user_id: uuid.UUID) -> list[Application]:
        result = await self._session.execute(
            select(Application)
            .where(Application.user_id == user_id)
            .order_by(Application.updated_at.desc())
        )
        return list(result.scalars())

    async def get(self, user_id: uuid.UUID, application_id: uuid.UUID) -> Application | None:
        result = await self._session.execute(
            select(Application).where(
                Application.id == application_id, Application.user_id == user_id
            )
        )
        return result.scalar_one_or_none()

    async def get_for_job(self, user_id: uuid.UUID, job_id: uuid.UUID) -> Application | None:
        result = await self._session.execute(
            select(Application).where(Application.user_id == user_id, Application.job_id == job_id)
        )
        return result.scalar_one_or_none()

    async def by_job(self, user_id: uuid.UUID) -> dict[uuid.UUID, Application]:
        """The user's applications keyed by job, for marking jobs as saved in lists."""
        result = await self._session.execute(
            select(Application).where(
                Application.user_id == user_id, Application.job_id.is_not(None)
            )
        )
        return {a.job_id: a for a in result.scalars() if a.job_id is not None}

    async def delete(self, application: Application) -> None:
        await self._session.delete(application)

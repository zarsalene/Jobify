import uuid
from collections.abc import Sequence

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.models.job import Job


class JobRepository:
    """Jobs visible to a user are the shared feed plus the ones that user imported."""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    def add(self, job: Job) -> None:
        self._session.add(job)

    @staticmethod
    def _visible_to(user_id: uuid.UUID):  # type: ignore[no-untyped-def]
        return or_(Job.owner_id.is_(None), Job.owner_id == user_id)

    async def get_visible(self, user_id: uuid.UUID, job_id: uuid.UUID) -> Job | None:
        result = await self._session.execute(
            select(Job).where(Job.id == job_id, self._visible_to(user_id))
        )
        return result.scalar_one_or_none()

    async def search(
        self,
        user_id: uuid.UUID,
        *,
        text: str | None,
        work_modes: Sequence[str],
        employment_types: Sequence[str],
        seniority: Sequence[str],
        ids: Sequence[uuid.UUID] | None,
        limit: int,
    ) -> list[Job]:
        query = select(Job).where(self._visible_to(user_id))
        if text:
            like = f"%{text.strip()}%"
            query = query.where(
                or_(Job.title.ilike(like), Job.company.ilike(like), Job.summary.ilike(like))
            )
        if work_modes:
            query = query.where(Job.work_mode.in_(work_modes))
        if employment_types:
            query = query.where(Job.employment_type.in_(employment_types))
        if seniority:
            query = query.where(Job.seniority.in_(seniority))
        if ids is not None:
            query = query.where(Job.id.in_(ids))
        query = query.order_by(Job.posted_at.desc().nulls_last(), Job.created_at.desc())
        result = await self._session.execute(query.limit(limit))
        return list(result.scalars())

    async def get_by_external_ids(
        self, source_label: str, external_ids: Sequence[str]
    ) -> dict[str, Job]:
        if not external_ids:
            return {}
        result = await self._session.execute(
            select(Job).where(Job.source_label == source_label, Job.external_id.in_(external_ids))
        )
        return {job.external_id: job for job in result.scalars() if job.external_id}

    async def get_imported(self, user_id: uuid.UUID, url: str) -> Job | None:
        result = await self._session.execute(
            select(Job).where(Job.owner_id == user_id, Job.source_url == url).limit(1)
        )
        return result.scalar_one_or_none()

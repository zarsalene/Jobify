import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import ConflictError, NotFoundError
from app.domain.enums import ApplicationStatus, TimelineKind
from app.domain.models.application import Application, ApplicationEvent
from app.domain.models.base import utcnow
from app.repositories.applications import ApplicationRepository
from app.repositories.jobs import JobRepository
from app.repositories.profile import ProfileRepository
from app.schemas.applications import (
    ApplicationCreate,
    ApplicationRead,
    ApplicationUpdate,
    Reminder,
)
from app.services.matching import compute_match

_STATUS_TEXT = {
    ApplicationStatus.SAVED: "Saved",
    ApplicationStatus.PREPARING: "Started preparing",
    ApplicationStatus.APPLIED: "Marked as applied",
    ApplicationStatus.INTERVIEW: "Moved to interview",
    ApplicationStatus.OFFER: "Received an offer",
    ApplicationStatus.REJECTED: "Marked as rejected",
}


class ApplicationService:
    """The user's own pipeline. Status changes here are records the user makes; nothing is
    sent to employers from this service."""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session
        self._repo = ApplicationRepository(session)
        self._jobs = JobRepository(session)
        self._profile = ProfileRepository(session)

    async def list_all(self, user_id: uuid.UUID) -> list[ApplicationRead]:
        return [ApplicationRead.from_model(a) for a in await self._repo.list_for_user(user_id)]

    async def get(self, user_id: uuid.UUID, application_id: uuid.UUID) -> ApplicationRead:
        return ApplicationRead.from_model(await self._get(user_id, application_id))

    async def create(self, user_id: uuid.UUID, data: ApplicationCreate) -> ApplicationRead:
        job = await self._jobs.get_visible(user_id, data.job_id)
        if job is None:
            raise NotFoundError("job_not_found", "That job isn't available any more.")
        if await self._repo.get_for_job(user_id, job.id) is not None:
            raise ConflictError("already_tracked", "This job is already in your applications.")
        prefs = await self._profile.get_preferences(user_id)
        skills = await self._profile.confirmed_skills(user_id)
        match = compute_match(job, prefs, skills, utcnow())
        application = Application(
            user_id=user_id,
            job_id=job.id,
            job_title=job.title,
            company=job.company,
            location=job.location,
            status=data.status,
            match_score=match.score,
            match_level=match.level,
            applied_at=utcnow() if data.status == ApplicationStatus.APPLIED else None,
        )
        application.events = [
            ApplicationEvent(
                kind=TimelineKind.SAVED,
                text=f"Saved from {job.source_label}"
                + (
                    ""
                    if data.status == ApplicationStatus.SAVED
                    else f", {_STATUS_TEXT[data.status].lower()}"
                ),
            )
        ]
        self._repo.add(application)
        await self._session.commit()
        return ApplicationRead.from_model(application)

    async def update(
        self, user_id: uuid.UUID, application_id: uuid.UUID, data: ApplicationUpdate
    ) -> ApplicationRead:
        application = await self._get(user_id, application_id)
        if data.status is not None and data.status != application.status:
            application.status = data.status
            if data.status == ApplicationStatus.APPLIED and application.applied_at is None:
                application.applied_at = utcnow()
            application.events.append(
                ApplicationEvent(kind=TimelineKind.STATUS, text=_STATUS_TEXT[data.status])
            )
        if data.notes is not None:
            application.notes = data.notes
        application.updated_at = utcnow()
        await self._session.commit()
        return ApplicationRead.from_model(await self._get(user_id, application_id))

    async def set_reminder(
        self, user_id: uuid.UUID, application_id: uuid.UUID, reminder: Reminder | None
    ) -> ApplicationRead:
        application = await self._get(user_id, application_id)
        application.reminder_due_at = reminder.due_at if reminder else None
        application.reminder_note = reminder.note if reminder else None
        text = (
            f"Follow-up reminder set for {reminder.due_at.date().isoformat()}"
            if reminder
            else "Follow-up reminder removed"
        )
        application.events.append(ApplicationEvent(kind=TimelineKind.REMINDER, text=text))
        application.updated_at = utcnow()
        await self._session.commit()
        return ApplicationRead.from_model(await self._get(user_id, application_id))

    async def delete(self, user_id: uuid.UUID, application_id: uuid.UUID) -> None:
        application = await self._get(user_id, application_id)
        await self._repo.delete(application)
        await self._session.commit()

    async def _get(self, user_id: uuid.UUID, application_id: uuid.UUID) -> Application:
        application = await self._repo.get(user_id, application_id)
        if application is None:
            raise NotFoundError("application_not_found", "That application doesn't exist.")
        return application

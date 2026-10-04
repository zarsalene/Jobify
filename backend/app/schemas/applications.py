import uuid
from datetime import datetime

from pydantic import Field

from app.domain.enums import ApplicationStatus, MatchLevel, TimelineKind
from app.domain.models.application import Application
from app.domain.models.base import ensure_utc
from app.schemas.base import ApiModel


class TimelineEvent(ApiModel):
    id: uuid.UUID
    at: datetime
    kind: TimelineKind
    text: str


class Reminder(ApiModel):
    due_at: datetime
    note: str | None = Field(default=None, max_length=500)


class ApplicationRead(ApiModel):
    id: uuid.UUID
    job_id: uuid.UUID | None
    job_title: str
    company: str
    location: str
    status: ApplicationStatus
    created_at: datetime
    updated_at: datetime
    applied_at: datetime | None
    notes: str
    reminder: Reminder | None
    timeline: list[TimelineEvent]
    match_score: int | None
    match_level: MatchLevel | None

    @classmethod
    def from_model(cls, app: Application) -> "ApplicationRead":
        reminder = (
            Reminder(due_at=app.reminder_due_at, note=app.reminder_note)
            if app.reminder_due_at
            else None
        )
        return cls(
            id=app.id,
            job_id=app.job_id,
            job_title=app.job_title,
            company=app.company,
            location=app.location,
            status=ApplicationStatus(app.status),
            created_at=app.created_at,
            updated_at=app.updated_at,
            applied_at=app.applied_at,
            notes=app.notes,
            reminder=reminder,
            timeline=[
                TimelineEvent(id=e.id, at=e.at, kind=TimelineKind(e.kind), text=e.text)
                # Newest first. Sorted here because events appended in this request are not
                # re-ordered by the relationship's order_by until the next load.
                for e in sorted(app.events, key=lambda e: ensure_utc(e.at), reverse=True)
            ],
            match_score=app.match_score,
            match_level=MatchLevel(app.match_level) if app.match_level else None,
        )


class ApplicationCreate(ApiModel):
    job_id: uuid.UUID
    status: ApplicationStatus = ApplicationStatus.SAVED


class ApplicationUpdate(ApiModel):
    status: ApplicationStatus | None = None
    notes: str | None = Field(default=None, max_length=10_000)

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, UniqueConstraint, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.domain.models.base import Base, IdMixin, TimestampMixin, utcnow


class Application(IdMixin, TimestampMixin, Base):
    """A job in the user's pipeline, from saved through to offer or rejection.

    Title, company and location are copied from the job so the tracker still reads correctly
    if a feed job is later removed.
    """

    __tablename__ = "applications"
    __table_args__ = (UniqueConstraint("user_id", "job_id"),)

    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    job_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("jobs.id", ondelete="SET NULL"), default=None
    )
    job_title: Mapped[str] = mapped_column(String(300))
    company: Mapped[str] = mapped_column(String(300))
    location: Mapped[str] = mapped_column(String(300), default="")
    status: Mapped[str] = mapped_column(String(16))
    notes: Mapped[str] = mapped_column(Text, default="")
    applied_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), default=None)
    reminder_due_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), default=None)
    reminder_note: Mapped[str | None] = mapped_column(String(500), default=None)
    match_score: Mapped[int | None] = mapped_column(Integer, default=None)
    match_level: Mapped[str | None] = mapped_column(String(16), default=None)

    events: Mapped[list["ApplicationEvent"]] = relationship(
        back_populates="application",
        cascade="all, delete-orphan",
        order_by="ApplicationEvent.at.desc()",
        lazy="selectin",
    )


class ApplicationEvent(IdMixin, Base):
    """One line in an application's timeline."""

    __tablename__ = "application_events"

    application_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("applications.id", ondelete="CASCADE"), index=True
    )
    at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    kind: Mapped[str] = mapped_column(String(16))
    text: Mapped[str] = mapped_column(String(500))

    application: Mapped[Application] = relationship(back_populates="events")

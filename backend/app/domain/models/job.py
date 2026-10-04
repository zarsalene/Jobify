import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import JSON, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.domain.models.base import Base, IdMixin, TimestampMixin


class Job(IdMixin, TimestampMixin, Base):
    """A job posting. Feed jobs are shared (owner_id is null); imported jobs belong to one user.

    Every field the source did not state stays null. Nothing here is estimated.
    """

    __tablename__ = "jobs"
    __table_args__ = (UniqueConstraint("source_label", "external_id"),)

    owner_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="CASCADE"), index=True, default=None
    )
    source_kind: Mapped[str] = mapped_column(String(16))
    source_label: Mapped[str] = mapped_column(String(100))
    source_url: Mapped[str] = mapped_column(String(2000))
    # Stable id from the source, used to avoid duplicates when the feed refreshes.
    external_id: Mapped[str | None] = mapped_column(String(300), default=None)

    title: Mapped[str] = mapped_column(String(300))
    company: Mapped[str] = mapped_column(String(300))
    location: Mapped[str] = mapped_column(String(300), default="")
    work_mode: Mapped[str | None] = mapped_column(String(16), default=None)
    employment_type: Mapped[str | None] = mapped_column(String(16), default=None)
    seniority: Mapped[str | None] = mapped_column(String(16), default=None)

    salary_min: Mapped[int | None] = mapped_column(Integer, default=None)
    salary_max: Mapped[int | None] = mapped_column(Integer, default=None)
    salary_currency: Mapped[str | None] = mapped_column(String(3), default=None)
    salary_period: Mapped[str | None] = mapped_column(String(8), default=None)
    # Salary exactly as the posting wrote it, when it could not be read as numbers.
    salary_text: Mapped[str | None] = mapped_column(String(300), default=None)

    posted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), index=True, default=None
    )
    summary: Mapped[str] = mapped_column(Text, default="")
    description: Mapped[list[dict[str, Any]]] = mapped_column(JSON, default=list)
    skills: Mapped[list[str]] = mapped_column(JSON, default=list)

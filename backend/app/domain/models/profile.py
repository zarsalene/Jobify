import uuid
from datetime import datetime

from sqlalchemy import (
    JSON,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    LargeBinary,
    String,
    Text,
    Uuid,
)
from sqlalchemy.orm import Mapped, deferred, mapped_column

from app.domain.models.base import Base, IdMixin, TimestampMixin, utcnow


class SearchPreferences(Base):
    """What the user is looking for. One row per user; every field is optional except lists."""

    __tablename__ = "search_preferences"

    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    target_role: Mapped[str] = mapped_column(String(200), default="")
    location: Mapped[str] = mapped_column(String(200), default="")
    salary_min: Mapped[int | None] = mapped_column(Integer, default=None)
    salary_currency: Mapped[str | None] = mapped_column(String(3), default=None)
    salary_period: Mapped[str | None] = mapped_column(String(8), default=None)
    seniority: Mapped[str | None] = mapped_column(String(16), default=None)
    employment_types: Mapped[list[str]] = mapped_column(JSON, default=list)
    work_modes: Mapped[list[str]] = mapped_column(JSON, default=list)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow
    )


class CvDocument(IdMixin, Base):
    """An uploaded CV file. The bytes are deferred so listing documents never loads them."""

    __tablename__ = "cv_documents"

    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    file_name: Mapped[str] = mapped_column(String(255))
    content_type: Mapped[str] = mapped_column(String(100))
    size_bytes: Mapped[int] = mapped_column(Integer)
    content: Mapped[bytes] = deferred(mapped_column(LargeBinary, nullable=False))
    extracted_text: Mapped[str] = deferred(mapped_column(Text, default="", nullable=False))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class CvItem(IdMixin, TimestampMixin, Base):
    """One fact from the CV (a skill, a role, a degree). Only confirmed items feed matching."""

    __tablename__ = "cv_items"

    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    section: Mapped[str] = mapped_column(String(20))
    label: Mapped[str] = mapped_column(String(300))
    detail: Mapped[str | None] = mapped_column(String(500), default=None)
    confidence: Mapped[float] = mapped_column(Float, default=1.0)
    status: Mapped[str] = mapped_column(String(16))
    # "cv" when extracted from an upload, "manual" when the user typed it.
    origin: Mapped[str] = mapped_column(String(16), default="manual")

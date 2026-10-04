import uuid
from datetime import datetime
from enum import StrEnum
from typing import Any

from sqlalchemy import JSON, DateTime, ForeignKey, Integer, String, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.domain.models.base import Base, IdMixin, TimestampMixin, utcnow


class TaskStatus(StrEnum):
    QUEUED = "queued"
    RUNNING = "running"
    AWAITING_APPROVAL = "awaiting_approval"
    COMPLETED = "completed"
    FAILED = "failed"


class ActionStatus(StrEnum):
    EXECUTED = "executed"
    AWAITING_APPROVAL = "awaiting_approval"
    REJECTED = "rejected"
    EXPIRED = "expired"
    FAILED = "failed"


class ApprovalStatus(StrEnum):
    PENDING = "pending"
    EXECUTED = "executed"
    REJECTED = "rejected"
    EXPIRED = "expired"
    FAILED = "failed"


class AgentTask(IdMixin, TimestampMixin, Base):
    __tablename__ = "agent_tasks"

    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    goal: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(32), index=True, default=TaskStatus.QUEUED)
    # Conversation with the model, without the system prompt. Always reassigned, never mutated.
    transcript: Mapped[list[dict[str, str]]] = mapped_column(JSON, default=list)
    result: Mapped[str | None] = mapped_column(Text, default=None)
    error: Mapped[str | None] = mapped_column(String(64), default=None)
    steps_used: Mapped[int] = mapped_column(Integer, default=0)


class AgentAction(IdMixin, Base):
    """One tool call the agent proposed, and what became of it."""

    __tablename__ = "agent_actions"

    task_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("agent_tasks.id", ondelete="CASCADE"), index=True
    )
    step: Mapped[int] = mapped_column(Integer)
    tool: Mapped[str] = mapped_column(String(64))
    permission: Mapped[str] = mapped_column(String(16))
    args: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    status: Mapped[str] = mapped_column(String(32))
    result: Mapped[dict[str, Any] | None] = mapped_column(JSON, default=None)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class ApprovalRequest(IdMixin, Base):
    """A pending decision for the user. Nothing non-READ runs until this is approved."""

    __tablename__ = "approval_requests"

    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    task_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("agent_tasks.id", ondelete="CASCADE"), index=True
    )
    action_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("agent_actions.id", ondelete="CASCADE"), unique=True
    )
    tool: Mapped[str] = mapped_column(String(64))
    permission: Mapped[str] = mapped_column(String(16))
    preview: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    status: Mapped[str] = mapped_column(String(16), index=True, default=ApprovalStatus.PENDING)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    decided_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), default=None)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

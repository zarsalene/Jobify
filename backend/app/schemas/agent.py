import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class TaskCreate(BaseModel):
    goal: str = Field(min_length=3, max_length=2000)


class ActionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    step: int
    tool: str
    permission: str
    status: str
    result: dict[str, Any] | None


class ApprovalRead(BaseModel):
    """What the app shows on the approval screen: the action, who or what it affects, a preview."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    task_id: uuid.UUID
    tool: str
    permission: str
    status: str
    preview: dict[str, Any]
    expires_at: datetime


class TaskRead(BaseModel):
    id: uuid.UUID
    goal: str
    status: str
    result: str | None
    error: str | None
    steps_used: int
    created_at: datetime
    actions: list[ActionRead] = []
    pending_approval: ApprovalRead | None = None

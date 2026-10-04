import uuid
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from enum import StrEnum
from typing import Any

from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession


class Permission(StrEnum):
    """What a tool may do. Only READ tools run without the user's approval."""

    READ = "read"
    WRITE = "write"
    PUBLIC = "public"
    DESTRUCTIVE = "destructive"


@dataclass(frozen=True)
class ToolContext:
    user_id: uuid.UUID
    session: AsyncSession


ToolHandler = Callable[[ToolContext, Any], Awaitable[dict[str, Any]]]
ToolPreview = Callable[[Any], dict[str, Any]]


@dataclass(frozen=True)
class Tool:
    """A capability the agent can propose. The agent never executes tools itself."""

    name: str
    description: str
    permission: Permission
    args_model: type[BaseModel]
    handler: ToolHandler
    # Human-readable summary shown on the approval screen for non-READ tools.
    preview: ToolPreview | None = None

    @property
    def requires_approval(self) -> bool:
        return self.permission is not Permission.READ

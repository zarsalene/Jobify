"""Tools available to the agent today.

More tools register here as their milestones land (job search, CV analysis, applications, email).
Each new tool needs an explicit Permission; anything that changes data or contacts someone is
WRITE or above, so it waits for the user's approval.
"""

from typing import Any

from pydantic import BaseModel

from app.ai.tools.base import Permission, Tool, ToolContext
from app.ai.tools.registry import ToolRegistry
from app.repositories.users import UserRepository


class NoArgs(BaseModel):
    pass


async def _get_user_profile(ctx: ToolContext, _: Any) -> dict[str, Any]:
    user = await UserRepository(ctx.session).get_by_id(ctx.user_id)
    if user is None:
        return {"found": False}
    return {"found": True, "full_name": user.full_name}


def default_registry() -> ToolRegistry:
    registry = ToolRegistry()
    registry.register(
        Tool(
            name="get_user_profile",
            description="Get the user's basic profile (name). Richer profile data arrives later.",
            permission=Permission.READ,
            args_model=NoArgs,
            handler=_get_user_profile,
        )
    )
    return registry

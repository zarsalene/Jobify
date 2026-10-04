from typing import Any

from fastapi import APIRouter, status
from pydantic import Field

from app.api.deps import AccountServiceDep, CurrentUser
from app.schemas.base import ApiModel

router = APIRouter(prefix="/users/me", tags=["account"])


class DeleteAccountRequest(ApiModel):
    password: str = Field(max_length=128)


@router.get("/export")
async def export_data(user: CurrentUser, service: AccountServiceDep) -> dict[str, Any]:
    """Everything stored about the caller, as JSON."""
    return await service.export(user)


@router.post("/delete", status_code=status.HTTP_204_NO_CONTENT)
async def delete_account(
    data: DeleteAccountRequest, user: CurrentUser, service: AccountServiceDep
) -> None:
    """Permanently delete the account and its data. Needs the password again.

    A POST rather than DELETE because some clients and proxies drop DELETE bodies.
    """
    await service.delete(user, data.password)

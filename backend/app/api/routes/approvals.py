import uuid

from fastapi import APIRouter

from app.api.deps import AgentServiceDep, CurrentUser
from app.schemas.agent import ApprovalRead

router = APIRouter(prefix="/approvals", tags=["approvals"])


@router.get("", response_model=list[ApprovalRead])
async def list_pending(user: CurrentUser, service: AgentServiceDep) -> list[ApprovalRead]:
    approvals = await service.list_pending_approvals(user.id)
    return [ApprovalRead.model_validate(a) for a in approvals]


@router.post("/{approval_id}/approve", response_model=ApprovalRead)
async def approve(
    approval_id: uuid.UUID, user: CurrentUser, service: AgentServiceDep
) -> ApprovalRead:
    """The backend performs the action only after this call. The AI cannot approve itself."""
    return ApprovalRead.model_validate(await service.approve(user.id, approval_id))


@router.post("/{approval_id}/reject", response_model=ApprovalRead)
async def reject(
    approval_id: uuid.UUID, user: CurrentUser, service: AgentServiceDep
) -> ApprovalRead:
    return ApprovalRead.model_validate(await service.reject(user.id, approval_id))

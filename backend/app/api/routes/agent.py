import uuid

from fastapi import APIRouter, status

from app.api.deps import AgentServiceDep, CurrentUser
from app.schemas.agent import ActionRead, ApprovalRead, TaskCreate, TaskRead
from app.services.agent_service import TaskDetail

router = APIRouter(prefix="/agent/tasks", tags=["agent"])


def _to_read(detail: TaskDetail) -> TaskRead:
    task = detail.task
    return TaskRead(
        id=task.id,
        goal=task.goal,
        status=task.status,
        result=task.result,
        error=task.error,
        steps_used=task.steps_used,
        created_at=task.created_at,
        actions=[ActionRead.model_validate(a) for a in detail.actions],
        pending_approval=(
            ApprovalRead.model_validate(detail.pending_approval)
            if detail.pending_approval
            else None
        ),
    )


@router.post("", response_model=TaskRead, status_code=status.HTTP_202_ACCEPTED)
async def create_task(data: TaskCreate, user: CurrentUser, service: AgentServiceDep) -> TaskRead:
    """Start a task. It runs in the background: poll GET /agent/tasks/{id} for progress."""
    task = await service.create_task(user, data.goal)
    return _to_read(await service.get_task_detail(user.id, task.id))


@router.get("", response_model=list[TaskRead])
async def list_tasks(user: CurrentUser, service: AgentServiceDep) -> list[TaskRead]:
    tasks = await service.list_tasks(user.id)
    return [_to_read(await service.get_task_detail(user.id, t.id)) for t in tasks]


@router.get("/{task_id}", response_model=TaskRead)
async def get_task(task_id: uuid.UUID, user: CurrentUser, service: AgentServiceDep) -> TaskRead:
    return _to_read(await service.get_task_detail(user.id, task_id))

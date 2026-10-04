import uuid

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.models import (
    AgentAction,
    AgentTask,
    ApprovalRequest,
    ApprovalStatus,
    TaskStatus,
)

_ACTIVE = (TaskStatus.QUEUED, TaskStatus.RUNNING, TaskStatus.AWAITING_APPROVAL)


class AgentRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    def add(self, entity: AgentTask | AgentAction | ApprovalRequest) -> None:
        self._session.add(entity)

    async def get_task(self, task_id: uuid.UUID) -> AgentTask | None:
        return await self._session.get(AgentTask, task_id)

    async def get_user_task(self, user_id: uuid.UUID, task_id: uuid.UUID) -> AgentTask | None:
        task = await self.get_task(task_id)
        return task if task and task.user_id == user_id else None

    async def list_tasks(self, user_id: uuid.UUID, limit: int = 20) -> list[AgentTask]:
        result = await self._session.execute(
            select(AgentTask)
            .where(AgentTask.user_id == user_id)
            .order_by(AgentTask.created_at.desc())
            .limit(limit)
        )
        return list(result.scalars())

    async def count_active_tasks(self, user_id: uuid.UUID) -> int:
        result = await self._session.execute(
            select(func.count())
            .select_from(AgentTask)
            .where(AgentTask.user_id == user_id, AgentTask.status.in_(_ACTIVE))
        )
        return int(result.scalar_one())

    async def list_actions(self, task_id: uuid.UUID) -> list[AgentAction]:
        result = await self._session.execute(
            select(AgentAction).where(AgentAction.task_id == task_id).order_by(AgentAction.step)
        )
        return list(result.scalars())

    async def get_action(self, action_id: uuid.UUID) -> AgentAction | None:
        return await self._session.get(AgentAction, action_id)

    async def get_user_approval(
        self, user_id: uuid.UUID, approval_id: uuid.UUID
    ) -> ApprovalRequest | None:
        approval = await self._session.get(ApprovalRequest, approval_id)
        return approval if approval and approval.user_id == user_id else None

    async def list_pending_approvals(self, user_id: uuid.UUID) -> list[ApprovalRequest]:
        result = await self._session.execute(
            select(ApprovalRequest)
            .where(
                ApprovalRequest.user_id == user_id,
                ApprovalRequest.status == ApprovalStatus.PENDING,
            )
            .order_by(ApprovalRequest.created_at)
        )
        return list(result.scalars())

    async def get_pending_approval_for_task(self, task_id: uuid.UUID) -> ApprovalRequest | None:
        result = await self._session.execute(
            select(ApprovalRequest).where(
                ApprovalRequest.task_id == task_id,
                ApprovalRequest.status == ApprovalStatus.PENDING,
            )
        )
        return result.scalars().first()

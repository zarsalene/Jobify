import logging
import uuid
from dataclasses import dataclass
from datetime import timedelta
from typing import Protocol

from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.agents.career_agent import CareerAgent, ToolCall, tool_result_message
from app.ai.tools.base import ToolContext
from app.ai.tools.registry import ToolArgumentsError, ToolRegistry
from app.core.config import Settings
from app.core.errors import AppError, ConflictError, NotFoundError
from app.domain.models import (
    ActionStatus,
    AgentAction,
    AgentTask,
    ApprovalRequest,
    ApprovalStatus,
    TaskStatus,
    User,
)
from app.domain.models.base import ensure_utc, utcnow
from app.repositories.agent import AgentRepository

logger = logging.getLogger(__name__)


class TaskRunner(Protocol):
    """Runs agent tasks outside the request. Never make the mobile app wait for the model."""

    def enqueue(self, task_id: uuid.UUID) -> None: ...


@dataclass(frozen=True)
class TaskDetail:
    task: AgentTask
    actions: list[AgentAction]
    pending_approval: ApprovalRequest | None


class AgentService:
    """Runs the agent loop and enforces the safety model.

    The model only proposes tool calls. READ tools run immediately; every other permission level
    creates an ApprovalRequest and pauses the task. Tools run only here or on approval.
    """

    def __init__(
        self,
        session: AsyncSession,
        agent: CareerAgent,
        registry: ToolRegistry,
        runner: TaskRunner,
        settings: Settings,
    ) -> None:
        self._session = session
        self._agent = agent
        self._registry = registry
        self._runner = runner
        self._settings = settings
        self._repo = AgentRepository(session)

    # ---- tasks -----------------------------------------------------------------------------

    async def create_task(self, user: User, goal: str) -> AgentTask:
        active = await self._repo.count_active_tasks(user.id)
        if active >= self._settings.agent_max_active_tasks_per_user:
            raise AppError(
                429, "too_many_active_tasks", "Finish or wait for your running tasks first."
            )
        goal = goal.strip()
        task = AgentTask(
            user_id=user.id,
            goal=goal,
            status=TaskStatus.QUEUED,
            transcript=[{"role": "user", "content": goal}],
        )
        self._repo.add(task)
        await self._session.commit()
        self._runner.enqueue(task.id)
        return task

    async def get_task_detail(self, user_id: uuid.UUID, task_id: uuid.UUID) -> TaskDetail:
        task = await self._repo.get_user_task(user_id, task_id)
        if task is None:
            raise NotFoundError("task_not_found", "Task not found")
        return TaskDetail(
            task=task,
            actions=await self._repo.list_actions(task.id),
            pending_approval=await self._repo.get_pending_approval_for_task(task.id),
        )

    async def list_tasks(self, user_id: uuid.UUID) -> list[AgentTask]:
        return await self._repo.list_tasks(user_id)

    async def run_task(self, task_id: uuid.UUID) -> None:
        """Advance a queued task until it completes, fails, or needs the user's approval."""
        task = await self._repo.get_task(task_id)
        if task is None or task.status != TaskStatus.QUEUED:
            return
        task.status = TaskStatus.RUNNING
        await self._session.commit()
        try:
            await self._loop(task)
        except AppError as exc:
            await self._fail(task, exc.code)
        except Exception:
            logger.exception("agent task crashed task_id=%s", task_id)
            await self._fail(task, "internal_error")

    async def _loop(self, task: AgentTask) -> None:
        while True:
            if task.steps_used >= self._settings.agent_max_steps:
                await self._fail(task, "step_limit_reached")
                return
            step = await self._agent.next_step(task.transcript, task.user_id)
            task.steps_used += 1
            self._append(task, {"role": "assistant", "content": step.model_dump_json()})

            if step.final_answer is not None:
                task.status = TaskStatus.COMPLETED
                task.result = step.final_answer
                await self._session.commit()
                return

            assert step.tool_call is not None  # guaranteed by AgentStep validation
            if await self._handle_tool_call(task, step.tool_call):
                return  # paused for approval

    async def _handle_tool_call(self, task: AgentTask, call: ToolCall) -> bool:
        """Return True when the task paused for approval."""
        tool = self._registry.get(call.tool)
        if tool is None:
            self._append(
                task, tool_result_message(call.tool, ok=False, data={"error": "unknown_tool"})
            )
            await self._session.commit()
            return False
        try:
            args = self._registry.validate_args(tool, call.args).model_dump(mode="json")
        except ToolArgumentsError as exc:
            self._append(task, tool_result_message(call.tool, ok=False, data={"error": str(exc)}))
            await self._session.commit()
            return False

        action = AgentAction(
            task_id=task.id,
            step=task.steps_used,
            tool=tool.name,
            permission=tool.permission.value,
            args=args,
            status=ActionStatus.AWAITING_APPROVAL,
        )
        self._repo.add(action)

        if not tool.requires_approval:
            await self._run_action(task, action)
            await self._session.commit()
            return False

        await self._session.flush()
        preview = (
            tool.preview(tool.args_model.model_validate(args))
            if tool.preview
            else {"tool": tool.name, "args": args}
        )
        self._repo.add(
            ApprovalRequest(
                user_id=task.user_id,
                task_id=task.id,
                action_id=action.id,
                tool=tool.name,
                permission=tool.permission.value,
                preview=preview,
                status=ApprovalStatus.PENDING,
                expires_at=utcnow() + timedelta(minutes=self._settings.approval_ttl_minutes),
            )
        )
        task.status = TaskStatus.AWAITING_APPROVAL
        await self._session.commit()
        return True

    async def _run_action(self, task: AgentTask, action: AgentAction) -> None:
        tool = self._registry.get(action.tool)
        if tool is None:
            action.status = ActionStatus.FAILED
            self._append(task, tool_result_message(action.tool, ok=False, data={"error": "gone"}))
            return
        try:
            result = await self._registry.execute(
                tool, ToolContext(user_id=task.user_id, session=self._session), action.args
            )
        except Exception:
            logger.exception("tool failed tool=%s task_id=%s", tool.name, task.id)
            action.status = ActionStatus.FAILED
            self._append(
                task, tool_result_message(tool.name, ok=False, data={"error": "tool_failed"})
            )
            return
        action.status = ActionStatus.EXECUTED
        action.result = result
        self._append(task, tool_result_message(tool.name, ok=True, data={"result": result}))

    async def _fail(self, task: AgentTask, code: str) -> None:
        await self._session.rollback()
        await self._session.refresh(task)
        task.status = TaskStatus.FAILED
        task.error = code
        await self._session.commit()

    @staticmethod
    def _append(task: AgentTask, message: dict[str, str]) -> None:
        task.transcript = [*task.transcript, message]  # reassign so the change is persisted

    # ---- approvals -------------------------------------------------------------------------

    async def list_pending_approvals(self, user_id: uuid.UUID) -> list[ApprovalRequest]:
        return await self._repo.list_pending_approvals(user_id)

    async def approve(self, user_id: uuid.UUID, approval_id: uuid.UUID) -> ApprovalRequest:
        return await self._decide(user_id, approval_id, approve=True)

    async def reject(self, user_id: uuid.UUID, approval_id: uuid.UUID) -> ApprovalRequest:
        return await self._decide(user_id, approval_id, approve=False)

    async def _decide(
        self, user_id: uuid.UUID, approval_id: uuid.UUID, *, approve: bool
    ) -> ApprovalRequest:
        approval = await self._repo.get_user_approval(user_id, approval_id)
        if approval is None:
            raise NotFoundError("approval_not_found", "Approval request not found")
        if approval.status != ApprovalStatus.PENDING:
            raise ConflictError("approval_not_pending", "This request was already answered")

        task = await self._repo.get_task(approval.task_id)
        action = await self._repo.get_action(approval.action_id)
        if task is None or action is None:
            raise NotFoundError("approval_not_found", "Approval request not found")

        now = utcnow()
        approval.decided_at = now
        expired = ensure_utc(approval.expires_at) <= now

        if expired:
            approval.status = ApprovalStatus.EXPIRED
            action.status = ActionStatus.EXPIRED
            self._append(
                task, tool_result_message(action.tool, ok=False, data={"error": "approval_expired"})
            )
        elif not approve:
            approval.status = ApprovalStatus.REJECTED
            action.status = ActionStatus.REJECTED
            self._append(
                task, tool_result_message(action.tool, ok=False, data={"error": "user_rejected"})
            )
        else:
            await self._run_action(task, action)
            approval.status = (
                ApprovalStatus.EXECUTED
                if action.status == ActionStatus.EXECUTED
                else ApprovalStatus.FAILED
            )

        task.status = TaskStatus.QUEUED
        await self._session.commit()
        self._runner.enqueue(task.id)
        if expired:
            raise ConflictError("approval_expired", "This request expired and was not performed")
        return approval

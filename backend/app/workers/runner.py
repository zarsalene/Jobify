import asyncio
import logging
import uuid
from typing import ClassVar

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.ai.providers.base import AIProvider
from app.ai.tools.registry import ToolRegistry
from app.services.agent_factory import build_agent_service

logger = logging.getLogger(__name__)


class BackgroundTaskRunner:
    """Runs agent tasks in the API process's event loop, each with its own database session.

    Fits a single free-tier instance with no separate worker. The TaskRunner interface lets an
    Arq-backed runner replace this later without touching the service.
    """

    _pending: ClassVar[set[asyncio.Task[None]]] = set()

    def __init__(
        self,
        session_factory: async_sessionmaker[AsyncSession],
        provider: AIProvider,
        registry: ToolRegistry,
    ) -> None:
        self._session_factory = session_factory
        self._provider = provider
        self._registry = registry

    def enqueue(self, task_id: uuid.UUID) -> None:
        job = asyncio.create_task(self._run(task_id))
        self._pending.add(job)  # keep a reference so the task is not garbage collected
        job.add_done_callback(self._pending.discard)

    async def _run(self, task_id: uuid.UUID) -> None:
        try:
            async with self._session_factory() as session:
                await build_agent_service(session, self._provider, self._registry, self).run_task(
                    task_id
                )
        except Exception:
            logger.exception("background run failed task_id=%s", task_id)

    @classmethod
    async def drain(cls) -> None:
        """Wait for all queued runs, including ones they enqueue. Used by tests and shutdown."""
        while cls._pending:
            await asyncio.gather(*list(cls._pending))

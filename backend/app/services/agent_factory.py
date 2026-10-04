from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.agents.career_agent import CareerAgent
from app.ai.orchestrator import AIOrchestrator
from app.ai.providers.base import AIProvider
from app.ai.routing.router import ModelRouter
from app.ai.tools.registry import ToolRegistry
from app.core.config import get_settings
from app.services.agent_service import AgentService, TaskRunner
from app.services.ai_usage import DbUsagePolicy


def build_agent_service(
    session: AsyncSession,
    provider: AIProvider,
    registry: ToolRegistry,
    runner: TaskRunner,
) -> AgentService:
    """Wire the agent stack for one database session."""
    settings = get_settings()
    orchestrator = AIOrchestrator(
        provider,
        ModelRouter(settings),
        DbUsagePolicy(session, settings.ai_daily_request_limit_per_user),
        max_retries=settings.ai_max_retries,
        retry_backoff_seconds=settings.ai_retry_backoff_seconds,
        timeout_seconds=settings.ai_request_timeout_seconds,
    )
    return AgentService(session, CareerAgent(orchestrator, registry), registry, runner, settings)

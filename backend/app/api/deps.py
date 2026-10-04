from typing import Annotated

from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.providers.base import AIProvider
from app.ai.providers.openrouter import OpenRouterProvider
from app.ai.tools.builtin import default_registry
from app.ai.tools.registry import ToolRegistry
from app.core.config import get_settings
from app.core.database import SessionFactory, get_session
from app.core.errors import UnauthorizedError
from app.core.security import decode_access_token
from app.domain.models import User
from app.repositories.users import UserRepository
from app.services.account_service import AccountService
from app.services.agent_factory import build_agent_service
from app.services.agent_service import AgentService
from app.services.application_service import ApplicationService
from app.services.auth_service import AuthService
from app.services.job_service import JobService
from app.services.profile_service import ProfileService
from app.services.safe_fetch import UrlFetcher
from app.workers.runner import BackgroundTaskRunner

SessionDep = Annotated[AsyncSession, Depends(get_session)]
_bearer = HTTPBearer(auto_error=False)


def get_auth_service(session: SessionDep) -> AuthService:
    return AuthService(session)


def get_ai_provider() -> AIProvider:
    """Overridable in tests. The key is read from server settings only."""
    settings = get_settings()
    key = settings.openrouter_api_key.get_secret_value() if settings.openrouter_api_key else None
    return OpenRouterProvider(key, settings.openrouter_base_url)


def get_tool_registry() -> ToolRegistry:
    return default_registry()


def get_task_runner(
    provider: Annotated[AIProvider, Depends(get_ai_provider)],
    registry: Annotated[ToolRegistry, Depends(get_tool_registry)],
) -> BackgroundTaskRunner:
    return BackgroundTaskRunner(SessionFactory, provider, registry)


def get_agent_service(
    session: SessionDep,
    provider: Annotated[AIProvider, Depends(get_ai_provider)],
    registry: Annotated[ToolRegistry, Depends(get_tool_registry)],
    runner: Annotated[BackgroundTaskRunner, Depends(get_task_runner)],
) -> AgentService:
    return build_agent_service(session, provider, registry, runner)


async def get_current_user(
    session: SessionDep,
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)],
) -> User:
    if credentials is None:
        raise UnauthorizedError()
    user_id = decode_access_token(credentials.credentials)
    if user_id is None:
        raise UnauthorizedError("invalid_token", "Invalid or expired access token")
    user = await UserRepository(session).get_by_id(user_id)
    if user is None or not user.is_active:
        raise UnauthorizedError("invalid_token", "Invalid or expired access token")
    return user


def get_url_fetcher() -> UrlFetcher:
    """Overridable in tests so job imports never touch the real network."""
    return UrlFetcher()


def get_profile_service(session: SessionDep) -> ProfileService:
    return ProfileService(session)


def get_job_service(
    session: SessionDep, fetcher: Annotated[UrlFetcher, Depends(get_url_fetcher)]
) -> JobService:
    return JobService(session, fetcher)


def get_application_service(session: SessionDep) -> ApplicationService:
    return ApplicationService(session)


def get_account_service(session: SessionDep) -> AccountService:
    return AccountService(session)


AuthServiceDep = Annotated[AuthService, Depends(get_auth_service)]
ProfileServiceDep = Annotated[ProfileService, Depends(get_profile_service)]
JobServiceDep = Annotated[JobService, Depends(get_job_service)]
ApplicationServiceDep = Annotated[ApplicationService, Depends(get_application_service)]
AccountServiceDep = Annotated[AccountService, Depends(get_account_service)]
AgentServiceDep = Annotated[AgentService, Depends(get_agent_service)]
CurrentUser = Annotated[User, Depends(get_current_user)]

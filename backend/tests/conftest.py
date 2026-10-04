from collections.abc import AsyncIterator
from dataclasses import dataclass

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

from app.api.deps import get_ai_provider, get_task_runner, get_tool_registry
from app.core.config import get_settings
from app.core.database import get_session
from app.domain.models import Base
from app.main import create_app
from tests.fakes import ManualRunner, ScriptedProvider, ToolKit


@dataclass
class Env:
    client: AsyncClient
    provider: ScriptedProvider
    tools: ToolKit
    runner: ManualRunner
    factory: async_sessionmaker[AsyncSession]


@pytest.fixture(autouse=True)
def _no_retry_delay(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(get_settings(), "ai_retry_backoff_seconds", 0.0)


@pytest.fixture
async def env() -> AsyncIterator[Env]:
    """API client on an isolated in-memory SQLite database, with a scripted fake model."""
    engine = create_async_engine(
        "sqlite+aiosqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    factory = async_sessionmaker(engine, expire_on_commit=False)

    provider = ScriptedProvider()
    tools = ToolKit()
    runner = ManualRunner(factory, provider, tools.registry)

    async def override_session() -> AsyncIterator[AsyncSession]:
        async with factory() as session:
            yield session

    app = create_app()
    app.dependency_overrides[get_session] = override_session
    app.dependency_overrides[get_ai_provider] = lambda: provider
    app.dependency_overrides[get_tool_registry] = lambda: tools.registry
    app.dependency_overrides[get_task_runner] = lambda: runner
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield Env(c, provider, tools, runner, factory)
    await engine.dispose()


@pytest.fixture
async def client(env: Env) -> AsyncClient:
    return env.client

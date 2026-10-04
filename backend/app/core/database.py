from collections.abc import AsyncIterator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import get_settings

_settings = get_settings()
# pool_pre_ping reconnects after a free-tier database has scaled to zero and dropped connections.
engine = create_async_engine(
    _settings.database_url,
    pool_pre_ping=True,
    pool_recycle=300,
    connect_args=_settings.database_connect_args,
)
SessionFactory = async_sessionmaker(engine, expire_on_commit=False)


async def get_session() -> AsyncIterator[AsyncSession]:
    """One session per request. Services decide when to commit."""
    async with SessionFactory() as session:
        yield session

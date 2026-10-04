"""Check that DATABASE_URL works. Prints the host and server version, never the password.

Usage (from backend/):  uv run python -m scripts.check_db
"""

import asyncio
from urllib.parse import urlsplit

from sqlalchemy import text

from app.core.config import get_settings
from app.core.database import engine


async def main() -> None:
    url = urlsplit(get_settings().database_url)
    print(f"connecting to {url.hostname} / {url.path.lstrip('/')} ...")
    async with engine.connect() as conn:
        version = (await conn.execute(text("select version()"))).scalar_one()
        tables = (
            (
                await conn.execute(
                    text("select tablename from pg_tables where schemaname = 'public' order by 1")
                )
            )
            .scalars()
            .all()
        )
    print(f"ok: {version}")
    print(
        f"tables: {', '.join(tables) if tables else '(none yet, run: uv run alembic upgrade head)'}"
    )
    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())

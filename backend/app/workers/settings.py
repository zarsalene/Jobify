"""Arq worker entry point. Run with: arq app.workers.settings.WorkerSettings"""

from typing import Any

from arq import cron
from arq.connections import RedisSettings

from app.core.config import get_settings
from app.services.job_feed import run_refresh


async def ping(_: dict[str, Any]) -> str:
    """Placeholder job that proves the queue works end to end."""
    return "pong"


async def refresh_job_feed(_: dict[str, Any]) -> str:
    result = await run_refresh()
    return f"fetched {result.fetched}, new {result.created}, removed {result.removed}"


class WorkerSettings:
    functions = [ping, refresh_job_feed]
    # Remotive asks for only a few fetches a day.
    cron_jobs = [
        cron(
            "app.workers.settings.refresh_job_feed",
            hour={0, 6, 12, 18},
            minute=7,
            run_at_startup=False,
        )
    ]
    redis_settings = RedisSettings.from_dsn(get_settings().redis_url)
    max_jobs = 5
    job_timeout = 300

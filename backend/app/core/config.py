from functools import lru_cache
from typing import Any, Literal, Self
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from pydantic import SecretStr, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

_DEV_SECRET = "change-me-in-development-only-not-for-production"  # noqa: S105


def normalize_database_url(url: str) -> str:
    """Accept a provider-style Postgres URL (Neon, Supabase, Render) and make it asyncpg-ready.

    Providers hand out `postgresql://...?sslmode=require&channel_binding=require`. SQLAlchemy's
    asyncpg driver needs the `postgresql+asyncpg` scheme and `ssl=` instead of `sslmode=`.
    Non-Postgres URLs (such as SQLite in tests) pass through untouched.
    """
    parts = urlsplit(url)
    if parts.scheme not in ("postgres", "postgresql", "postgresql+asyncpg"):
        return url
    query = dict(parse_qsl(parts.query))
    sslmode = query.pop("sslmode", None)
    query.pop("channel_binding", None)
    if sslmode and "ssl" not in query:
        query["ssl"] = sslmode
    return urlunsplit(parts._replace(scheme="postgresql+asyncpg", query=urlencode(query)))


class Settings(BaseSettings):
    """Server-side configuration. Every secret and model choice lives here, never in clients."""

    # hide_input_in_errors: a bad setting must never print other settings (secrets) in the error.
    model_config = SettingsConfigDict(env_file=".env", extra="ignore", hide_input_in_errors=True)

    environment: Literal["development", "staging", "production"] = "development"
    app_name: str = "Jobify API"
    api_v1_prefix: str = "/api/v1"
    log_level: str = "INFO"

    database_url: str = "postgresql+asyncpg://jobify:jobify@localhost:5432/jobify"
    redis_url: str = "redis://localhost:6379/0"

    secret_key: str = _DEV_SECRET
    access_token_ttl_minutes: int = 15
    refresh_token_ttl_days: int = 30

    cors_origins: list[str] = []

    # AI. The key exists only on the server. Models are configuration, never hardcoded in logic.
    openrouter_api_key: SecretStr | None = None
    openrouter_base_url: str = "https://openrouter.ai/api/v1"
    ai_model_fast: str = "google/gemma-4-26b-a4b-it:free"
    ai_model_balanced: str = "qwen/qwen3.8-27b:free"
    ai_model_reasoning: str = "nvidia/nemotron-3-super-120b-a12b:free"
    ai_model_fallbacks: list[str] = ["google/gemma-4-31b-it:free", "openrouter/free"]
    # Per-task override, e.g. {"job_matching": "some/model"}. Task names: app/ai/routing/tasks.py
    ai_task_models: dict[str, str] = {}
    ai_request_timeout_seconds: float = 60.0
    ai_max_retries: int = 2
    ai_retry_backoff_seconds: float = 1.0
    ai_daily_request_limit_per_user: int = 30

    # Agent safety limits.
    agent_max_steps: int = 8
    agent_max_active_tasks_per_user: int = 3
    approval_ttl_minutes: int = 60

    @field_validator("database_url")
    @classmethod
    def _normalize_database_url(cls, value: str) -> str:
        return normalize_database_url(value)

    @property
    def database_connect_args(self) -> dict[str, Any]:
        """Driver options. Neon's pooled endpoint (PgBouncer) cannot reuse prepared statements."""
        if "-pooler" in (urlsplit(self.database_url).hostname or ""):
            return {"statement_cache_size": 0}
        return {}

    @model_validator(mode="after")
    def _require_real_secret_outside_development(self) -> Self:
        if self.environment != "development" and (
            self.secret_key == _DEV_SECRET or len(self.secret_key) < 32
        ):
            raise ValueError("SECRET_KEY must be a random value of 32+ characters")
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()

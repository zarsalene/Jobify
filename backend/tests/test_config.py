from app.core.config import Settings, normalize_database_url

NEON = "postgresql://alex:pw@ep-cool-darkness-a1b2c3d4.us-east-2.aws.neon.tech/neondb"


def test_neon_url_becomes_asyncpg_url() -> None:
    url = normalize_database_url(f"{NEON}?sslmode=require&channel_binding=require")
    assert url.startswith("postgresql+asyncpg://alex:pw@ep-cool-darkness")
    assert "ssl=require" in url
    assert "sslmode" not in url
    assert "channel_binding" not in url


def test_postgres_scheme_alias_is_accepted() -> None:
    assert normalize_database_url("postgres://u:p@host/db").startswith("postgresql+asyncpg://")


def test_already_normalized_url_is_stable() -> None:
    once = normalize_database_url(f"{NEON}?sslmode=require")
    assert normalize_database_url(once) == once


def test_sqlite_url_is_untouched() -> None:
    assert normalize_database_url("sqlite+aiosqlite://") == "sqlite+aiosqlite://"


def test_pooled_host_disables_statement_cache() -> None:
    pooled = Settings(database_url=NEON.replace("d4.us-east-2", "d4-pooler.us-east-2"))
    direct = Settings(database_url=NEON)
    assert pooled.database_connect_args == {"statement_cache_size": 0}
    assert direct.database_connect_args == {}


def test_settings_errors_never_echo_other_secrets() -> None:
    import pytest
    from pydantic import ValidationError

    with pytest.raises(ValidationError) as info:
        Settings(
            environment="production",
            secret_key="short",
            openrouter_api_key="sk-or-v1-SHOULD-NOT-APPEAR",
        )
    assert "SHOULD-NOT-APPEAR" not in str(info.value)

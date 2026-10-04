import json
import uuid

import httpx
import pytest
from pydantic import BaseModel

from app.ai.orchestrator import AIOrchestrator, AIUnavailableError, UsageRecord
from app.ai.prompts import load_prompt
from app.ai.providers.base import AIRequest, ChatMessage, ProviderError
from app.ai.providers.openrouter import OpenRouterProvider
from app.ai.routing.router import ModelRouter
from app.ai.routing.tasks import AITask
from app.ai.structured import StructuredOutputError, generate_structured
from app.core.config import Settings
from tests.fakes import ScriptedProvider

USER = uuid.uuid4()


class ListPolicy:
    def __init__(self) -> None:
        self.records: list[UsageRecord] = []

    async def check_allowed(self, user_id: uuid.UUID) -> None:
        return None

    async def record(self, record: UsageRecord) -> None:
        self.records.append(record)


class Match(BaseModel):
    score: int
    summary: str


def make(provider: ScriptedProvider, *, retries: int = 1) -> tuple[AIOrchestrator, ListPolicy]:
    policy = ListPolicy()
    settings = Settings(ai_model_fast="m-fast", ai_model_fallbacks=["m-backup"])
    orch = AIOrchestrator(
        provider, ModelRouter(settings), policy, max_retries=retries, retry_backoff_seconds=0
    )
    return orch, policy


async def ask(orch: AIOrchestrator, task: AITask = AITask.JOB_CLASSIFICATION) -> str:
    response = await orch.generate(
        task=task,
        messages=[ChatMessage("user", "hi")],
        user_id=USER,
        prompt_name="t",
        prompt_version=1,
    )
    return response.text


# ---- routing -------------------------------------------------------------------------------


def test_router_uses_tier_model_then_fallbacks_without_duplicates() -> None:
    settings = Settings(ai_model_fast="a", ai_model_balanced="b", ai_model_fallbacks=["c", "a"])
    router = ModelRouter(settings)
    assert router.chain(AITask.JOB_CLASSIFICATION) == ["a", "c"]
    assert router.chain(AITask.JOB_MATCHING) == ["b", "c", "a"]


def test_router_per_task_override_wins() -> None:
    settings = Settings(ai_task_models={"cover_letter": "special"}, ai_model_fallbacks=[])
    assert ModelRouter(settings).chain(AITask.COVER_LETTER) == ["special"]


# ---- prompts -------------------------------------------------------------------------------


def test_prompt_is_versioned_and_renders_rules_and_tools() -> None:
    prompt = load_prompt("career_agent")
    assert prompt.version == 1
    text = prompt.render(rules="RULES-HERE", tools="TOOLS-HERE")
    assert "RULES-HERE" in text and "TOOLS-HERE" in text


# ---- orchestrator --------------------------------------------------------------------------


async def test_retries_transient_error_then_succeeds_and_records_both_attempts() -> None:
    provider = ScriptedProvider()
    provider.script(ProviderError("http_503", retryable=True), "ok")
    orch, policy = make(provider)
    assert await ask(orch) == "ok"
    assert [r.status for r in policy.records] == ["error", "success"]
    assert policy.records[0].error_code == "http_503"
    assert policy.records[1].input_tokens == 10
    assert [r.model for r in provider.requests] == ["m-fast", "m-fast"]  # retried the same model


async def test_rate_limit_moves_to_next_model_without_retrying() -> None:
    provider = ScriptedProvider()
    provider.script(ProviderError("http_429", retryable=True), "from backup")
    orch, _ = make(provider)
    assert await ask(orch) == "from backup"
    assert [r.model for r in provider.requests] == ["m-fast", "m-backup"]


async def test_non_retryable_error_falls_back_to_next_model() -> None:
    provider = ScriptedProvider()
    provider.script(ProviderError("http_400", retryable=False), "from backup")
    orch, _ = make(provider)
    assert await ask(orch) == "from backup"
    assert [r.model for r in provider.requests] == ["m-fast", "m-backup"]


async def test_all_models_failing_raises_safe_error() -> None:
    provider = ScriptedProvider()
    provider.script(ProviderError("timeout", retryable=True), repeat_last=True)
    orch, policy = make(provider, retries=1)
    with pytest.raises(AIUnavailableError):
        await ask(orch)
    assert len(provider.requests) == 4  # 2 models x (1 try + 1 retry)
    assert all(r.status == "error" for r in policy.records)


# ---- structured output ---------------------------------------------------------------------


async def structured(provider: ScriptedProvider) -> Match:
    orch, _ = make(provider)
    return await generate_structured(
        orch,
        Match,
        task=AITask.JOB_MATCHING,
        messages=[ChatMessage("user", "score it")],
        user_id=USER,
        prompt_name="t",
        prompt_version=1,
    )


async def test_structured_accepts_valid_and_fenced_json() -> None:
    provider = ScriptedProvider()
    provider.script('```json\n{"score": 90, "summary": "good"}\n```')
    assert (await structured(provider)).score == 90


async def test_structured_repairs_once_then_succeeds() -> None:
    provider = ScriptedProvider()
    provider.script("sure! here you go", '{"score": 70, "summary": "ok"}')
    result = await structured(provider)
    assert result.score == 70
    assert "not valid JSON" in provider.requests[1].messages[-1].content


async def test_structured_wrong_shape_then_still_wrong_fails_safely() -> None:
    provider = ScriptedProvider()
    provider.script(json.dumps({"score": "high"}), repeat_last=True)
    with pytest.raises(StructuredOutputError):
        await structured(provider)
    assert len(provider.requests) == 2  # original + exactly one repair


# ---- OpenRouter adapter --------------------------------------------------------------------


def adapter(handler: httpx.MockTransport, key: str | None = "sk-test") -> OpenRouterProvider:
    return OpenRouterProvider(key, client=httpx.AsyncClient(transport=handler))


REQ = AIRequest(model="m", messages=(ChatMessage("user", "hi"),), json_mode=True)


async def test_openrouter_parses_reply_usage_and_sends_bearer_key() -> None:
    seen: dict[str, object] = {}

    def handle(request: httpx.Request) -> httpx.Response:
        seen["auth"] = request.headers["authorization"]
        seen["body"] = json.loads(request.content)
        return httpx.Response(
            200,
            json={
                "model": "m-resolved",
                "choices": [{"message": {"content": "hello"}}],
                "usage": {"prompt_tokens": 7, "completion_tokens": 3},
            },
        )

    response = await adapter(httpx.MockTransport(handle)).generate(REQ)
    assert response.text == "hello"
    assert (response.input_tokens, response.output_tokens) == (7, 3)
    assert response.model == "m-resolved"
    assert seen["auth"] == "Bearer sk-test"
    assert seen["body"]["response_format"] == {"type": "json_object"}  # type: ignore[index]


@pytest.mark.parametrize(
    ("status", "retryable"), [(429, True), (503, True), (400, False), (401, False)]
)
async def test_openrouter_classifies_http_errors(status: int, retryable: bool) -> None:
    transport = httpx.MockTransport(lambda _: httpx.Response(status, text="echoes your prompt"))
    with pytest.raises(ProviderError) as info:
        await adapter(transport).generate(REQ)
    assert info.value.retryable is retryable
    assert "echoes" not in str(info.value)


async def test_openrouter_treats_200_with_error_object_as_failure() -> None:
    transport = httpx.MockTransport(lambda _: httpx.Response(200, json={"error": {"code": 502}}))
    with pytest.raises(ProviderError) as info:
        await adapter(transport).generate(REQ)
    assert info.value.retryable


async def test_openrouter_without_key_fails_fast() -> None:
    with pytest.raises(ProviderError) as info:
        await OpenRouterProvider(None).generate(REQ)
    assert info.value.code == "not_configured" and not info.value.retryable

import json
from datetime import timedelta
from typing import Any

import pytest
from httpx import AsyncClient
from sqlalchemy import func, select, update

from app.ai.providers.base import ProviderError
from app.core.config import get_settings
from app.domain.models import AIRequestLog, ApprovalRequest
from app.domain.models.base import utcnow
from tests.conftest import Env
from tests.fakes import final_step, tool_step

API = "/api/v1"


async def signup(client: AsyncClient, email: str = "ada@example.com") -> dict[str, str]:
    r = await client.post(
        f"{API}/auth/register",
        json={"email": email, "password": "correct-horse", "full_name": "Ada"},
    )
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


async def start(env: Env, headers: dict[str, str], goal: str = "help me with my search") -> str:
    r = await env.client.post(f"{API}/agent/tasks", json={"goal": goal}, headers=headers)
    assert r.status_code == 202, r.text
    return str(r.json()["id"])


async def task(env: Env, headers: dict[str, str], task_id: str) -> dict[str, Any]:
    r = await env.client.get(f"{API}/agent/tasks/{task_id}", headers=headers)
    assert r.status_code == 200
    return dict(r.json())


# ---- READ tools run on their own -----------------------------------------------------------


async def test_read_tool_runs_automatically_and_task_completes(env: Env) -> None:
    h = await signup(env.client)
    env.provider.script(tool_step("get_user_profile"), final_step("Hi Ada, all set."))
    task_id = await start(env, h)
    assert (await task(env, h, task_id))["status"] == "queued"  # the request returns at once

    await env.runner.run_all()
    result = await task(env, h, task_id)
    assert result["status"] == "completed"
    assert result["result"] == "Hi Ada, all set."
    assert result["steps_used"] == 2
    assert result["actions"][0]["tool"] == "get_user_profile"
    assert result["actions"][0]["status"] == "executed"
    assert result["actions"][0]["result"] == {"found": True, "full_name": "Ada"}


async def test_every_model_call_is_logged_without_prompt_text(env: Env) -> None:
    h = await signup(env.client)
    env.provider.script(tool_step("get_user_profile"), final_step("done"))
    await start(env, h)
    await env.runner.run_all()
    async with env.factory() as s:
        rows = (await s.execute(select(AIRequestLog))).scalars().all()
    assert len(rows) == 2
    assert {r.prompt_name for r in rows} == {"career_agent"}
    assert all(r.prompt_version == 1 and r.status == "success" for r in rows)
    assert all(r.task == "agent_reasoning" and r.provider == "fake" for r in rows)


async def test_tool_result_is_fed_back_to_the_model_as_labelled_data(env: Env) -> None:
    h = await signup(env.client)
    env.provider.script(tool_step("get_user_profile"), final_step("done"))
    await start(env, h)
    await env.runner.run_all()
    last_user_message = env.provider.requests[1].messages[-1]
    assert last_user_message.role == "user"
    assert "tool_result" in json.loads(last_user_message.content)


# ---- WRITE / PUBLIC tools need approval ----------------------------------------------------


async def test_write_tool_pauses_and_does_not_run_until_approved(env: Env) -> None:
    h = await signup(env.client)
    env.provider.script(tool_step("save_note", {"text": "call recruiter"}))
    task_id = await start(env, h)
    await env.runner.run_all()

    paused = await task(env, h, task_id)
    assert paused["status"] == "awaiting_approval"
    assert paused["pending_approval"]["tool"] == "save_note"
    assert paused["pending_approval"]["permission"] == "write"
    assert paused["pending_approval"]["preview"] == {"title": "Save note", "text": "call recruiter"}
    assert env.tools.executed == []  # nothing ran

    approvals = (await env.client.get(f"{API}/approvals", headers=h)).json()
    assert [a["id"] for a in approvals] == [paused["pending_approval"]["id"]]

    env.provider.script(final_step("Saved your note."))
    approval_id = paused["pending_approval"]["id"]
    r = await env.client.post(f"{API}/approvals/{approval_id}/approve", headers=h)
    assert r.status_code == 200 and r.json()["status"] == "executed"
    assert env.tools.executed == ["save_note:call recruiter"]

    await env.runner.run_all()
    done = await task(env, h, task_id)
    assert done["status"] == "completed" and done["pending_approval"] is None
    assert done["actions"][0]["status"] == "executed"
    assert (await env.client.get(f"{API}/approvals", headers=h)).json() == []


async def test_public_tool_pauses_with_recipient_preview(env: Env) -> None:
    h = await signup(env.client)
    env.provider.script(tool_step("send_email", {"to": "hr@acme.test", "subject": "Application"}))
    task_id = await start(env, h)
    await env.runner.run_all()
    approval = (await task(env, h, task_id))["pending_approval"]
    assert approval["permission"] == "public"
    assert approval["preview"] == {"to": "hr@acme.test", "subject": "Application"}
    assert env.tools.executed == []


async def test_rejecting_never_runs_the_tool_and_the_agent_is_told(env: Env) -> None:
    h = await signup(env.client)
    env.provider.script(tool_step("send_email", {"to": "hr@acme.test", "subject": "Hi"}))
    task_id = await start(env, h)
    await env.runner.run_all()
    approval_id = (await task(env, h, task_id))["pending_approval"]["id"]

    env.provider.script(final_step("Okay, I did not send it."))
    r = await env.client.post(f"{API}/approvals/{approval_id}/reject", headers=h)
    assert r.status_code == 200 and r.json()["status"] == "rejected"
    await env.runner.run_all()

    assert env.tools.executed == []
    done = await task(env, h, task_id)
    assert done["status"] == "completed"
    assert done["actions"][0]["status"] == "rejected"
    assert "user_rejected" in env.provider.requests[-1].messages[-1].content


async def test_approval_cannot_be_answered_twice(env: Env) -> None:
    h = await signup(env.client)
    env.provider.script(tool_step("save_note", {"text": "x"}))
    task_id = await start(env, h)
    await env.runner.run_all()
    approval_id = (await task(env, h, task_id))["pending_approval"]["id"]

    assert (
        await env.client.post(f"{API}/approvals/{approval_id}/approve", headers=h)
    ).status_code == 200
    again = await env.client.post(f"{API}/approvals/{approval_id}/approve", headers=h)
    assert again.status_code == 409 and again.json()["error"]["code"] == "approval_not_pending"
    assert env.tools.executed == ["save_note:x"]  # executed exactly once


async def test_expired_approval_is_not_performed(env: Env) -> None:
    h = await signup(env.client)
    env.provider.script(tool_step("save_note", {"text": "late"}))
    task_id = await start(env, h)
    await env.runner.run_all()
    approval_id = (await task(env, h, task_id))["pending_approval"]["id"]
    async with env.factory() as s:
        await s.execute(update(ApprovalRequest).values(expires_at=utcnow() - timedelta(minutes=1)))
        await s.commit()

    r = await env.client.post(f"{API}/approvals/{approval_id}/approve", headers=h)
    assert r.status_code == 409 and r.json()["error"]["code"] == "approval_expired"
    assert env.tools.executed == []


async def test_users_cannot_see_or_decide_each_others_approvals(env: Env) -> None:
    ada = await signup(env.client, "ada@example.com")
    eve = await signup(env.client, "eve@example.com")
    env.provider.script(tool_step("save_note", {"text": "private"}))
    task_id = await start(env, ada)
    await env.runner.run_all()
    approval_id = (await task(env, ada, task_id))["pending_approval"]["id"]

    assert (await env.client.get(f"{API}/approvals", headers=eve)).json() == []
    assert (
        await env.client.post(f"{API}/approvals/{approval_id}/approve", headers=eve)
    ).status_code == 404
    assert (await env.client.get(f"{API}/agent/tasks/{task_id}", headers=eve)).status_code == 404
    assert env.tools.executed == []


# ---- the model cannot misuse tools ---------------------------------------------------------


async def test_unknown_tool_and_bad_arguments_are_fed_back_not_executed(env: Env) -> None:
    h = await signup(env.client)
    env.provider.script(
        tool_step("hack_the_planet"),
        tool_step("save_note", {"wrong": 1}),
        final_step("I could not do that."),
    )
    task_id = await start(env, h)
    await env.runner.run_all()
    done = await task(env, h, task_id)
    assert done["status"] == "completed"
    assert done["actions"] == []  # neither proposal became an action
    assert env.tools.executed == []
    assert "unknown_tool" in env.provider.requests[1].messages[-1].content
    assert "invalid arguments" in env.provider.requests[2].messages[-1].content


# ---- limits and failure handling -----------------------------------------------------------


async def test_endless_loop_stops_at_the_step_limit(env: Env) -> None:
    h = await signup(env.client)
    env.provider.script(tool_step("get_user_profile"), repeat_last=True)
    task_id = await start(env, h)
    await env.runner.run_all()
    done = await task(env, h, task_id)
    assert done["status"] == "failed" and done["error"] == "step_limit_reached"
    assert len(env.provider.requests) == get_settings().agent_max_steps


async def test_daily_ai_limit_stops_the_task(env: Env, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(get_settings(), "ai_daily_request_limit_per_user", 1)
    h = await signup(env.client)
    env.provider.script(tool_step("get_user_profile"), final_step("never reached"))
    task_id = await start(env, h)
    await env.runner.run_all()
    done = await task(env, h, task_id)
    assert done["status"] == "failed" and done["error"] == "ai_daily_limit_reached"
    assert len(env.provider.requests) == 1


async def test_unusable_model_output_fails_safely(env: Env) -> None:
    h = await signup(env.client)
    env.provider.script("I am not JSON", repeat_last=True)
    task_id = await start(env, h)
    await env.runner.run_all()
    done = await task(env, h, task_id)
    assert done["status"] == "failed" and done["error"] == "ai_invalid_output"
    assert done["result"] is None


async def test_provider_outage_fails_safely(env: Env) -> None:
    h = await signup(env.client)
    env.provider.script(ProviderError("http_503", retryable=True), repeat_last=True)
    task_id = await start(env, h)
    await env.runner.run_all()
    done = await task(env, h, task_id)
    assert done["status"] == "failed" and done["error"] == "ai_unavailable"


async def test_active_task_cap_blocks_new_tasks(env: Env) -> None:
    h = await signup(env.client)
    for _ in range(get_settings().agent_max_active_tasks_per_user):
        env.provider.script(tool_step("save_note", {"text": "x"}))
        await start(env, h)
        await env.runner.run_all()  # each pauses awaiting approval, so stays active
    r = await env.client.post(f"{API}/agent/tasks", json={"goal": "one more"}, headers=h)
    assert r.status_code == 429 and r.json()["error"]["code"] == "too_many_active_tasks"


async def test_agent_endpoints_require_login(env: Env) -> None:
    assert (
        await env.client.post(f"{API}/agent/tasks", json={"goal": "hello there"})
    ).status_code == 401
    assert (await env.client.get(f"{API}/approvals")).status_code == 401


async def test_goal_is_validated(env: Env) -> None:
    h = await signup(env.client)
    r = await env.client.post(f"{API}/agent/tasks", json={"goal": "x"}, headers=h)
    assert r.status_code == 422


async def test_only_one_row_per_task_is_created(env: Env) -> None:
    h = await signup(env.client)
    env.provider.script(final_step("nothing to do"))
    await start(env, h)
    await env.runner.run_all()
    async with env.factory() as s:
        count = (await s.execute(select(func.count()).select_from(ApprovalRequest))).scalar_one()
    assert count == 0

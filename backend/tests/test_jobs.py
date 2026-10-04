import json
from datetime import UTC, datetime, timedelta

import httpx
import pytest

from app.domain.models import Job
from app.services.job_feed import SOURCE_LABEL, refresh_feed
from app.services.safe_fetch import UrlFetcher
from tests.conftest import Env
from tests.helpers import SETUP, make_job, seed_jobs, signup
from tests.test_job_import import POSTING


async def skills(env: Env, headers: dict[str, str], *labels: str) -> None:
    for label in labels:
        await env.client.post(
            "/api/v1/profile/cv/items", json={"section": "skills", "label": label}, headers=headers
        )


async def test_feed_is_sorted_by_match_and_filterable(env: Env) -> None:
    headers = await signup(env.client)
    await env.client.put("/api/v1/profile/setup", json=SETUP, headers=headers)
    await skills(env, headers, "Figma", "User research", "Design systems")
    strong, weak = await seed_jobs(
        env.factory,
        make_job(title="Product Designer"),
        make_job(title="Backend Engineer", location="Berlin", work_mode="onsite", skills=["Go"]),
    )

    items = (await env.client.get("/api/v1/jobs", headers=headers)).json()
    assert [i["job"]["id"] for i in items] == [strong, weak]
    assert items[0]["match"]["level"] == "strong"
    assert items[0]["applicationStatus"] is None

    onsite = await env.client.get("/api/v1/jobs?workModes=onsite", headers=headers)
    assert [i["job"]["id"] for i in onsite.json()] == [weak]
    good = await env.client.get("/api/v1/jobs?minLevel=good", headers=headers)
    assert [i["job"]["id"] for i in good.json()] == [strong]
    text = await env.client.get("/api/v1/jobs?q=backend", headers=headers)
    assert [i["job"]["id"] for i in text.json()] == [weak]
    bad = await env.client.get("/api/v1/jobs?workModes=moon", headers=headers)
    assert bad.status_code == 422


async def test_job_detail_match_and_recommended(env: Env) -> None:
    headers = await signup(env.client)
    await env.client.put("/api/v1/profile/setup", json=SETUP, headers=headers)
    await skills(env, headers, "Figma", "User research", "Design systems", "Prototyping")
    (job_id,) = await seed_jobs(
        env.factory,
        make_job(salary_min=3500, salary_max=4500, salary_currency="TND", salary_period="month"),
    )

    job = (await env.client.get(f"/api/v1/jobs/{job_id}", headers=headers)).json()
    assert job["salary"]["source"] == "Stated in the posting on Remotive"
    assert job["source"] == {
        "label": "Remotive",
        "url": "https://remotive.com/remote-jobs/design/1",
        "kind": "feed",
    }

    match = (await env.client.get(f"/api/v1/jobs/{job_id}/match", headers=headers)).json()
    assert match["score"] == 100 and match["level"] == "strong"
    assert len(match["factors"]["deterministic"]) == 5
    assert {f["status"] for f in match["factors"]["ai"]} == {"unknown"}
    assert match["gaps"] == []

    recommended = (await env.client.get("/api/v1/jobs/recommended", headers=headers)).json()
    assert [i["job"]["id"] for i in recommended] == [job_id]
    await env.client.post("/api/v1/applications", json={"jobId": job_id}, headers=headers)
    assert (await env.client.get("/api/v1/jobs/recommended", headers=headers)).json() == []

    missing = await env.client.get(f"/api/v1/jobs/{job_id[:-1]}0/match", headers=headers)
    assert missing.status_code == 404


def fake_fetcher(html: str) -> UrlFetcher:
    async def resolver(_: str) -> list[str]:
        return ["93.184.216.34"]

    def handler(_: httpx.Request) -> httpx.Response:
        return httpx.Response(200, text=html)

    return UrlFetcher(resolver=resolver, transport=httpx.MockTransport(handler))


@pytest.fixture
def import_page(monkeypatch: pytest.MonkeyPatch) -> None:
    html = f'<script type="application/ld+json">{json.dumps(POSTING)}</script>'
    monkeypatch.setattr("app.api.deps.UrlFetcher", lambda: fake_fetcher(html))


@pytest.mark.usefixtures("import_page")
async def test_import_preview_saves_nothing_then_confirm_saves_once(env: Env) -> None:
    headers = await signup(env.client)
    url = {"url": "https://jobs.example/postings/42"}
    preview = await env.client.post("/api/v1/jobs/import/preview", json=url, headers=headers)
    assert preview.status_code == 200, preview.text
    assert preview.json()["company"] == "Harbor & Pine"
    assert preview.json()["missing"] == ["Work mode"]
    assert (await env.client.get("/api/v1/jobs", headers=headers)).json() == []

    first = await env.client.post("/api/v1/jobs/import", json=url, headers=headers)
    assert first.status_code == 201
    assert first.json()["source"]["kind"] == "imported"
    second = await env.client.post("/api/v1/jobs/import", json=url, headers=headers)
    assert second.json()["id"] == first.json()["id"]

    other = await signup(env.client, "other@example.com")
    assert (await env.client.get("/api/v1/jobs", headers=other)).json() == []
    hidden = await env.client.get(f"/api/v1/jobs/{first.json()['id']}", headers=other)
    assert hidden.status_code == 404


async def test_import_refuses_private_addresses(env: Env) -> None:
    headers = await signup(env.client)
    response = await env.client.post(
        "/api/v1/jobs/import/preview", json={"url": "http://127.0.0.1/admin"}, headers=headers
    )
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "invalid_url"


def remotive(job_id: int, **overrides: object) -> dict[str, object]:
    raw: dict[str, object] = {
        "id": job_id,
        "url": f"https://remotive.com/remote-jobs/design/{job_id}",
        "title": "Senior Product Designer",
        "company_name": "Cedar Quay",
        "job_type": "full_time",
        "publication_date": (datetime.now(UTC) - timedelta(days=2))
        .replace(tzinfo=None)
        .isoformat(),
        "candidate_required_location": "Europe",
        "salary": "$80k - $100k",
        "description": "<p>Lead research with Figma for our design system team, worldwide.</p>",
    }
    raw.update(overrides)
    return raw


async def test_feed_refresh_upserts_and_prunes(env: Env) -> None:
    old = make_job(
        external_id="999",
        posted_at=datetime.now(UTC) - timedelta(days=90),
        source_label=SOURCE_LABEL,
    )
    await seed_jobs(env.factory, old)
    async with env.factory() as session:
        result = await refresh_feed(session, [remotive(1), remotive(2)])
    assert (result.created, result.updated, result.removed) == (2, 0, 1)

    async with env.factory() as session:
        result = await refresh_feed(session, [remotive(1, title="Lead Product Designer")])
        assert (result.created, result.updated) == (0, 1)
        job = (await session.execute(Job.__table__.select().where(Job.external_id == "1"))).one()
    assert job.title == "Lead Product Designer"
    assert job.seniority == "lead"
    assert job.work_mode == "remote"
    assert job.salary_text == "$80k - $100k"
    assert job.salary_min is None
    assert "Figma" in job.skills

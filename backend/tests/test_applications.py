from tests.conftest import Env
from tests.helpers import make_job, seed_jobs, signup


async def test_track_a_job_through_the_pipeline(env: Env) -> None:
    headers = await signup(env.client)
    (job_id,) = await seed_jobs(env.factory, make_job())

    created = await env.client.post("/api/v1/applications", json={"jobId": job_id}, headers=headers)
    assert created.status_code == 201
    app = created.json()
    assert app["status"] == "saved"
    assert app["jobTitle"] == "Product Designer"
    assert app["matchLevel"] is not None
    assert [e["text"] for e in app["timeline"]] == ["Saved from Remotive"]

    duplicate = await env.client.post(
        "/api/v1/applications", json={"jobId": job_id}, headers=headers
    )
    assert duplicate.status_code == 409

    saved = await env.client.get("/api/v1/jobs?savedOnly=true", headers=headers)
    assert [i["applicationStatus"] for i in saved.json()] == ["saved"]

    applied = await env.client.patch(
        f"/api/v1/applications/{app['id']}",
        json={"status": "applied", "notes": "Sent via their site"},
        headers=headers,
    )
    body = applied.json()
    assert body["status"] == "applied"
    assert body["appliedAt"] is not None
    assert body["notes"] == "Sent via their site"
    assert body["timeline"][0]["text"] == "Marked as applied"

    reminder = await env.client.put(
        f"/api/v1/applications/{app['id']}/reminder",
        json={"dueAt": "2026-10-10T09:00:00Z", "note": "Follow up"},
        headers=headers,
    )
    assert reminder.json()["reminder"]["note"] == "Follow up"
    cleared = await env.client.delete(f"/api/v1/applications/{app['id']}/reminder", headers=headers)
    assert cleared.json()["reminder"] is None

    listed = (await env.client.get("/api/v1/applications", headers=headers)).json()
    assert [a["id"] for a in listed] == [app["id"]]
    assert (
        await env.client.delete(f"/api/v1/applications/{app['id']}", headers=headers)
    ).status_code == 204
    assert (
        await env.client.get(f"/api/v1/applications/{app['id']}", headers=headers)
    ).status_code == 404


async def test_applications_are_private(env: Env) -> None:
    owner = await signup(env.client)
    other = await signup(env.client, "other@example.com")
    (job_id,) = await seed_jobs(env.factory, make_job())
    app = (
        await env.client.post("/api/v1/applications", json={"jobId": job_id}, headers=owner)
    ).json()
    assert (
        await env.client.get(f"/api/v1/applications/{app['id']}", headers=other)
    ).status_code == 404
    patch = await env.client.patch(
        f"/api/v1/applications/{app['id']}", json={"status": "offer"}, headers=other
    )
    assert patch.status_code == 404
    assert (await env.client.get("/api/v1/applications", headers=other)).json() == []


async def test_cannot_track_unknown_or_bad_status(env: Env) -> None:
    headers = await signup(env.client)
    (job_id,) = await seed_jobs(env.factory, make_job())
    unknown = await env.client.post(
        "/api/v1/applications",
        json={"jobId": "00000000-0000-0000-0000-000000000000"},
        headers=headers,
    )
    assert unknown.status_code == 404
    bad = await env.client.post(
        "/api/v1/applications", json={"jobId": job_id, "status": "hired"}, headers=headers
    )
    assert bad.status_code == 422

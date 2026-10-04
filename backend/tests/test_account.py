from sqlalchemy import func, select

from app.domain.models import Application, CvItem, Job, User
from tests.conftest import Env
from tests.helpers import SETUP, make_job, seed_jobs, signup


async def fill_account(env: Env, headers: dict[str, str]) -> None:
    await env.client.put("/api/v1/profile/setup", json=SETUP, headers=headers)
    await env.client.post(
        "/api/v1/profile/cv/items", json={"section": "skills", "label": "Figma"}, headers=headers
    )
    (job_id,) = await seed_jobs(env.factory, make_job())
    await env.client.post("/api/v1/applications", json={"jobId": job_id}, headers=headers)


async def test_export_contains_the_users_data(env: Env) -> None:
    headers = await signup(env.client)
    await fill_account(env, headers)
    data = (await env.client.get("/api/v1/users/me/export", headers=headers)).json()
    assert data["account"]["email"] == "amira@example.com"
    assert data["searchSetup"]["targetRole"] == "Product Designer"
    assert [i["label"] for i in data["cvItems"]] == ["Figma"]
    assert len(data["applications"]) == 1
    assert "password" not in str(data).lower()


async def test_delete_needs_password_then_removes_everything(env: Env) -> None:
    headers = await signup(env.client)
    await fill_account(env, headers)
    other = await signup(env.client, "other@example.com")
    await env.client.post(
        "/api/v1/profile/cv/items", json={"section": "skills", "label": "SQL"}, headers=other
    )

    wrong = await env.client.post(
        "/api/v1/users/me/delete", json={"password": "nope-nope"}, headers=headers
    )
    assert wrong.status_code == 401

    done = await env.client.post(
        "/api/v1/users/me/delete", json={"password": "correct-horse"}, headers=headers
    )
    assert done.status_code == 204
    assert (await env.client.get("/api/v1/users/me", headers=headers)).status_code == 401
    login = await env.client.post(
        "/api/v1/auth/login", json={"email": "amira@example.com", "password": "correct-horse"}
    )
    assert login.status_code == 401

    async with env.factory() as session:

        async def count(model: type[object]) -> int | None:
            return await session.scalar(select(func.count()).select_from(model))

        assert await count(User) == 1
        assert await count(Application) == 0
        assert await count(CvItem) == 1  # the other user's item is untouched
        assert await count(Job) == 1  # shared feed jobs are not personal data

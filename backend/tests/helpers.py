import uuid
from datetime import UTC, datetime
from typing import Any

from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.domain.models import Job


async def signup(client: AsyncClient, email: str = "amira@example.com") -> dict[str, str]:
    """Register and return bearer headers."""
    response = await client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "correct-horse", "full_name": "Amira Ben Salah"},
    )
    assert response.status_code == 201, response.text
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def make_job(**overrides: Any) -> Job:
    fields: dict[str, Any] = {
        "id": uuid.uuid4(),
        "owner_id": None,
        "source_kind": "feed",
        "source_label": "Remotive",
        "source_url": "https://remotive.com/remote-jobs/design/1",
        "external_id": str(uuid.uuid4()),
        "title": "Product Designer",
        "company": "Lumen Health",
        "location": "Tunis",
        "work_mode": "hybrid",
        "employment_type": "full_time",
        "seniority": "mid",
        "posted_at": datetime(2026, 10, 1, tzinfo=UTC),
        "summary": "Design patient booking flows.",
        "description": [{"type": "paragraph", "text": "Design patient booking flows."}],
        "skills": ["Figma", "User research", "Design systems", "Prototyping"],
    }
    fields.update(overrides)
    return Job(**fields)


async def seed_jobs(factory: async_sessionmaker[AsyncSession], *jobs: Job) -> list[str]:
    async with factory() as session:
        session.add_all(jobs)
        await session.commit()
    return [str(job.id) for job in jobs]


SETUP = {
    "targetRole": "Product Designer",
    "location": "Tunis",
    "salaryMin": 3000,
    "currency": "TND",
    "salaryPeriod": "month",
    "seniority": "mid",
    "employmentTypes": ["full_time"],
    "workModes": ["hybrid", "remote"],
}

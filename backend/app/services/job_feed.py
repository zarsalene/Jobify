"""Shared job feed from Remotive's public API (remote jobs, no key needed).

Remotive asks API users to link back to each job on Remotive and to credit Remotive as the
source, and to fetch only a few times a day. Every job keeps its Remotive URL and is labelled
"Remotive", and the worker refreshes every 6 hours.

Run once by hand:  uv run python -m app.services.job_feed
"""

import asyncio
import logging
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Any

import httpx
from sqlalchemy import delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.enums import JobSourceKind, WorkMode
from app.domain.models.base import utcnow
from app.domain.models.job import Job
from app.domain.skills import extract_skills
from app.repositories.jobs import JobRepository
from app.services.job_text import (
    blocks_to_text,
    employment_type_from,
    html_to_blocks,
    seniority_from_title,
    summarize,
)

logger = logging.getLogger(__name__)

REMOTIVE_URL = "https://remotive.com/api/remote-jobs"
SOURCE_LABEL = "Remotive"
FETCH_LIMIT = 300
KEEP_DAYS = 45
MAX_SKILLS = 15


@dataclass(frozen=True)
class FeedResult:
    fetched: int
    created: int
    updated: int
    removed: int


def _posted_at(value: Any) -> datetime | None:
    try:
        parsed = datetime.fromisoformat(str(value))
    except ValueError:
        return None
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=UTC)


def _apply(job: Job, raw: dict[str, Any]) -> None:
    title = " ".join(str(raw.get("title") or "").split())[:300]
    blocks = html_to_blocks(str(raw.get("description") or ""))
    salary = " ".join(str(raw.get("salary") or "").split())
    job.title = title
    job.company = " ".join(str(raw.get("company_name") or "").split())[:300] or "Not stated"
    job.location = " ".join(str(raw.get("candidate_required_location") or "").split())[:300]
    job.work_mode = WorkMode.REMOTE
    job.employment_type = employment_type_from(raw.get("job_type"))
    job.seniority = seniority_from_title(title)
    # Remotive gives salary as free text, so it is kept word for word, not converted.
    job.salary_text = salary[:300] or None
    job.posted_at = _posted_at(raw.get("publication_date"))
    job.summary = summarize(blocks)
    job.description = blocks
    job.skills = extract_skills(f"{title}\n{blocks_to_text(blocks)}")[:MAX_SKILLS]
    job.source_url = str(raw.get("url") or "")[:2000]


async def fetch_remotive(client: httpx.AsyncClient) -> list[dict[str, Any]]:
    response = await client.get(REMOTIVE_URL, params={"limit": FETCH_LIMIT}, timeout=30.0)
    response.raise_for_status()
    jobs = response.json().get("jobs", [])
    return [j for j in jobs if isinstance(j, dict) and j.get("id") and j.get("url")]


async def refresh_feed(session: AsyncSession, raw_jobs: list[dict[str, Any]]) -> FeedResult:
    repo = JobRepository(session)
    by_id = {str(raw["id"]): raw for raw in raw_jobs}
    existing = await repo.get_by_external_ids(SOURCE_LABEL, list(by_id))
    created = updated = 0
    for external_id, raw in by_id.items():
        job = existing.get(external_id)
        if job is None:
            job = Job(
                owner_id=None,
                source_kind=JobSourceKind.FEED,
                source_label=SOURCE_LABEL,
                external_id=external_id,
            )
            repo.add(job)
            created += 1
        else:
            updated += 1
        _apply(job, raw)

    cutoff = utcnow() - timedelta(days=KEEP_DAYS)
    result = await session.execute(
        delete(Job).where(
            Job.source_label == SOURCE_LABEL,
            Job.owner_id.is_(None),
            Job.posted_at < cutoff,
        )
    )
    await session.commit()
    removed = int(getattr(result, "rowcount", 0) or 0)
    return FeedResult(fetched=len(raw_jobs), created=created, updated=updated, removed=removed)


async def run_refresh() -> FeedResult:
    from app.core.database import SessionFactory

    async with httpx.AsyncClient(headers={"User-Agent": "Rolenest/1.0"}) as client:
        raw_jobs = await fetch_remotive(client)
    async with SessionFactory() as session:
        result = await refresh_feed(session, raw_jobs)
    logger.info("job feed refreshed", extra={"result": result.__dict__})
    return result


if __name__ == "__main__":
    print(asyncio.run(run_refresh()))  # noqa: T201

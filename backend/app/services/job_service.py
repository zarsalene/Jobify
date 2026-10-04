import uuid
from dataclasses import dataclass, field

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import NotFoundError
from app.domain.enums import (
    MATCH_LEVEL_ORDER,
    ApplicationStatus,
    EmploymentType,
    JobSourceKind,
    MatchLevel,
    Seniority,
    WorkMode,
)
from app.domain.models.base import utcnow
from app.domain.models.job import Job
from app.repositories.applications import ApplicationRepository
from app.repositories.jobs import JobRepository
from app.repositories.profile import ProfileRepository
from app.schemas.jobs import (
    DescriptionBlock,
    ImportPreview,
    JobListItem,
    JobRead,
    MatchRead,
    MatchSummary,
    salary_of,
)
from app.services.job_import import ImportedJob, parse_job_page
from app.services.matching import MatchResult, compute_match
from app.services.safe_fetch import UrlFetcher

# Matching runs in Python, so best-match sorting looks at the newest jobs that pass the
# filters, then ranks them. Enough for a personal feed; move scoring to SQL if this grows.
SCAN_LIMIT = 300
RECOMMENDED_COUNT = 10


@dataclass(frozen=True)
class JobFilters:
    text: str | None = None
    work_modes: list[WorkMode] = field(default_factory=list)
    employment_types: list[EmploymentType] = field(default_factory=list)
    seniority: list[Seniority] = field(default_factory=list)
    min_level: MatchLevel | None = None
    saved_only: bool = False
    sort: str = "best_match"
    limit: int = 50


class JobService:
    def __init__(self, session: AsyncSession, fetcher: UrlFetcher) -> None:
        self._session = session
        self._jobs = JobRepository(session)
        self._profile = ProfileRepository(session)
        self._applications = ApplicationRepository(session)
        self._fetcher = fetcher

    async def _matcher(self, user_id: uuid.UUID):  # type: ignore[no-untyped-def]
        prefs = await self._profile.get_preferences(user_id)
        skills = await self._profile.confirmed_skills(user_id)
        now = utcnow()

        def match(job: Job) -> MatchResult:
            return compute_match(job, prefs, skills, now)

        return match

    async def search(self, user_id: uuid.UUID, filters: JobFilters) -> list[JobListItem]:
        by_job = await self._applications.by_job(user_id)
        ids = None
        if filters.saved_only:
            ids = [j for j, a in by_job.items() if a.status == ApplicationStatus.SAVED]
        jobs = await self._jobs.search(
            user_id,
            text=filters.text,
            work_modes=filters.work_modes,
            employment_types=filters.employment_types,
            seniority=filters.seniority,
            ids=ids,
            limit=SCAN_LIMIT,
        )
        match = await self._matcher(user_id)
        scored = [(job, match(job)) for job in jobs]
        if filters.min_level is not None:
            cutoff = MATCH_LEVEL_ORDER.index(filters.min_level)
            scored = [(j, m) for j, m in scored if MATCH_LEVEL_ORDER.index(m.level) <= cutoff]
        if filters.sort == "best_match":
            scored.sort(key=lambda pair: pair[1].score, reverse=True)
        items = []
        for job, result in scored[: filters.limit]:
            application = by_job.get(job.id)
            items.append(
                JobListItem(
                    job=JobRead.from_model(job),
                    match=MatchSummary(score=result.score, level=result.level),
                    application_id=application.id if application else None,
                    application_status=(
                        ApplicationStatus(application.status) if application else None
                    ),
                )
            )
        return items

    async def recommended(self, user_id: uuid.UUID) -> list[JobListItem]:
        """Strong and good matches the user hasn't already put in their pipeline."""
        items = await self.search(
            user_id, JobFilters(min_level=MatchLevel.GOOD, limit=RECOMMENDED_COUNT * 3)
        )
        return [i for i in items if i.application_id is None][:RECOMMENDED_COUNT]

    async def get(self, user_id: uuid.UUID, job_id: uuid.UUID) -> JobRead:
        return JobRead.from_model(await self._get_job(user_id, job_id))

    async def match(self, user_id: uuid.UUID, job_id: uuid.UUID) -> MatchRead:
        job = await self._get_job(user_id, job_id)
        match = await self._matcher(user_id)
        return MatchRead.from_result(job.id, match(job))

    async def import_preview(self, url: str) -> ImportPreview:
        imported = await self._read(url)
        draft = _to_job(imported, owner_id=None)
        return ImportPreview(
            url=imported.url,
            host_label=imported.host_label,
            title=imported.title,
            company=imported.company,
            location=imported.location,
            work_mode=imported.work_mode,
            employment_type=imported.employment_type,
            seniority=imported.seniority,
            salary=salary_of(draft),
            posted_at=imported.posted_at,
            summary=imported.summary,
            description=[DescriptionBlock.model_validate(b) for b in imported.description],
            skills=imported.skills,
            missing=imported.missing,
        )

    async def import_confirm(self, user_id: uuid.UUID, url: str) -> JobRead:
        """Fetch again and save. Saving what the server read, not what a client sent back,
        keeps imported jobs as trustworthy as feed jobs."""
        imported = await self._read(url)
        existing = await self._jobs.get_imported(user_id, imported.url)
        if existing is not None:
            return JobRead.from_model(existing)
        job = _to_job(imported, owner_id=user_id)
        self._jobs.add(job)
        await self._session.commit()
        return JobRead.from_model(job)

    async def _read(self, url: str) -> ImportedJob:
        page = await self._fetcher.fetch(url.strip())
        return parse_job_page(page.text, page.url)

    async def _get_job(self, user_id: uuid.UUID, job_id: uuid.UUID) -> Job:
        job = await self._jobs.get_visible(user_id, job_id)
        if job is None:
            raise NotFoundError("job_not_found", "That job isn't available any more.")
        return job


def _to_job(imported: ImportedJob, owner_id: uuid.UUID | None) -> Job:
    return Job(
        id=uuid.uuid4(),
        owner_id=owner_id,
        source_kind=JobSourceKind.IMPORTED,
        source_label=imported.host_label or "Imported link",
        source_url=imported.url,
        # Imported jobs are per user, so the source id must not collide across users.
        external_id=None,
        title=imported.title,
        company=imported.company or "Company not stated",
        location=imported.location,
        work_mode=imported.work_mode,
        employment_type=imported.employment_type,
        seniority=imported.seniority,
        salary_min=imported.salary_min,
        salary_max=imported.salary_max,
        salary_currency=imported.salary_currency,
        salary_period=imported.salary_period,
        posted_at=imported.posted_at,
        summary=imported.summary,
        description=imported.description,
        skills=imported.skills,
    )

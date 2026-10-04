import uuid
from datetime import datetime
from typing import Any, Literal

from pydantic import Field

from app.domain.enums import (
    ApplicationStatus,
    EmploymentType,
    FactorStatus,
    JobSourceKind,
    MatchLevel,
    SalaryPeriod,
    Seniority,
    WorkMode,
)
from app.domain.models.job import Job
from app.schemas.base import ApiModel
from app.services.matching import MatchResult


class Salary(ApiModel):
    min: int | None
    max: int | None
    currency: str | None
    period: SalaryPeriod | None
    # The posting's own words, when the amount could not be read as numbers.
    text: str | None
    # Always shown next to the figure, e.g. "Stated in the posting on Remotive".
    source: str


class JobSource(ApiModel):
    label: str
    url: str
    kind: JobSourceKind


class DescriptionBlock(ApiModel):
    type: Literal["heading", "paragraph", "bullet"]
    text: str
    requirement: bool = False


class JobRead(ApiModel):
    id: uuid.UUID
    title: str
    company: str
    location: str
    work_mode: WorkMode | None
    employment_type: EmploymentType | None
    seniority: Seniority | None
    salary: Salary | None
    source: JobSource
    posted_at: datetime | None
    summary: str
    description: list[DescriptionBlock]
    skills: list[str]

    @classmethod
    def from_model(cls, job: Job) -> "JobRead":
        return cls(
            id=job.id,
            title=job.title,
            company=job.company,
            location=job.location,
            work_mode=WorkMode(job.work_mode) if job.work_mode else None,
            employment_type=EmploymentType(job.employment_type) if job.employment_type else None,
            seniority=Seniority(job.seniority) if job.seniority else None,
            salary=salary_of(job),
            source=JobSource(
                label=job.source_label, url=job.source_url, kind=JobSourceKind(job.source_kind)
            ),
            posted_at=job.posted_at,
            summary=job.summary,
            description=[DescriptionBlock.model_validate(b) for b in job.description],
            skills=job.skills,
        )


def salary_of(job: Job) -> Salary | None:
    has_numbers = job.salary_min is not None or job.salary_max is not None
    if not has_numbers and not job.salary_text:
        return None
    return Salary(
        min=job.salary_min,
        max=job.salary_max,
        currency=job.salary_currency,
        period=SalaryPeriod(job.salary_period) if job.salary_period else None,
        text=job.salary_text,
        source=f"Stated in the posting on {job.source_label}",
    )


class MatchFactor(ApiModel):
    key: str
    label: str
    status: FactorStatus
    detail: str


class MatchGap(ApiModel):
    label: str
    how_to_close: str


class MatchFactors(ApiModel):
    deterministic: list[MatchFactor]
    ai: list[MatchFactor]


class MatchRead(ApiModel):
    job_id: uuid.UUID
    score: int
    level: MatchLevel
    reason: str
    strengths: list[str]
    gaps: list[MatchGap]
    factors: MatchFactors
    based_on: list[str]
    generated_at: datetime

    @classmethod
    def from_result(cls, job_id: uuid.UUID, result: MatchResult) -> "MatchRead":
        def factors(items: Any) -> list[MatchFactor]:
            return [
                MatchFactor(key=f.key, label=f.label, status=f.status, detail=f.detail)
                for f in items
            ]

        return cls(
            job_id=job_id,
            score=result.score,
            level=result.level,
            reason=result.reason,
            strengths=result.strengths,
            gaps=[MatchGap(label=g.label, how_to_close=g.how_to_close) for g in result.gaps],
            factors=MatchFactors(
                deterministic=factors(result.deterministic), ai=factors(result.ai)
            ),
            based_on=result.based_on,
            generated_at=result.generated_at,
        )


class MatchSummary(ApiModel):
    score: int
    level: MatchLevel


class JobListItem(ApiModel):
    job: JobRead
    match: MatchSummary
    application_id: uuid.UUID | None = None
    application_status: ApplicationStatus | None = None


class ImportRequest(ApiModel):
    url: str = Field(min_length=8, max_length=2000)


class ImportPreview(ApiModel):
    """What was read from the link. Nothing is saved until the user confirms."""

    url: str
    host_label: str
    title: str
    company: str
    location: str
    work_mode: WorkMode | None
    employment_type: EmploymentType | None
    seniority: Seniority | None
    salary: Salary | None
    posted_at: datetime | None
    summary: str
    description: list[DescriptionBlock]
    skills: list[str]
    # Fields the page did not state. Shown as "Not found", never guessed.
    missing: list[str]

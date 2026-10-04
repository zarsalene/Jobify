import uuid
from typing import Annotated, Literal

from fastapi import APIRouter, Query, status

from app.api.deps import CurrentUser, JobServiceDep
from app.domain.enums import EmploymentType, MatchLevel, Seniority, WorkMode
from app.schemas.jobs import ImportPreview, ImportRequest, JobListItem, JobRead, MatchRead
from app.services.job_service import JobFilters

router = APIRouter(prefix="/jobs", tags=["jobs"])


@router.get("", response_model=list[JobListItem])
async def list_jobs(
    user: CurrentUser,
    service: JobServiceDep,
    q: Annotated[str | None, Query(max_length=200)] = None,
    work_modes: Annotated[list[WorkMode] | None, Query(alias="workModes")] = None,
    employment_types: Annotated[list[EmploymentType] | None, Query(alias="employmentTypes")] = None,
    seniority: Annotated[list[Seniority] | None, Query()] = None,
    min_level: Annotated[MatchLevel | None, Query(alias="minLevel")] = None,
    saved_only: Annotated[bool, Query(alias="savedOnly")] = False,
    sort: Literal["best_match", "newest"] = "best_match",
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
) -> list[JobListItem]:
    filters = JobFilters(
        text=q or None,
        work_modes=work_modes or [],
        employment_types=employment_types or [],
        seniority=seniority or [],
        min_level=min_level,
        saved_only=saved_only,
        sort=sort,
        limit=limit,
    )
    return await service.search(user.id, filters)


@router.get("/recommended", response_model=list[JobListItem])
async def recommended(user: CurrentUser, service: JobServiceDep) -> list[JobListItem]:
    return await service.recommended(user.id)


@router.post("/import/preview", response_model=ImportPreview)
async def import_preview(
    data: ImportRequest, _: CurrentUser, service: JobServiceDep
) -> ImportPreview:
    """Read a posting from a link. Nothing is saved."""
    return await service.import_preview(data.url)


@router.post("/import", response_model=JobRead, status_code=status.HTTP_201_CREATED)
async def import_job(data: ImportRequest, user: CurrentUser, service: JobServiceDep) -> JobRead:
    return await service.import_confirm(user.id, data.url)


@router.get("/{job_id}", response_model=JobRead)
async def read_job(job_id: uuid.UUID, user: CurrentUser, service: JobServiceDep) -> JobRead:
    return await service.get(user.id, job_id)


@router.get("/{job_id}/match", response_model=MatchRead)
async def read_match(job_id: uuid.UUID, user: CurrentUser, service: JobServiceDep) -> MatchRead:
    return await service.match(user.id, job_id)

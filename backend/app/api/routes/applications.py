import uuid

from fastapi import APIRouter, status

from app.api.deps import ApplicationServiceDep, CurrentUser
from app.schemas.applications import (
    ApplicationCreate,
    ApplicationRead,
    ApplicationUpdate,
    Reminder,
)

router = APIRouter(prefix="/applications", tags=["applications"])


@router.get("", response_model=list[ApplicationRead])
async def list_applications(
    user: CurrentUser, service: ApplicationServiceDep
) -> list[ApplicationRead]:
    return await service.list_all(user.id)


@router.post("", response_model=ApplicationRead, status_code=status.HTTP_201_CREATED)
async def create_application(
    data: ApplicationCreate, user: CurrentUser, service: ApplicationServiceDep
) -> ApplicationRead:
    """Track a job (save it, or record that you applied). Sends nothing to the employer."""
    return await service.create(user.id, data)


@router.get("/{application_id}", response_model=ApplicationRead)
async def read_application(
    application_id: uuid.UUID, user: CurrentUser, service: ApplicationServiceDep
) -> ApplicationRead:
    return await service.get(user.id, application_id)


@router.patch("/{application_id}", response_model=ApplicationRead)
async def update_application(
    application_id: uuid.UUID,
    data: ApplicationUpdate,
    user: CurrentUser,
    service: ApplicationServiceDep,
) -> ApplicationRead:
    return await service.update(user.id, application_id, data)


@router.put("/{application_id}/reminder", response_model=ApplicationRead)
async def set_reminder(
    application_id: uuid.UUID,
    data: Reminder,
    user: CurrentUser,
    service: ApplicationServiceDep,
) -> ApplicationRead:
    return await service.set_reminder(user.id, application_id, data)


@router.delete("/{application_id}/reminder", response_model=ApplicationRead)
async def clear_reminder(
    application_id: uuid.UUID, user: CurrentUser, service: ApplicationServiceDep
) -> ApplicationRead:
    return await service.set_reminder(user.id, application_id, None)


@router.delete("/{application_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_application(
    application_id: uuid.UUID, user: CurrentUser, service: ApplicationServiceDep
) -> None:
    await service.delete(user.id, application_id)

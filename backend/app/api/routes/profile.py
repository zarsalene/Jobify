import uuid

from fastapi import APIRouter, UploadFile, status

from app.api.deps import CurrentUser, ProfileServiceDep
from app.schemas.profile import (
    CvItemCreate,
    CvItemRead,
    CvItemUpdate,
    ParsedCv,
    ProfileRead,
    SearchSetup,
)
from app.services.cv_text import MAX_CV_BYTES

router = APIRouter(prefix="/profile", tags=["profile"])


@router.get("", response_model=ProfileRead)
async def read_profile(user: CurrentUser, service: ProfileServiceDep) -> ProfileRead:
    return await service.get(user.id)


@router.put("/setup", response_model=SearchSetup)
async def put_setup(
    data: SearchSetup, user: CurrentUser, service: ProfileServiceDep
) -> SearchSetup:
    return await service.put_setup(user.id, data)


@router.post("/cv", response_model=ParsedCv, status_code=status.HTTP_201_CREATED)
async def upload_cv(file: UploadFile, user: CurrentUser, service: ProfileServiceDep) -> ParsedCv:
    """PDF or DOCX, up to 5 MB. Found skills come back as pending, for the user to confirm."""
    # Read one byte past the limit so an oversized file is detected without loading it all.
    data = await file.read(MAX_CV_BYTES + 1)
    return await service.upload_cv(user.id, file.filename or "cv", data)


@router.post("/cv/items", response_model=CvItemRead, status_code=status.HTTP_201_CREATED)
async def add_item(data: CvItemCreate, user: CurrentUser, service: ProfileServiceDep) -> CvItemRead:
    return await service.add_item(user.id, data)


@router.patch("/cv/items/{item_id}", response_model=CvItemRead)
async def update_item(
    item_id: uuid.UUID, data: CvItemUpdate, user: CurrentUser, service: ProfileServiceDep
) -> CvItemRead:
    return await service.update_item(user.id, item_id, data)


@router.delete("/cv/items/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_item(item_id: uuid.UUID, user: CurrentUser, service: ProfileServiceDep) -> None:
    await service.delete_item(user.id, item_id)

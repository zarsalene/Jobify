import uuid

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.enums import CvItemStatus, CvSection
from app.domain.models.profile import CvDocument, CvItem, SearchPreferences


class ProfileRepository:
    """Search preferences, CV files and CV items. Database access only."""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get_preferences(self, user_id: uuid.UUID) -> SearchPreferences | None:
        return await self._session.get(SearchPreferences, user_id)

    def add(self, obj: SearchPreferences | CvDocument | CvItem) -> None:
        self._session.add(obj)

    async def latest_document(self, user_id: uuid.UUID) -> CvDocument | None:
        result = await self._session.execute(
            select(CvDocument)
            .where(CvDocument.user_id == user_id)
            .order_by(CvDocument.created_at.desc())
            .limit(1)
        )
        return result.scalar_one_or_none()

    async def list_items(self, user_id: uuid.UUID) -> list[CvItem]:
        result = await self._session.execute(
            select(CvItem).where(CvItem.user_id == user_id).order_by(CvItem.created_at)
        )
        return list(result.scalars())

    async def get_item(self, user_id: uuid.UUID, item_id: uuid.UUID) -> CvItem | None:
        result = await self._session.execute(
            select(CvItem).where(CvItem.id == item_id, CvItem.user_id == user_id)
        )
        return result.scalar_one_or_none()

    async def confirmed_skills(self, user_id: uuid.UUID) -> list[str]:
        result = await self._session.execute(
            select(CvItem.label).where(
                CvItem.user_id == user_id,
                CvItem.section == CvSection.SKILLS,
                CvItem.status == CvItemStatus.CONFIRMED,
            )
        )
        return list(result.scalars())

    async def delete_unconfirmed_cv_items(self, user_id: uuid.UUID) -> None:
        """Clear what a previous upload extracted and the user never confirmed."""
        await self._session.execute(
            delete(CvItem).where(
                CvItem.user_id == user_id,
                CvItem.origin == "cv",
                CvItem.status == CvItemStatus.PENDING,
            )
        )

    async def delete_item(self, item: CvItem) -> None:
        await self._session.delete(item)

import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import NotFoundError
from app.domain.enums import CvItemStatus, CvSection
from app.domain.models.profile import CvDocument, CvItem, SearchPreferences
from app.domain.skills import extract_skills, normalize_skill
from app.repositories.profile import ProfileRepository
from app.schemas.profile import (
    CvFileRead,
    CvItemCreate,
    CvItemRead,
    CvItemUpdate,
    ParsedCv,
    ProfileRead,
    SearchSetup,
)
from app.services.cv_text import MAX_CV_BYTES, CvFileError, detect_type, extract_text

# Vocabulary matches are right about the word appearing, not about the person having the
# skill at a useful level, so they always start as "pending" for the user to confirm.
BASIC_EXTRACTION_CONFIDENCE = 0.6
BASIC_EXTRACTION_NOTES = [
    "We found these skills by looking for known skill names in your CV. Confirm the ones "
    "that are right and delete the rest.",
    "Experience, education and certifications aren't read automatically yet. Add them "
    "yourself, or wait for AI reading, which is coming.",
]


class ProfileService:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session
        self._repo = ProfileRepository(session)

    async def get(self, user_id: uuid.UUID) -> ProfileRead:
        prefs = await self._repo.get_preferences(user_id)
        doc = await self._repo.latest_document(user_id)
        items = await self._repo.list_items(user_id)
        missing = []
        if prefs is None or not prefs.target_role:
            missing.append("Target role")
        if prefs is None or not (prefs.location or prefs.work_modes):
            missing.append("Where you want to work")
        if doc is None:
            missing.append("CV")
        confirmed = [i for i in items if i.status == CvItemStatus.CONFIRMED]
        if not any(i.section == CvSection.SKILLS for i in confirmed):
            missing.append("Confirmed skills")
        if not any(i.section == CvSection.EXPERIENCE for i in confirmed):
            missing.append("Experience")
        return ProfileRead(
            setup=SearchSetup.from_model(prefs) if prefs else None,
            cv=CvFileRead.from_model(doc) if doc else None,
            items=[CvItemRead.from_model(i) for i in items],
            completeness=round(100 * (5 - len(missing)) / 5),
            missing=missing,
        )

    async def put_setup(self, user_id: uuid.UUID, data: SearchSetup) -> SearchSetup:
        prefs = await self._repo.get_preferences(user_id)
        if prefs is None:
            prefs = SearchPreferences(user_id=user_id)
            self._repo.add(prefs)
        prefs.target_role = data.target_role.strip()
        prefs.location = data.location.strip()
        prefs.salary_min = data.salary_min
        prefs.salary_currency = data.currency
        prefs.salary_period = data.salary_period
        prefs.seniority = data.seniority
        prefs.employment_types = list(dict.fromkeys(data.employment_types))
        prefs.work_modes = list(dict.fromkeys(data.work_modes))
        await self._session.commit()
        return SearchSetup.from_model(prefs)

    async def upload_cv(self, user_id: uuid.UUID, file_name: str, data: bytes) -> ParsedCv:
        if len(data) > MAX_CV_BYTES:
            raise CvFileError("file_too_large", "CV files can be up to 5 MB.")
        if not data:
            raise CvFileError("empty_file", "The file is empty.")
        content_type = detect_type(data)
        text = extract_text(data, content_type)

        doc = CvDocument(
            user_id=user_id,
            file_name=_safe_name(file_name),
            content_type=content_type,
            size_bytes=len(data),
            content=data,
            extracted_text=text,
        )
        self._repo.add(doc)
        await self._repo.delete_unconfirmed_cv_items(user_id)
        await self._session.flush()

        already = {normalize_skill(i.label) for i in await self._repo.list_items(user_id)}
        new_items = [
            CvItem(
                user_id=user_id,
                section=CvSection.SKILLS,
                label=skill,
                confidence=BASIC_EXTRACTION_CONFIDENCE,
                status=CvItemStatus.PENDING,
                origin="cv",
            )
            for skill in extract_skills(text)
            if normalize_skill(skill) not in already
        ]
        for item in new_items:
            self._repo.add(item)
        await self._session.commit()

        notes = list(BASIC_EXTRACTION_NOTES)
        if not new_items:
            notes.insert(0, "We didn't recognise any skill names. Add your skills yourself.")
        return ParsedCv(
            file=CvFileRead.from_model(doc),
            method="basic",
            items=[CvItemRead.from_model(i) for i in new_items],
            notes=notes,
        )

    async def add_item(self, user_id: uuid.UUID, data: CvItemCreate) -> CvItemRead:
        # The user typed it, so it is confirmed by definition.
        item = CvItem(
            user_id=user_id,
            section=data.section,
            label=data.label.strip(),
            detail=data.detail.strip() if data.detail else None,
            confidence=1.0,
            status=CvItemStatus.CONFIRMED,
            origin="manual",
        )
        self._repo.add(item)
        await self._session.commit()
        return CvItemRead.from_model(item)

    async def update_item(
        self, user_id: uuid.UUID, item_id: uuid.UUID, data: CvItemUpdate
    ) -> CvItemRead:
        item = await self._get_item(user_id, item_id)
        if data.label is not None:
            item.label = data.label.strip()
        if "detail" in data.model_fields_set:
            item.detail = data.detail.strip() if data.detail else None
        if data.status is not None:
            item.status = data.status
        if data.label is not None or "detail" in data.model_fields_set:
            # An edit by the user is a confirmation of the edited text.
            item.status = CvItemStatus.CONFIRMED
            item.confidence = 1.0
        await self._session.commit()
        return CvItemRead.from_model(item)

    async def delete_item(self, user_id: uuid.UUID, item_id: uuid.UUID) -> None:
        item = await self._get_item(user_id, item_id)
        await self._repo.delete_item(item)
        await self._session.commit()

    async def _get_item(self, user_id: uuid.UUID, item_id: uuid.UUID) -> CvItem:
        item = await self._repo.get_item(user_id, item_id)
        if item is None:
            raise NotFoundError("cv_item_not_found", "That CV item doesn't exist.")
        return item


def _safe_name(name: str) -> str:
    """Keep only the base name, without path parts or control characters."""
    base = name.replace("\\", "/").rsplit("/", 1)[-1]
    cleaned = "".join(ch for ch in base if ch.isprintable()).strip()
    return cleaned[:255] or "cv"

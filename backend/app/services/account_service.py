import uuid
from typing import Any

from sqlalchemy import delete, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import UnauthorizedError
from app.core.security import verify_password
from app.domain.models import (
    AgentAction,
    AgentTask,
    AIRequestLog,
    ApprovalRequest,
    RefreshToken,
    User,
)
from app.domain.models.application import Application, ApplicationEvent
from app.domain.models.base import utcnow
from app.domain.models.job import Job
from app.domain.models.profile import CvDocument, CvItem, SearchPreferences
from app.schemas.applications import ApplicationRead
from app.schemas.jobs import JobRead
from app.schemas.profile import CvFileRead, CvItemRead, SearchSetup


class AccountService:
    """Data export and account deletion (GDPR-style rights). Both act on the caller only."""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def export(self, user: User) -> dict[str, Any]:
        uid = user.id
        prefs = await self._session.get(SearchPreferences, uid)
        docs = (
            await self._session.execute(select(CvDocument).where(CvDocument.user_id == uid))
        ).scalars()
        items = (await self._session.execute(select(CvItem).where(CvItem.user_id == uid))).scalars()
        apps = (
            await self._session.execute(select(Application).where(Application.user_id == uid))
        ).scalars()
        imported = (await self._session.execute(select(Job).where(Job.owner_id == uid))).scalars()

        def dump(model: Any) -> Any:
            return model.model_dump(mode="json", by_alias=True)

        return {
            "exportedAt": utcnow().isoformat(),
            "account": {
                "id": str(uid),
                "email": user.email,
                "fullName": user.full_name,
                "createdAt": user.created_at.isoformat(),
            },
            "searchSetup": dump(SearchSetup.from_model(prefs)) if prefs else None,
            # File contents are not inlined; this lists what is stored.
            "cvFiles": [dump(CvFileRead.from_model(d)) for d in docs],
            "cvItems": [dump(CvItemRead.from_model(i)) for i in items],
            "applications": [dump(ApplicationRead.from_model(a)) for a in apps],
            "importedJobs": [dump(JobRead.from_model(j)) for j in imported],
        }

    async def delete(self, user: User, password: str) -> None:
        """Permanent. Asks for the password again so a stolen session alone can't do it."""
        if not verify_password(password, user.password_hash):
            raise UnauthorizedError("invalid_credentials", "Incorrect password")
        uid: uuid.UUID = user.id
        app_ids = select(Application.id).where(Application.user_id == uid)
        task_ids = select(AgentTask.id).where(AgentTask.user_id == uid)
        # Explicit deletes so the result doesn't depend on the database enforcing cascades.
        for statement in (
            delete(ApprovalRequest).where(ApprovalRequest.user_id == uid),
            delete(AgentAction).where(AgentAction.task_id.in_(task_ids)),
            delete(AgentTask).where(AgentTask.user_id == uid),
            # The AI log holds usage metadata only (no prompts or replies); it is kept for
            # cost accounting with the link to the person removed.
            update(AIRequestLog).where(AIRequestLog.user_id == uid).values(user_id=None),
            delete(ApplicationEvent).where(ApplicationEvent.application_id.in_(app_ids)),
            delete(Application).where(Application.user_id == uid),
            delete(Job).where(Job.owner_id == uid),
            delete(CvItem).where(CvItem.user_id == uid),
            delete(CvDocument).where(CvDocument.user_id == uid),
            delete(SearchPreferences).where(SearchPreferences.user_id == uid),
            delete(RefreshToken).where(RefreshToken.user_id == uid),
        ):
            await self._session.execute(statement)
        await self._session.delete(user)
        await self._session.commit()

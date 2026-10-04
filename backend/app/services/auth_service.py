from datetime import timedelta

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.errors import ConflictError, UnauthorizedError
from app.core.security import (
    create_access_token,
    generate_refresh_token,
    hash_password,
    hash_refresh_token,
    verify_password,
)
from app.domain.models import RefreshToken, User
from app.domain.models.base import ensure_utc, utcnow
from app.repositories.refresh_tokens import RefreshTokenRepository
from app.repositories.users import UserRepository
from app.schemas.auth import LoginRequest, RegisterRequest, TokenPair

# Hash of a throwaway password, verified when the email is unknown so that response
# time does not reveal which emails are registered.
_DUMMY_HASH = hash_password("not-a-real-password")


class AuthService:
    """Registration, login and refresh-token rotation. Owns the transaction boundary."""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session
        self._users = UserRepository(session)
        self._tokens = RefreshTokenRepository(session)

    async def register(self, data: RegisterRequest) -> TokenPair:
        email = data.email.lower()
        if await self._users.get_by_email(email):
            raise ConflictError("email_taken", "An account with this email already exists")
        user = User(
            email=email,
            password_hash=hash_password(data.password),
            full_name=data.full_name.strip(),
        )
        self._users.add(user)
        await self._session.flush()
        pair = self._issue_tokens(user)
        await self._session.commit()
        return pair

    async def login(self, data: LoginRequest) -> TokenPair:
        user = await self._users.get_by_email(data.email.lower())
        password_hash = user.password_hash if user else _DUMMY_HASH
        valid = verify_password(data.password, password_hash)
        if not user or not valid or not user.is_active:
            raise UnauthorizedError("invalid_credentials", "Incorrect email or password")
        pair = self._issue_tokens(user)
        await self._session.commit()
        return pair

    async def refresh(self, refresh_token: str) -> TokenPair:
        """Rotate: each refresh token works once. Reuse of a spent token revokes the session."""
        stored = await self._tokens.get_by_hash(hash_refresh_token(refresh_token))
        if stored is None:
            raise UnauthorizedError("invalid_refresh_token", "Invalid refresh token")
        now = utcnow()
        if stored.revoked_at is not None:
            await self._tokens.revoke_all_for_user(stored.user_id, now)
            await self._session.commit()
            raise UnauthorizedError("invalid_refresh_token", "Invalid refresh token")
        if ensure_utc(stored.expires_at) <= now:
            raise UnauthorizedError("invalid_refresh_token", "Refresh token expired")
        user = await self._users.get_by_id(stored.user_id)
        if user is None or not user.is_active:
            raise UnauthorizedError("invalid_refresh_token", "Invalid refresh token")
        stored.revoked_at = now
        pair = self._issue_tokens(user)
        await self._session.commit()
        return pair

    async def logout(self, refresh_token: str) -> None:
        stored = await self._tokens.get_by_hash(hash_refresh_token(refresh_token))
        if stored is not None and stored.revoked_at is None:
            stored.revoked_at = utcnow()
            await self._session.commit()

    def _issue_tokens(self, user: User) -> TokenPair:
        access_token, expires_in = create_access_token(user.id)
        refresh_token = generate_refresh_token()
        self._tokens.add(
            RefreshToken(
                user_id=user.id,
                token_hash=hash_refresh_token(refresh_token),
                expires_at=utcnow() + timedelta(days=get_settings().refresh_token_ttl_days),
            )
        )
        return TokenPair(
            access_token=access_token, refresh_token=refresh_token, expires_in=expires_in
        )

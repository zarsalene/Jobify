from httpx import AsyncClient

REGISTER = {"email": "Ada@Example.com", "password": "correct-horse", "full_name": "Ada Lovelace"}


async def register(client: AsyncClient) -> dict[str, str]:
    response = await client.post("/api/v1/auth/register", json=REGISTER)
    assert response.status_code == 201
    return response.json()  # type: ignore[no-any-return]


async def test_register_returns_tokens_and_me_works(client: AsyncClient) -> None:
    tokens = await register(client)
    me = await client.get(
        "/api/v1/users/me", headers={"Authorization": f"Bearer {tokens['access_token']}"}
    )
    assert me.status_code == 200
    assert me.json()["email"] == "ada@example.com"
    assert "password" not in me.text


async def test_duplicate_email_is_rejected(client: AsyncClient) -> None:
    await register(client)
    response = await client.post("/api/v1/auth/register", json=REGISTER)
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "email_taken"


async def test_weak_password_is_rejected(client: AsyncClient) -> None:
    response = await client.post("/api/v1/auth/register", json={**REGISTER, "password": "short"})
    assert response.status_code == 422


async def test_login_success_and_failure(client: AsyncClient) -> None:
    await register(client)
    ok = await client.post(
        "/api/v1/auth/login", json={"email": "ada@example.com", "password": "correct-horse"}
    )
    assert ok.status_code == 200
    bad = await client.post(
        "/api/v1/auth/login", json={"email": "ada@example.com", "password": "wrong-password"}
    )
    assert bad.status_code == 401
    unknown = await client.post(
        "/api/v1/auth/login", json={"email": "nobody@example.com", "password": "whatever123"}
    )
    assert unknown.status_code == 401
    assert unknown.json() == bad.json()


async def test_me_requires_valid_token(client: AsyncClient) -> None:
    assert (await client.get("/api/v1/users/me")).status_code == 401
    bad = await client.get("/api/v1/users/me", headers={"Authorization": "Bearer nope"})
    assert bad.status_code == 401


async def test_refresh_rotates_and_old_token_stops_working(client: AsyncClient) -> None:
    first = await register(client)
    second = await client.post(
        "/api/v1/auth/refresh", json={"refresh_token": first["refresh_token"]}
    )
    assert second.status_code == 200
    assert second.json()["refresh_token"] != first["refresh_token"]
    reuse = await client.post(
        "/api/v1/auth/refresh", json={"refresh_token": first["refresh_token"]}
    )
    assert reuse.status_code == 401


async def test_reusing_a_spent_token_revokes_the_whole_session(client: AsyncClient) -> None:
    first = await register(client)
    second = (
        await client.post("/api/v1/auth/refresh", json={"refresh_token": first["refresh_token"]})
    ).json()
    await client.post("/api/v1/auth/refresh", json={"refresh_token": first["refresh_token"]})
    newest = await client.post(
        "/api/v1/auth/refresh", json={"refresh_token": second["refresh_token"]}
    )
    assert newest.status_code == 401


async def test_logout_revokes_refresh_token(client: AsyncClient) -> None:
    tokens = await register(client)
    out = await client.post("/api/v1/auth/logout", json={"refresh_token": tokens["refresh_token"]})
    assert out.status_code == 204
    again = await client.post(
        "/api/v1/auth/refresh", json={"refresh_token": tokens["refresh_token"]}
    )
    assert again.status_code == 401

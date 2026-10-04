from httpx import AsyncClient


async def test_health(client: AsyncClient) -> None:
    response = await client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


async def test_ready_checks_database(client: AsyncClient) -> None:
    response = await client.get("/health/ready")
    assert response.status_code == 200


async def test_request_id_is_returned_and_echoed(client: AsyncClient) -> None:
    generated = await client.get("/health")
    assert generated.headers["x-request-id"]
    echoed = await client.get("/health", headers={"X-Request-ID": "abc123"})
    assert echoed.headers["x-request-id"] == "abc123"


async def test_openapi_is_versioned(client: AsyncClient) -> None:
    response = await client.get("/api/v1/openapi.json")
    assert response.status_code == 200
    assert "/api/v1/auth/login" in response.json()["paths"]

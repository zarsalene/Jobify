# Jobify (working name)

An AI career copilot for Android and iOS: find the right roles, prepare a stronger application, and approve everything before it is sent.

See [ARCHITECTURE.md](ARCHITECTURE.md) for the design and [SECURITY.md](SECURITY.md) for the security model.

## Repository layout

```
backend/          FastAPI service (Python 3.12, uv)
mobile/           Expo / React Native app (TypeScript)
infrastructure/   Docker Compose for local development
docs/             Design and planning documents
.github/          CI workflows
```

## Run the backend

Requires [uv](https://docs.astral.sh/uv/).

```bash
cd backend
cp .env.example .env
uv sync
uv run pytest            # tests use in-memory SQLite, no services needed
uv run uvicorn app.main:app --reload
```

API docs: http://localhost:8000/docs. Health: `GET /health`.

Full local stack (Postgres, Redis, MinIO, API, worker):

```bash
cd infrastructure
docker compose up --build
```

## Database migrations

```bash
cd backend
uv run alembic upgrade head
uv run alembic revision --autogenerate -m "describe the change"
```

Check the database connection (never prints the password):

```bash
uv run python -m scripts.check_db
```

## Quality checks

```bash
cd backend
uv run ruff check . && uv run ruff format --check .
uv run mypy app tests
uv run pytest
```

## Run the mobile app

```bash
cd mobile
npm install
npx expo start
```

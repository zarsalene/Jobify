# Architecture

> The mobile app is the interface. The backend is the brain. The AI proposes. The permission system is the safety layer.

```
Mobile (Expo / React Native)  --HTTPS /api/v1-->  Backend (FastAPI)
                                                     |-- PostgreSQL   (data)
                                                     |-- Redis        (queues, rate limits)
                                                     |-- Workers      (Arq, long tasks)
                                                     |-- Object store (CVs, documents)
                                                     `-- AI layer --> AIProvider --> OpenRouter / local / future
```

## Rules that never bend

1. **The mobile app never talks to an AI provider.** No provider key exists in the app. It only calls the Jobify API.
2. **The AI never controls an external service directly.** It proposes a tool call, policy and permissions validate it, the user approves when required, then the backend executes.
3. **Nothing public or destructive happens without explicit approval** (send email, publish, delete).
4. **The AI never invents** experience, qualifications, certifications, employment, achievements or salary.
5. **No password scraping, CAPTCHA or rate-limit bypass, or bot-detection evasion.** Job data comes from official APIs, public data, user-provided URLs and supported OAuth.

## Backend layers

Each layer may only call the one below it.

| Layer | Folder | Responsibility | Must not |
| --- | --- | --- | --- |
| API | `app/api/` | HTTP routes, request and response schemas, auth dependencies | Contain business rules or SQL |
| Services | `app/services/` | Business rules, transactions | Know about HTTP |
| Repositories | `app/repositories/` | Database queries | Contain business rules |
| Domain | `app/domain/` | SQLAlchemy models and entities | Import from api or services |
| Core | `app/core/` | Settings, security, database, logging, errors | Import from api or services |
| AI | `app/ai/` | Providers, prompts, routing, orchestration, agents | Import from `app.api` |
| Workers | `app/workers/` | Background jobs that call services | Duplicate service logic |

Request flow: `route -> service -> repository -> database`. Errors are raised as `AppError` in services and turned into a consistent JSON body `{"error": {"code", "message"}}` by one handler.

## Conventions

- **Config:** all settings, secrets and model names come from environment variables through `app/core/config.py`. Production refuses to start with a weak `SECRET_KEY`.
- **Auth:** 15-minute access tokens (JWT). Refresh tokens are opaque, stored hashed, rotated on every use, and reuse of a spent token revokes the whole session.
- **IDs and time:** UUID primary keys, timezone-aware UTC timestamps.
- **Migrations:** Alembic, one migration per schema change, reviewed before merge. Naming conventions for constraints are fixed in `domain/models/base.py`.
- **Observability:** JSON logs, `X-Request-ID` on every request and response. Never log tokens, passwords, CV text or full prompts.
- **API contract:** versioned under `/api/v1`. OpenAPI is served at `/api/v1/openapi.json` and the mobile client types are generated from it.

## Roadmap

| # | Milestone | Status |
| --- | --- | --- |
| 0 | Foundation: layers, auth, database, migrations, CI, Docker, Expo shell | In progress |
| 1 | Jobs and profile: CV upload and parsing, job feed, URL import, dedup | Planned |
| 2 | Matching: hybrid deterministic and AI score | Planned |
| 3 | AI layer: providers, router, prompts, structured output, cost limits | Planned |
| 4 | Application preparation, approvals, email, tracker, notifications | Planned |
| 5 | Career agent with tool permissions | Planned |
| 6 | Career extras and integrations, web dashboard | Planned |
| 7 | Launch: SEO, ASO, store publication | Planned |

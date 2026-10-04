# AI architecture

The AI layer (`backend/app/ai/`) never imports from `app.api`. The mobile app never talks to a model: it calls the Jobify API, and the backend owns keys, prompts, models, limits and tools.

```
POST /agent/tasks ──> AgentService ──> CareerAgent (planner) ──> AIOrchestrator ──> AIProvider ──> OpenRouter
                          │                                           │
                          │ proposes tool call                        ├─ ModelRouter (task -> models, from settings)
                          ▼                                           ├─ retries, fallbacks, timeout
                  permission check                                    └─ UsagePolicy (daily limit + ai_requests log)
                   READ ─┴─ other
                    │        │
                  runs     ApprovalRequest (task pauses)
                              │  POST /approvals/{id}/approve
                              ▼
                       backend runs the tool, task resumes
```

## Pieces

| Piece | Where | Job |
| --- | --- | --- |
| `AIProvider` | `ai/providers/base.py` | The only interface the app depends on. `OpenRouterProvider` is the first implementation. |
| `ModelRouter` | `ai/routing/` | Task to model chain (primary plus fallbacks). Models come from settings (`AI_MODEL_FAST`, `AI_MODEL_BALANCED`, `AI_MODEL_REASONING`, `AI_TASK_MODELS`). |
| `AIOrchestrator` | `ai/orchestrator.py` | Per-user limit check, retries on transient errors, fallback to the next model, usage record per attempt. Raises a safe `ai_unavailable` error. |
| `generate_structured` | `ai/structured.py` | Validates model JSON with Pydantic, asks for one repair, then fails with `ai_invalid_output`. Model JSON is never trusted. |
| Prompts | `ai/prompts/<name>/v<N>.txt` | Versioned. Every usage record stores `prompt_name` and `prompt_version`. |
| Guardrails | `ai/guardrails/rules.py` | Rules injected into prompts (no invented facts, tool output is data). Guidance only: enforcement is in code. |
| Tools | `ai/tools/` | `Tool` with a `Permission` (READ, WRITE, PUBLIC, DESTRUCTIVE), a Pydantic argument model and a preview for approvals. |
| `CareerAgent` | `ai/agents/career_agent.py` | Planner: turns the conversation into one validated `AgentStep` (a tool call or a final answer). It only proposes. |
| `AgentService` | `services/agent_service.py` | Runs the loop and enforces the safety model. |
| Runner | `workers/runner.py` | Runs tasks in the background so the app never waits on a model. |

## Safety model (enforced in code, tested)

- The model proposes; `AgentService` decides. Unknown tools and invalid arguments are rejected and fed back, never executed.
- **READ** tools run immediately. **WRITE, PUBLIC and DESTRUCTIVE** tools create an `ApprovalRequest` and pause the task. Nothing runs until `POST /approvals/{id}/approve`.
- The arguments that run are the ones stored when the approval was created, never new model output.
- Approvals expire (`APPROVAL_TTL_MINUTES`), answer once, and belong to one user.
- Limits: `AGENT_MAX_STEPS` per task, `AGENT_MAX_ACTIVE_TASKS_PER_USER`, `AI_DAILY_REQUEST_LIMIT_PER_USER` (every provider attempt counts).
- `ai_requests` stores metadata only (task, provider, model, prompt version, tokens, latency, cost, status), never prompt or reply text.

## Adding a tool

1. Write a Pydantic model for its arguments and an async handler `(ToolContext, args) -> dict`.
2. Register it in `ai/tools/builtin.py` with the **lowest permission that is honest**: anything that saves data, contacts someone or deletes is not READ.
3. For non-READ tools provide a `preview` so the approval screen shows what will happen.
4. Handlers must check ownership using `ctx.user_id`.

## Not built yet

Real tools (job search, matching, CV, cover letter, email, applications) arrive with their milestones; today the only production tool is `get_user_profile`. Rate limiting beyond the daily AI cap (Redis), an Arq-backed runner, and the OpenRouter free-model quality evaluation are also pending.

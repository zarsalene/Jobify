from fastapi import APIRouter

from app.api.routes import (
    account,
    agent,
    applications,
    approvals,
    auth,
    jobs,
    profile,
    users,
)

api_v1 = APIRouter()
api_v1.include_router(auth.router)
api_v1.include_router(users.router)
api_v1.include_router(account.router)
api_v1.include_router(profile.router)
api_v1.include_router(jobs.router)
api_v1.include_router(applications.router)
api_v1.include_router(agent.router)
api_v1.include_router(approvals.router)

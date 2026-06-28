from dotenv import load_dotenv
load_dotenv()  # loads backend/.env before any config is read

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from app.core.limiter import limiter
from app.core.config import settings

from app.database.db import SessionLocal

from app.api.auth import router as auth_router
from app.api.users import router as users_router
from app.api.admin import router as admin_router
from app.api.agents import router as agents_router
from app.api.telemetry import router as telemetry_router
from app.api.alerts import router as alerts_router
from app.api.commands import router as commands_router
from app.api.iocs import router as iocs_router
from app.api.incidents import router as incidents_router
from app.api.settings import router as settings_router
from app.api.notifications import router as notifications_router
from app.api.reports import router as reports_router
from app.api.audit_logs import router as audit_logs_router
from app.api.threat_feeds import router as threat_feeds_router
from app.api.ai import router as ai_router
from app.api.super_admin import router as super_admin_router
from app.api.health import router as health_router

from app.services.role_service import seed_roles
from app.services.tenant_service import create_default_tenant
from app.services.agent_service import update_offline_agents
import threading
import time

app = FastAPI(title="SentryXDR", version="1.0.0")

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS — driven by ALLOWED_ORIGINS env var so it's configurable per environment
_allowed_origins = [o.strip() for o in settings.allowed_origins.split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health_router)
app.include_router(auth_router)
app.include_router(users_router)
app.include_router(admin_router)
app.include_router(agents_router)
app.include_router(telemetry_router)
app.include_router(alerts_router)
app.include_router(commands_router)
app.include_router(iocs_router)
app.include_router(incidents_router)
app.include_router(settings_router)
app.include_router(notifications_router)
app.include_router(reports_router)
app.include_router(audit_logs_router)
app.include_router(threat_feeds_router)
app.include_router(ai_router)
app.include_router(super_admin_router)


@app.on_event("startup")
def startup():
    db = SessionLocal()
    seed_roles(db)
    create_default_tenant(db)
    db.close()

    threading.Thread(target=_offline_monitor, daemon=True).start()


@app.get("/")
def root():
    return {"message": "SentryXDR Backend Running"}


def _offline_monitor():
    while True:
        db = SessionLocal()
        try:
            update_offline_agents(db)
        finally:
            db.close()
        time.sleep(60)

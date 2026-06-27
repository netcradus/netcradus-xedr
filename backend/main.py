from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

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

from app.services.role_service import seed_roles
from app.services.tenant_service import create_default_tenant
from app.services.agent_service import (
    update_offline_agents
)
import threading
import time

app = FastAPI(
    title="SentryXDR"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(users_router)
app.include_router(admin_router)
app.include_router(
    agents_router
)
app.include_router(
    telemetry_router
)
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

    threading.Thread(
        target=offline_monitor,
        daemon=True
    ).start()




@app.get("/")
def root():

    return {
        "message": "SentryXDR Backend Running"
    }


def offline_monitor():

    while True:

        db = SessionLocal()

        try:

            update_offline_agents(db)

        finally:

            db.close()

        time.sleep(60)

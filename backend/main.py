from fastapi import FastAPI

from app.database.db import engine, Base, SessionLocal
from app.models.user import User
from app.models.role import Role
from app.models.tenant import Tenant
from app.models.agent import Agent
from app.models.process_telemetry import ProcessTelemetry
from app.models.network_telemetry import NetworkTelemetry
from app.models.file_telemetry import FileTelemetry
from app.models.persistence_telemetry import PersistenceTelemetry
from app.models.alert import Alert
from app.models.command import Command

from app.api.auth import router as auth_router
from app.api.users import router as users_router
from app.api.admin import router as admin_router
from app.api.agents import router as agents_router
from app.api.telemetry import router as telemetry_router
from app.api.alerts import router as alerts_router
from app.api.commands import router as commands_router

from app.services.role_service import seed_roles
from app.services.tenant_service import create_default_tenant
from app.services.agent_service import (
    update_offline_agents
)
import threading
import time

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="SentryXDR"
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
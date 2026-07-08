from dotenv import load_dotenv
load_dotenv()  # loads backend/.env before any config is read

import logging

from fastapi import FastAPI, APIRouter, Request
from fastapi.exception_handlers import (
    http_exception_handler,
    request_validation_exception_handler,
)
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.core.limiter import limiter
from app.core.config import settings
from app.middleware.correlation_id import CorrelationIdMiddleware
from app.middleware.security_headers import SecurityHeadersMiddleware

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)-8s %(name)s  %(message)s",
)
_log = logging.getLogger("netcradxdr")

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
from app.api.platform_admin import router as platform_admin_router
from app.api.health import router as health_router
from app.api.support import router as support_router
from app.api.detection_rules import router as detection_rules_router
from app.api.hunt import router as hunt_router
from app.api.tasks import router as tasks_router
from app.api.billing import router as billing_router
from app.api.monitoring import router as monitoring_router
from app.middleware.latency import LatencyMiddleware

from app.services.role_service import seed_roles
from app.services.tenant_service import create_default_tenant
from app.services.platform_admin_service import seed_platform_admin
from app.services.detection_rule_seed import seed_detection_rules

app = FastAPI(title="NetcradXDR", version="1.0.0")

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)


# ── Global exception handler ──────────────────────────────────────────────────
# Catches any exception that FastAPI/Starlette doesn't handle natively.
# Returns a sanitised 500 (no stack trace) and logs the full error server-side
# with the correlation ID so the request can be traced in logs.

@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    # Delegate HTTP and validation exceptions back to FastAPI's own handlers
    # so status codes and validation details are preserved correctly.
    if isinstance(exc, StarletteHTTPException):
        return await http_exception_handler(request, exc)
    if isinstance(exc, RequestValidationError):
        return await request_validation_exception_handler(request, exc)

    cid = getattr(request.state, "correlation_id", "unknown")
    _log.error(
        "Unhandled exception  request_id=%s  %s %s  %s: %s",
        cid, request.method, request.url.path,
        type(exc).__name__, exc,
        exc_info=True,
    )
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error", "request_id": cid},
    )


# ── Middleware stack (last added = outermost = runs first on request) ─────────
# Execution order:  SecurityHeaders → CorrelationId → Latency → CORS → handler

# CORS (innermost — must run before any auth logic)
_allowed_origins = [o.strip() for o in settings.allowed_origins.split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
# Latency tracking wraps CORS
app.add_middleware(LatencyMiddleware)
# Correlation ID — set early so all downstream code (and the exception handler) can read it
app.add_middleware(CorrelationIdMiddleware)
# Security headers — outermost so they're stamped on every response regardless of origin
app.add_middleware(SecurityHeadersMiddleware, debug=settings.debug)

# Health stays unversioned — infra probes (load balancers, k8s) expect /health at root
app.include_router(health_router)

# All API routes live under /api/v1 — bump to /api/v2 here when needed
v1 = APIRouter(prefix="/api/v1")
v1.include_router(auth_router)
v1.include_router(users_router)
v1.include_router(admin_router)
v1.include_router(agents_router)
v1.include_router(telemetry_router)
v1.include_router(alerts_router)
v1.include_router(commands_router)
v1.include_router(iocs_router)
v1.include_router(incidents_router)
v1.include_router(settings_router)
v1.include_router(notifications_router)
v1.include_router(reports_router)
v1.include_router(audit_logs_router)
v1.include_router(threat_feeds_router)
v1.include_router(ai_router)
v1.include_router(super_admin_router)
v1.include_router(platform_admin_router)
v1.include_router(support_router)
v1.include_router(detection_rules_router)
v1.include_router(hunt_router)
v1.include_router(tasks_router)
v1.include_router(billing_router)
v1.include_router(monitoring_router)
app.include_router(v1)


def _validate_secrets() -> None:
    """Warn at startup when insecure default values are detected."""
    if not settings.debug:
        if settings.secret_key == "change-this-secret-key":
            _log.critical(
                "SECRET_KEY is the insecure default value — set a random 32+ char "
                "string via the SECRET_KEY environment variable before going to production."
            )
        if "postgres:postgres" in settings.database_url:
            _log.warning(
                "DATABASE_URL appears to use default credentials — use strong, "
                "unique DB credentials in production."
            )


@app.on_event("startup")
def startup():
    _validate_secrets()
    db = SessionLocal()
    seed_roles(db)
    create_default_tenant(db)
    seed_platform_admin(db)
    seed_detection_rules(db)
    db.close()



@app.get("/")
def root():
    return {"message": "NetcradXDR Backend Running"}

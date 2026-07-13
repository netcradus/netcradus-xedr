"""
Shared fixtures for the NetcradXDR test suite.

Env vars are set BEFORE any app import so pydantic-settings picks them up.
python-dotenv's load_dotenv() in main.py does not override existing os.environ
keys, so these take precedence over backend/.env.
"""
import os
import uuid
from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock, patch

import pytest
from sqlalchemy.orm import Session
from starlette.testclient import TestClient

# ── Must come before any app import ───────────────────────────────────────────
os.environ.setdefault(
    "DATABASE_URL",
    "postgresql://postgres:postgres@localhost:5433/netcradxdr_test",
)
os.environ.setdefault("SECRET_KEY", "test-secret-key-min-32-chars-long!!")
os.environ.setdefault("JWT_ALGORITHM", "HS256")
os.environ.setdefault("ACCESS_TOKEN_EXPIRE_MINUTES", "15")
os.environ.setdefault("DEBUG", "true")
os.environ.setdefault("GROQ_API_KEY", "test-not-real")
os.environ.setdefault("SMTP_HOST", "")
os.environ.setdefault("REDIS_URL", "")
os.environ.setdefault("STORAGE_BUCKET", "")
os.environ.setdefault("PLATFORM_ADMIN_EMAIL", "platform@test.local")
os.environ.setdefault("PLATFORM_ADMIN_PASSWORD", "PlatformTest@123!")
os.environ.setdefault("ALLOWED_ORIGINS", "http://localhost:5173")

# ── Import all models so Base.metadata is fully populated ─────────────────────
import app.models.agent
import app.models.agent_version
import app.models.alert
import app.models.audit_log
import app.models.command
import app.models.detection_rule
import app.models.detection_rule_condition
import app.models.dns_telemetry
import app.models.registry_telemetry
import app.models.usb_telemetry
import app.models.browser_extension_telemetry
import app.models.memory_scan_result
import app.models.cloud_telemetry
import app.models.k8s_telemetry
import app.models.email_event_telemetry
import app.models.yara_rule
import app.models.sigma_rule
import app.models.live_session
import app.models.evidence
import app.models.file_telemetry
import app.models.generated_report
import app.models.incident
import app.models.incident_alert
import app.models.investigation_note
import app.models.ioc
import app.models.log_telemetry
import app.models.network_telemetry
import app.models.notification_config
import app.models.persistence_telemetry
import app.models.process_telemetry
import app.models.role
import app.models.scheduled_report
import app.models.support_ticket
import app.models.tenant
import app.models.threat_feed_config
import app.models.user

from app.core.security import create_access_token, hash_password
from app.database.db import Base, SessionLocal, engine as _db_engine, get_db
from app.models.agent import Agent
from app.models.alert import Alert
from app.models.ioc import IOC
from app.models.role import Role
from app.models.tenant import Tenant
from app.models.user import User
from app.services.role_service import seed_roles

# Import the FastAPI app last — triggers all router/model registrations
from main import app  # noqa: E402


# ── Session-scoped: create DB schema once per pytest run ──────────────────────

def _ensure_db_exists(db_url: str) -> None:
    """Create the test database if it doesn't exist (requires superuser)."""
    from sqlalchemy import create_engine, text

    db_name = db_url.rsplit("/", 1)[-1]
    postgres_url = db_url.rsplit("/", 1)[0] + "/postgres"
    admin_engine = create_engine(postgres_url, isolation_level="AUTOCOMMIT")
    try:
        with admin_engine.connect() as conn:
            exists = conn.execute(
                text("SELECT 1 FROM pg_database WHERE datname = :n"), {"n": db_name}
            ).fetchone()
            if not exists:
                conn.execute(text(f'CREATE DATABASE "{db_name}"'))
    finally:
        admin_engine.dispose()


@pytest.fixture(scope="session", autouse=True)
def setup_test_db():
    _ensure_db_exists(os.environ["DATABASE_URL"])
    Base.metadata.drop_all(_db_engine)
    Base.metadata.create_all(_db_engine)
    db = SessionLocal()
    try:
        seed_roles(db)
        db.commit()
    finally:
        db.close()
    yield
    Base.metadata.drop_all(_db_engine)


# ── Function-scoped DB session ─────────────────────────────────────────────────

@pytest.fixture(scope="function")
def db(setup_test_db) -> Session:
    session = SessionLocal()
    try:
        yield session
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


# ── TestClient with overridden DB and mocked startup seeders ──────────────────

@pytest.fixture(scope="function")
def client(db):
    def _override_get_db():
        yield db

    app.dependency_overrides[get_db] = _override_get_db
    with (
        patch("main.seed_roles"),
        patch("main.create_default_tenant"),
        patch("main.seed_platform_admin"),
        patch("main.seed_detection_rules"),
    ):
        with TestClient(app, raise_server_exceptions=True) as c:
            yield c
    app.dependency_overrides.pop(get_db, None)


# ── Reset rate-limiter before every test ──────────────────────────────────────

@pytest.fixture(autouse=True)
def _reset_limiter():
    from slowapi import Limiter
    from slowapi.util import get_remote_address

    fresh = Limiter(key_func=get_remote_address, default_limits=["10000/minute"])
    old = app.state.limiter
    app.state.limiter = fresh
    yield
    app.state.limiter = old


# ── Mock external I/O for every test (Celery, email, enrichment) ──────────────

@pytest.fixture(autouse=True)
def _mock_external():
    task_stub = MagicMock()
    task_stub.id = "test-task-id"
    with (
        patch("app.api.iocs.enrich_ioc_background"),
        patch("app.api.iocs.sync_iocs_task") as mock_sync,
        patch("app.services.enrichment_service.enrich_ioc_background"),
        patch("app.api.auth.send_verification_email"),
        patch("app.api.auth.send_password_reset_email"),
    ):
        mock_sync.delay.return_value = task_stub
        yield


# ── Helpers ────────────────────────────────────────────────────────────────────

def uid(prefix: str = "") -> str:
    """Return a unique string safe to use as DB names/emails."""
    return f"{prefix}{uuid.uuid4().hex[:10]}"


def auth_headers(user: User) -> dict:
    token = create_access_token({"sub": user.email})
    return {"Authorization": f"Bearer {token}"}


def make_user(
    db: Session,
    role_name: str,
    tenant_id: int,
    email: str | None = None,
    mfa_enabled: bool = False,
    is_active: bool = True,
) -> User:
    role = db.query(Role).filter(Role.name == role_name).first()
    assert role, f"Role '{role_name}' not found — seed_roles must run first"
    u = User(
        name=f"Test {role_name}",
        email=email or uid(role_name.lower() + "_") + "@example.com",
        password=hash_password("TestPass123!"),
        role_id=role.id,
        tenant_id=tenant_id,
        is_active=is_active,
        mfa_enabled=mfa_enabled,
    )
    db.add(u)
    db.commit()
    db.refresh(u)
    return u


# ── Standard data fixtures ─────────────────────────────────────────────────────

@pytest.fixture
def tenant_a(db) -> Tenant:
    t = Tenant(name=uid("ta_"), api_key=uuid.uuid4().hex)
    db.add(t); db.commit(); db.refresh(t)
    return t


@pytest.fixture
def tenant_b(db) -> Tenant:
    t = Tenant(name=uid("tb_"), api_key=uuid.uuid4().hex)
    db.add(t); db.commit(); db.refresh(t)
    return t


@pytest.fixture
def admin_user(db, tenant_a) -> User:
    return make_user(db, "Admin", tenant_a.id)


@pytest.fixture
def analyst_user(db, tenant_a) -> User:
    return make_user(db, "Analyst", tenant_a.id)


@pytest.fixture
def admin_b(db, tenant_b) -> User:
    return make_user(db, "Admin", tenant_b.id)


@pytest.fixture
def agent_a(db, tenant_a) -> Agent:
    a = Agent(
        hostname=uid("h_"), ip_address="10.0.0.1",
        os_type="Windows", agent_token=uuid.uuid4().hex,
        tenant_id=tenant_a.id,
    )
    db.add(a); db.commit(); db.refresh(a)
    return a


@pytest.fixture
def agent_b(db, tenant_b) -> Agent:
    a = Agent(
        hostname=uid("h_"), ip_address="10.0.0.2",
        os_type="Linux", agent_token=uuid.uuid4().hex,
        tenant_id=tenant_b.id,
    )
    db.add(a); db.commit(); db.refresh(a)
    return a


@pytest.fixture
def ioc_a(db, tenant_a) -> IOC:
    ioc = IOC(
        tenant_id=tenant_a.id,
        type="IPv4",
        value=f"1.2.{uuid.uuid4().int % 254}.{uuid.uuid4().int % 254}",
        severity="High",
        is_active=True,
    )
    db.add(ioc); db.commit(); db.refresh(ioc)
    return ioc


@pytest.fixture
def alert_a(db, agent_a) -> Alert:
    a = Alert(
        title=uid("alert_"),
        description="Test alert",
        severity="High",
        mitre_technique="T1071",
        status="Open",
        agent_id=agent_a.id,
    )
    db.add(a); db.commit(); db.refresh(a)
    return a

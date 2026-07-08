"""
Security regression tests for authentication and authorisation.

Covers: JWT manipulation, MFA bypass, role escalation, inactive accounts,
        MFA enforcement at the tenant level.
"""
import base64
import json
import uuid
from datetime import datetime, timedelta, timezone

import pytest
from jose import jwt

from app.core.config import settings
from app.core.security import create_access_token
from app.models.tenant import Tenant
from app.models.user import User
from tests.conftest import auth_headers, make_user, uid

# A protected endpoint that requires at minimum Analyst role
_PROTECTED = "/api/v1/alerts/"
_ADMIN_ONLY = "/api/v1/iocs"


# ── Unauthenticated access ─────────────────────────────────────────────────────

def test_no_token_returns_401(client):
    resp = client.get(_PROTECTED)
    assert resp.status_code == 401


def test_malformed_bearer_returns_401(client):
    resp = client.get(_PROTECTED, headers={"Authorization": "Bearer not.a.jwt"})
    assert resp.status_code == 401


# ── JWT manipulation ───────────────────────────────────────────────────────────

def test_expired_token_returns_401(client, admin_user):
    expired = jwt.encode(
        {
            "sub": admin_user.email,
            "type": "access",
            "exp": datetime.now(timezone.utc) - timedelta(seconds=1),
        },
        settings.secret_key,
        algorithm=settings.algorithm,
    )
    resp = client.get(_PROTECTED, headers={"Authorization": f"Bearer {expired}"})
    assert resp.status_code == 401


def test_wrong_signing_key_returns_401(client, admin_user):
    forged = jwt.encode(
        {"sub": admin_user.email, "type": "access"},
        "wrong-secret-key-completely-different",
        algorithm=settings.algorithm,
    )
    resp = client.get(_PROTECTED, headers={"Authorization": f"Bearer {forged}"})
    assert resp.status_code == 401


def test_tampered_payload_returns_401(client, admin_user):
    """Modify the payload bytes without updating the signature."""
    valid = create_access_token({"sub": admin_user.email})
    header, _, sig = valid.split(".")
    evil_payload = base64.urlsafe_b64encode(
        json.dumps({"sub": "evil@attacker.com", "type": "access"}).encode()
    ).decode().rstrip("=")
    tampered = f"{header}.{evil_payload}.{sig}"
    resp = client.get(_PROTECTED, headers={"Authorization": f"Bearer {tampered}"})
    assert resp.status_code == 401


def test_mfa_pending_token_rejected_as_access(client, admin_user):
    """A token with type='mfa_pending' must not grant API access."""
    mfa_token = jwt.encode(
        {
            "sub": admin_user.email,
            "type": "mfa_pending",
            "exp": datetime.now(timezone.utc) + timedelta(minutes=5),
        },
        settings.secret_key,
        algorithm=settings.algorithm,
    )
    resp = client.get(_PROTECTED, headers={"Authorization": f"Bearer {mfa_token}"})
    assert resp.status_code == 401


def test_token_with_no_type_field_rejected(client, admin_user):
    """Tokens missing the 'type' claim must be rejected."""
    no_type = jwt.encode(
        {
            "sub": admin_user.email,
            "exp": datetime.now(timezone.utc) + timedelta(minutes=15),
        },
        settings.secret_key,
        algorithm=settings.algorithm,
    )
    resp = client.get(_PROTECTED, headers={"Authorization": f"Bearer {no_type}"})
    assert resp.status_code == 401


def test_token_for_nonexistent_user_returns_401(client):
    token = create_access_token({"sub": "ghost@nowhere.local"})
    resp = client.get(_PROTECTED, headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 401


# ── Account state checks ───────────────────────────────────────────────────────

def test_inactive_user_returns_403(client, db, tenant_a):
    user = make_user(db, "Admin", tenant_a.id, is_active=False)
    resp = client.get(_PROTECTED, headers=auth_headers(user))
    assert resp.status_code == 403


# ── Role-based access control ──────────────────────────────────────────────────

def test_analyst_cannot_access_admin_endpoint(client, analyst_user):
    resp = client.post(
        _ADMIN_ONLY,
        json={"type": "IPv4", "value": "1.2.3.4"},
        headers=auth_headers(analyst_user),
    )
    assert resp.status_code == 403


def test_viewer_role_blocked_from_analyst_endpoint(client, db, tenant_a):
    viewer = make_user(db, "Viewer", tenant_a.id)
    resp = client.get(_PROTECTED, headers=auth_headers(viewer))
    assert resp.status_code == 403


def test_admin_can_access_admin_endpoint(client, admin_user):
    resp = client.get(_ADMIN_ONLY, headers=auth_headers(admin_user))
    assert resp.status_code == 200


# ── MFA enforcement ────────────────────────────────────────────────────────────

def test_mfa_required_tenant_blocks_non_mfa_user(client, db):
    tenant = Tenant(name=uid("mfatenant_"), api_key=uuid.uuid4().hex, require_mfa=True)
    db.add(tenant); db.commit(); db.refresh(tenant)
    user = make_user(db, "Admin", tenant.id, mfa_enabled=False)
    resp = client.get(_PROTECTED, headers=auth_headers(user))
    assert resp.status_code == 403
    assert resp.json()["detail"] == "MFA_REQUIRED"
    assert resp.headers.get("x-mfa-setup-required") == "true"


def test_mfa_required_tenant_allows_mfa_enabled_user(client, db):
    tenant = Tenant(name=uid("mfatenant2_"), api_key=uuid.uuid4().hex, require_mfa=True)
    db.add(tenant); db.commit(); db.refresh(tenant)
    user = make_user(db, "Admin", tenant.id, mfa_enabled=True)
    resp = client.get(_PROTECTED, headers=auth_headers(user))
    assert resp.status_code == 200


def test_mfa_required_superadmin_bypasses_enforcement(client, db):
    tenant = Tenant(name=uid("mfatenant3_"), api_key=uuid.uuid4().hex, require_mfa=True)
    db.add(tenant); db.commit(); db.refresh(tenant)
    superadmin = make_user(db, "SuperAdmin", tenant.id, mfa_enabled=False)
    resp = client.get(_PROTECTED, headers=auth_headers(superadmin))
    assert resp.status_code == 200


# ── Input validation (SQL injection) ──────────────────────────────────────────

def test_sql_injection_in_search_param_does_not_error(client, analyst_user):
    """Search param with SQL metacharacters must not cause a 500."""
    evil = "'; DROP TABLE iocs; --"
    resp = client.get(_ADMIN_ONLY, params={"search": evil}, headers=auth_headers(analyst_user))
    assert resp.status_code == 200


def test_sql_injection_in_alert_search_does_not_error(client, analyst_user):
    evil = "1' OR '1'='1"
    resp = client.get(_PROTECTED, params={"search": evil}, headers=auth_headers(analyst_user))
    assert resp.status_code == 200

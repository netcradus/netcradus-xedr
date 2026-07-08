"""
API tests for /api/v1/auth — registration, login, refresh, logout, MFA.
"""
import uuid
from datetime import datetime, timedelta, timezone
from unittest.mock import patch

import pytest
from jose import jwt

from app.core.config import settings
from app.models.tenant import Tenant
from app.models.user import User
from tests.conftest import auth_headers, make_user, uid


# ── POST /auth/register ────────────────────────────────────────────────────────

class TestRegister:
    URL = "/api/v1/auth/register"

    def test_register_creates_tenant_and_returns_token(self, client, db):
        payload = {
            "name": "Alice",
            "email": uid("alice") + "@example.com",
            "company": uid("CorpA"),
            "password": "StrongPass@1",
            "plan": "free",
        }
        resp = client.post(self.URL, json=payload)
        assert resp.status_code in (200, 201)
        data = resp.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"
        # Tenant and user should exist in DB
        tenant = db.query(Tenant).filter(Tenant.name == payload["company"]).first()
        assert tenant is not None
        user = db.query(User).filter(User.email == payload["email"]).first()
        assert user is not None

    def test_register_duplicate_email_rejected(self, client, db, tenant_a):
        email = uid("dup") + "@example.com"
        make_user(db, "Admin", tenant_a.id, email=email)
        payload = {
            "name": "Bob",
            "email": email,
            "company": uid("UniqCo"),
            "password": "StrongPass@1",
        }
        resp = client.post(self.URL, json=payload)
        assert resp.status_code == 409

    def test_register_duplicate_company_rejected(self, client, db, tenant_a):
        payload = {
            "name": "Carol",
            "email": uid("carol") + "@example.com",
            "company": tenant_a.name,  # already exists
            "password": "StrongPass@1",
        }
        resp = client.post(self.URL, json=payload)
        assert resp.status_code == 409

    def test_register_invalid_plan_falls_back_to_free(self, client, db):
        email = uid("plan") + "@example.com"
        resp = client.post(self.URL, json={
            "name": "Dave",
            "email": email,
            "company": uid("PlanCo"),
            "password": "StrongPass@1",
            "plan": "diamond",  # invalid — should fall back to "free"
        })
        assert resp.status_code in (200, 201)
        user = db.query(User).filter(User.email == email).first()
        assert user is not None
        tenant = db.query(Tenant).filter(Tenant.id == user.tenant_id).first()
        assert tenant.plan == "free"


# ── POST /auth/login ───────────────────────────────────────────────────────────

class TestLogin:
    URL = "/api/v1/auth/login"

    def test_login_valid_credentials_returns_token(self, client, admin_user):
        resp = client.post(self.URL, data={
            "username": admin_user.email,
            "password": "TestPass123!",
        })
        assert resp.status_code == 200
        assert "access_token" in resp.json()

    def test_login_wrong_password_returns_401(self, client, admin_user):
        resp = client.post(self.URL, data={
            "username": admin_user.email,
            "password": "WrongPassword!",
        })
        assert resp.status_code == 401

    def test_login_nonexistent_user_returns_401(self, client):
        resp = client.post(self.URL, data={
            "username": "nobody@nowhere.com",
            "password": "anything",
        })
        assert resp.status_code == 401

    def test_login_inactive_user_returns_401(self, client, db, tenant_a):
        user = make_user(db, "Admin", tenant_a.id, is_active=False)
        resp = client.post(self.URL, data={
            "username": user.email,
            "password": "TestPass123!",
        })
        # authenticate_user returns None for inactive, or the endpoint raises 401
        assert resp.status_code in (401, 403)

    def test_login_mfa_enabled_returns_mfa_session(self, client, db, tenant_a):
        import pyotp
        user = make_user(db, "Admin", tenant_a.id, mfa_enabled=True)
        # Give the user a TOTP secret
        user.totp_secret = pyotp.random_base32()
        db.commit()
        resp = client.post(self.URL, data={
            "username": user.email,
            "password": "TestPass123!",
        })
        assert resp.status_code == 200
        data = resp.json()
        # Should return mfa_session, not access_token
        assert "mfa_session" in data
        assert "access_token" not in data


# ── POST /auth/refresh ─────────────────────────────────────────────────────────

class TestRefresh:
    URL = "/api/v1/auth/refresh"

    def test_refresh_without_cookie_returns_401(self, client):
        resp = client.post(self.URL)
        assert resp.status_code == 401

    def test_refresh_with_valid_cookie_returns_new_token(self, client, admin_user, db):
        import secrets
        from datetime import datetime, timedelta, timezone
        # Set a refresh token on the user
        token = secrets.token_hex(64)
        admin_user.refresh_token = token
        admin_user.refresh_token_expires = datetime.now(timezone.utc) + timedelta(days=30)
        db.commit()
        resp = client.post(self.URL, cookies={"refresh_token": token})
        assert resp.status_code == 200
        assert "access_token" in resp.json()


# ── POST /auth/logout ──────────────────────────────────────────────────────────

class TestLogout:
    URL = "/api/v1/auth/logout"

    def test_logout_clears_refresh_token(self, client, admin_user, db):
        import secrets
        from datetime import datetime, timedelta, timezone
        token = secrets.token_hex(64)
        admin_user.refresh_token = token
        admin_user.refresh_token_expires = datetime.now(timezone.utc) + timedelta(days=30)
        db.commit()
        resp = client.post(self.URL, cookies={"refresh_token": token})
        assert resp.status_code == 200
        db.refresh(admin_user)
        assert admin_user.refresh_token is None


# ── GET /auth/verify-email ─────────────────────────────────────────────────────

class TestEmailVerification:
    URL = "/api/v1/auth/verify-email"

    def test_verify_valid_token_sets_verified(self, client, admin_user, db):
        import secrets
        token = secrets.token_urlsafe(32)
        admin_user.email_verification_token = token
        admin_user.email_verified = False
        db.commit()
        resp = client.get(self.URL, params={"token": token})
        assert resp.status_code == 200
        db.refresh(admin_user)
        assert admin_user.email_verified is True

    def test_verify_invalid_token_returns_400(self, client):
        resp = client.get(self.URL, params={"token": "invalid-token-xyz"})
        assert resp.status_code == 400


# ── GET /auth/mfa/setup ────────────────────────────────────────────────────────

class TestMFASetup:
    def test_mfa_setup_returns_secret_and_qr(self, client, admin_user):
        resp = client.get("/api/v1/auth/mfa/setup", headers=auth_headers(admin_user))
        assert resp.status_code == 200
        data = resp.json()
        assert "secret" in data
        assert "qr_code" in data

    def test_mfa_setup_requires_auth(self, client):
        resp = client.get("/api/v1/auth/mfa/setup")
        assert resp.status_code == 401

import io
import secrets
from datetime import datetime, timedelta, timezone

import pyotp
import qrcode
from fastapi import APIRouter, Cookie, Depends, HTTPException, Request, Response, status
from fastapi.security import OAuth2PasswordRequestForm
from jose import jwt
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.dependencies import get_current_user
from app.core.limiter import limiter
from app.core.security import create_access_token, hash_password, verify_password
from app.database.db import get_db
from app.models.role import Role
from app.models.tenant import Tenant
from app.models.user import User
from app.schemas.user_schema import UserCreate
from app.services.email_service import send_password_reset_email, send_verification_email
from app.services.user_service import authenticate_user, create_user

router = APIRouter(prefix="/auth", tags=["Authentication"])

# Matches billing VALID_PLANS in app.core.billing
VALID_PLANS = {"free", "professional", "enterprise"}
_REFRESH_COOKIE = "refresh_token"
_MFA_SESSION_MINUTES = 5


def _access_token_for(user: User) -> str:
    """Build an access token that embeds the user's password_changed_at timestamp.

    The ``pwd_iat`` claim lets get_current_user invalidate tokens that were
    issued before the most recent password change (LOW-12 VAPT fix).
    """
    data: dict = {"sub": user.email}
    if user.password_changed_at is not None:
        ts = user.password_changed_at
        if ts.tzinfo is None:
            ts = ts.replace(tzinfo=timezone.utc)
        data["pwd_iat"] = int(ts.timestamp())
    return create_access_token(data)


# ── Schemas ───────────────────────────────────────────────────────────────────

class RegisterRequest(BaseModel):
    name: str
    email: EmailStr
    company: str
    password: str
    plan: str = "Free"


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str


class MFACodeRequest(BaseModel):
    code: str


class MFASessionVerifyRequest(BaseModel):
    mfa_session: str
    code: str


# ── Internal helpers ──────────────────────────────────────────────────────────

def _set_refresh_cookie(user: User, db: Session, response: Response) -> None:
    token = secrets.token_hex(64)
    expires = datetime.now(timezone.utc) + timedelta(days=settings.refresh_token_expire_days)
    user.refresh_token = token
    user.refresh_token_expires = expires
    db.commit()
    response.set_cookie(
        key=_REFRESH_COOKIE,
        value=token,
        httponly=True,
        secure=not settings.debug,   # True in production (HTTPS), False when DEBUG=true
        samesite="lax",
        max_age=settings.refresh_token_expire_days * 86400,
        path="/auth",
    )


def _clear_refresh_cookie(response: Response) -> None:
    response.delete_cookie(key=_REFRESH_COOKIE, path="/auth")


def _create_mfa_session(email: str) -> str:
    payload = {
        "sub": email,
        "type": "mfa_pending",
        "exp": datetime.now(timezone.utc) + timedelta(minutes=_MFA_SESSION_MINUTES),
    }
    return jwt.encode(payload, settings.secret_key, algorithm=settings.algorithm)


def _decode_mfa_session(token: str) -> str | None:
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
        if payload.get("type") != "mfa_pending":
            return None
        return payload.get("sub")
    except Exception:
        return None


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/register", status_code=201)
@limiter.limit("5/minute")
def register(
    request: Request,
    body: RegisterRequest,
    response: Response,
    db: Session = Depends(get_db),
):
    """Self-service tenant registration. Creates Tenant + Admin user atomically."""
    body.email = body.email.strip().lower()
    body.company = body.company.strip()

    if len(body.password) < 8:
        raise HTTPException(status_code=422, detail="Password must be at least 8 characters")

    if db.query(User).filter(User.email == body.email).first():
        raise HTTPException(status_code=409, detail="Email already registered")

    if db.query(Tenant).filter(Tenant.name == body.company).first():
        raise HTTPException(status_code=409, detail="Company name already taken")

    plan = body.plan.lower() if body.plan.lower() in VALID_PLANS else "free"

    tenant = Tenant(
        name=body.company,
        api_key=secrets.token_hex(32),
        is_active=True,
        plan=plan,
    )
    db.add(tenant)
    db.flush()

    admin_role = db.query(Role).filter(Role.name == "Admin").first()
    if not admin_role:
        raise HTTPException(status_code=500, detail="Roles not seeded — run seed.py first")

    verification_token = secrets.token_urlsafe(32)
    user = User(
        name=body.name.strip(),
        email=body.email,
        password=hash_password(body.password),
        role_id=admin_role.id,
        tenant_id=tenant.id,
        is_active=True,
        email_verified=False,
        email_verification_token=verification_token,
    )
    db.add(user)
    db.commit()

    try:
        send_verification_email(user.email, verification_token)
    except Exception:
        pass

    try:
        from app.services.audit_service import log_event
        log_event(db, tenant_id=tenant.id, action="REGISTER",
                  user_id=user.id, user_name=user.name,
                  resource_type="Tenant", resource_id=tenant.id,
                  details=f"New tenant '{tenant.name}' registered (plan: {plan})")
    except Exception:
        pass

    token = _access_token_for(user)
    _set_refresh_cookie(user, db, response)
    return {
        "access_token": token,
        "token_type": "bearer",
        "tenant_api_key": tenant.api_key,
        "tenant_name": tenant.name,
        "email_verified": False,
    }


@router.post("/signup")
@limiter.limit("5/minute")
def signup(request: Request, user: UserCreate, db: Session = Depends(get_db)):
    """Legacy signup — assigns user to Default tenant. Use /register instead."""
    db_user = create_user(db, user)
    if db_user is None:
        raise HTTPException(status_code=400, detail="Email already registered")
    return {"message": "User created successfully"}


@router.post("/login")
@limiter.limit("10/minute")
def login(
    request: Request,
    response: Response,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    db_user = authenticate_user(db, form_data.username, form_data.password)
    if not db_user:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    if not db_user.is_active:
        raise HTTPException(status_code=403, detail="Account is deactivated")

    # MFA flow — return a short-lived session token instead of full access token
    if db_user.mfa_enabled and db_user.totp_secret:
        return {"mfa_required": True, "mfa_session": _create_mfa_session(db_user.email)}

    try:
        from app.services.audit_service import log_event
        log_event(db, tenant_id=db_user.tenant_id, action="LOGIN",
                  user_id=db_user.id, user_name=db_user.name,
                  resource_type="User", resource_id=db_user.id,
                  details="Successful login")
    except Exception:
        pass

    token = _access_token_for(db_user)
    _set_refresh_cookie(db_user, db, response)
    return {"access_token": token, "token_type": "bearer"}


@router.post("/refresh")
def refresh_token(
    response: Response,
    refresh_token: str | None = Cookie(default=None, alias=_REFRESH_COOKIE),
    db: Session = Depends(get_db),
):
    """Exchange a valid refresh token cookie for a new access token (rotates token)."""
    if not refresh_token:
        raise HTTPException(status_code=401, detail="No refresh token")

    user = db.query(User).filter(User.refresh_token == refresh_token).first()
    if not user:
        raise HTTPException(status_code=401, detail="Invalid refresh token")

    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account is deactivated")

    expires = user.refresh_token_expires
    if expires:
        if expires.tzinfo is None:
            expires = expires.replace(tzinfo=timezone.utc)
        if datetime.now(timezone.utc) > expires:
            _clear_refresh_cookie(response)
            raise HTTPException(status_code=401, detail="Refresh token expired")

    new_access = _access_token_for(user)
    _set_refresh_cookie(user, db, response)   # rotate refresh token
    return {"access_token": new_access, "token_type": "bearer"}


@router.post("/logout")
def logout(
    response: Response,
    refresh_token: str | None = Cookie(default=None, alias=_REFRESH_COOKIE),
    db: Session = Depends(get_db),
):
    if refresh_token:
        user = db.query(User).filter(User.refresh_token == refresh_token).first()
        if user:
            user.refresh_token = None
            user.refresh_token_expires = None
            db.commit()
    _clear_refresh_cookie(response)
    return {"message": "Logged out"}


@router.get("/verify-email")
def verify_email(token: str, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email_verification_token == token).first()
    if not user:
        raise HTTPException(status_code=400, detail="Invalid or expired verification link")
    user.email_verified = True
    user.email_verification_token = None
    db.commit()
    return {"message": "Email verified successfully"}


@router.post("/forgot-password")
@limiter.limit("3/minute")
def forgot_password(
    request: Request,
    body: ForgotPasswordRequest,
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.email == body.email.strip().lower()).first()
    if user:
        reset_token = secrets.token_urlsafe(32)
        user.password_reset_token = reset_token
        user.password_reset_expires = datetime.now(timezone.utc) + timedelta(hours=1)
        db.commit()
        try:
            send_password_reset_email(user.email, reset_token)
        except Exception:
            pass
    return {"message": "If that email is registered, a reset link has been sent."}


@router.post("/reset-password")
@limiter.limit("5/minute")
def reset_password(
    request: Request,
    body: ResetPasswordRequest,
    db: Session = Depends(get_db),
):
    if len(body.new_password) < 8:
        raise HTTPException(status_code=422, detail="Password must be at least 8 characters")

    user = db.query(User).filter(User.password_reset_token == body.token).first()
    if not user:
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")

    expires = user.password_reset_expires
    if expires:
        if expires.tzinfo is None:
            expires = expires.replace(tzinfo=timezone.utc)
        if datetime.now(timezone.utc) > expires:
            raise HTTPException(status_code=400, detail="Reset token has expired")

    user.password = hash_password(body.new_password)
    user.password_reset_token = None
    user.password_reset_expires = None
    # Stamp the change time so any outstanding access tokens are rejected
    # by the pwd_iat check in get_current_user (LOW-12 VAPT fix).
    user.password_changed_at = datetime.now(timezone.utc)
    # Invalidate all active sessions — anyone holding an old refresh token is kicked out
    user.refresh_token = None
    user.refresh_token_expires = None
    db.commit()
    return {"message": "Password reset successfully"}


@router.post("/resend-verification")
@limiter.limit("3/minute")
def resend_verification(
    request: Request,
    body: ForgotPasswordRequest,
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.email == body.email.strip().lower()).first()
    if user and not user.email_verified:
        token = user.email_verification_token or secrets.token_urlsafe(32)
        user.email_verification_token = token
        db.commit()
        try:
            send_verification_email(user.email, token)
        except Exception:
            pass
    return {"message": "If your email is unverified, a new link has been sent."}


# ── MFA Endpoints ─────────────────────────────────────────────────────────────

@router.get("/mfa/setup")
def mfa_setup(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Generate TOTP secret and return provisioning URI + QR code (base64 PNG)."""
    if current_user.mfa_enabled:
        raise HTTPException(status_code=400, detail="MFA is already enabled")

    secret = pyotp.random_base32()
    totp = pyotp.TOTP(secret)
    uri = totp.provisioning_uri(name=current_user.email, issuer_name="NetcradXDR")

    # Save secret (not yet active — user must verify first via /mfa/enable)
    current_user.totp_secret = secret
    db.commit()

    qr_data_url: str | None = None
    try:
        img = qrcode.make(uri)
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        import base64
        qr_data_url = "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()
    except Exception:
        pass

    return {"secret": secret, "provisioning_uri": uri, "qr_code": qr_data_url}


@router.post("/mfa/enable")
def mfa_enable(
    body: MFACodeRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Verify TOTP code to confirm and enable MFA."""
    if not current_user.totp_secret:
        raise HTTPException(status_code=400, detail="Call /auth/mfa/setup first")
    if current_user.mfa_enabled:
        raise HTTPException(status_code=400, detail="MFA is already enabled")

    totp = pyotp.TOTP(current_user.totp_secret)
    if not totp.verify(body.code, valid_window=1):
        raise HTTPException(status_code=400, detail="Invalid authenticator code")

    current_user.mfa_enabled = True
    db.commit()
    return {"message": "MFA enabled successfully"}


@router.post("/mfa/disable")
def mfa_disable(
    body: MFACodeRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Verify TOTP code and disable MFA."""
    if not current_user.mfa_enabled:
        raise HTTPException(status_code=400, detail="MFA is not enabled")

    totp = pyotp.TOTP(current_user.totp_secret)
    if not totp.verify(body.code, valid_window=1):
        raise HTTPException(status_code=400, detail="Invalid authenticator code")

    current_user.mfa_enabled = False
    current_user.totp_secret = None
    db.commit()
    return {"message": "MFA disabled"}


@router.post("/mfa/verify")
@limiter.limit("5/minute")
def mfa_verify(
    request: Request,
    body: MFASessionVerifyRequest,
    response: Response,
    db: Session = Depends(get_db),
):
    """Complete MFA login: validate session token + TOTP code, issue full tokens."""
    email = _decode_mfa_session(body.mfa_session)
    if not email:
        raise HTTPException(status_code=401, detail="Invalid or expired MFA session")

    user = db.query(User).filter(User.email == email).first()
    if not user or not user.mfa_enabled or not user.totp_secret:
        raise HTTPException(status_code=401, detail="MFA session invalid")

    totp = pyotp.TOTP(user.totp_secret)
    if not totp.verify(body.code, valid_window=1):
        raise HTTPException(status_code=400, detail="Invalid authenticator code")

    try:
        from app.services.audit_service import log_event
        log_event(db, tenant_id=user.tenant_id, action="LOGIN",
                  user_id=user.id, user_name=user.name,
                  resource_type="User", resource_id=user.id,
                  details="Successful login with MFA")
    except Exception:
        pass

    token = _access_token_for(user)
    _set_refresh_cookie(user, db, response)
    return {"access_token": token, "token_type": "bearer"}

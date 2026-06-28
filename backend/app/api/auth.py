import secrets
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session

from app.core.config import settings
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

VALID_PLANS = {"Free", "Pro", "Enterprise"}


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


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/register", status_code=201)
@limiter.limit("5/minute")
def register(
    request: Request,
    body: RegisterRequest,
    db: Session = Depends(get_db),
):
    """
    Self-service tenant registration.
    Creates a new Tenant + Admin user in a single transaction.
    Returns an access token so the frontend can auto-login.
    """
    body.email = body.email.strip().lower()
    body.company = body.company.strip()

    if len(body.password) < 8:
        raise HTTPException(status_code=422, detail="Password must be at least 8 characters")

    if db.query(User).filter(User.email == body.email).first():
        raise HTTPException(status_code=409, detail="Email already registered")

    if db.query(Tenant).filter(Tenant.name == body.company).first():
        raise HTTPException(status_code=409, detail="Company name already taken")

    plan = body.plan if body.plan in VALID_PLANS else "Free"

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

    token = create_access_token({"sub": user.email})
    return {
        "access_token": token,
        "token_type": "bearer",
        "tenant_api_key": tenant.api_key,
        "tenant_name": tenant.name,
        "email_verified": False,
    }


@router.post("/signup")
def signup(
    user: UserCreate,
    db: Session = Depends(get_db),
):
    """Legacy signup — assigns user to Default tenant as Viewer. Use /register instead."""
    db_user = create_user(db, user)
    if db_user is None:
        raise HTTPException(status_code=400, detail="Email already registered")
    return {"message": "User created successfully"}


@router.post("/login")
@limiter.limit("10/minute")
def login(
    request: Request,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    db_user = authenticate_user(db, form_data.username, form_data.password)
    if not db_user:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    if not db_user.is_active:
        raise HTTPException(status_code=403, detail="Account is deactivated")

    token = create_access_token({"sub": db_user.email})

    try:
        from app.services.audit_service import log_event
        log_event(db, tenant_id=db_user.tenant_id, action="LOGIN",
                  user_id=db_user.id, user_name=db_user.name,
                  resource_type="User", resource_id=db_user.id,
                  details="Successful login")
    except Exception:
        pass

    return {"access_token": token, "token_type": "bearer"}


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
    # Always return 200 — don't reveal whether the email exists
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

from datetime import timezone

from fastapi import Depends, HTTPException, status
from jose import JWTError, jwt
from sqlalchemy.orm import Session, joinedload

from app.database.db import get_db
from app.models.user import User
from app.core.security import (
    oauth2_scheme,
    SECRET_KEY,
    ALGORITHM
)


def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials"
    )

    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        # Reject MFA-session tokens and any other non-access token types
        if payload.get("type") != "access":
            raise credentials_exception
        email = payload.get("sub")
        if email is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    pwd_iat: int | None = payload.get("pwd_iat")

    user = (
        db.query(User)
        .options(joinedload(User.role), joinedload(User.tenant))
        .filter(User.email == email)
        .first()
    )

    if user is None:
        raise credentials_exception

    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account is deactivated")

    if not user.email_verified:
        raise HTTPException(
            status_code=403,
            detail="EMAIL_NOT_VERIFIED",
            headers={"X-Email-Verification-Required": "true"},
        )

    # Reject tokens that were issued before the user's most recent password change
    # (LOW-12 VAPT fix). Backwards-compatible: tokens without pwd_iat are accepted.
    if pwd_iat is not None and user.password_changed_at is not None:
        changed = user.password_changed_at
        if changed.tzinfo is None:
            changed = changed.replace(tzinfo=timezone.utc)
        if pwd_iat < int(changed.timestamp()):
            raise credentials_exception

    # Enforce tenant-level MFA policy.  SuperAdmin / PlatformAdmin are cross-tenant
    # service roles that are exempt — they can still enroll MFA voluntarily.
    if (
        getattr(user.tenant, "require_mfa", False)
        and not user.mfa_enabled
        and user.role.name not in ("SuperAdmin", "PlatformAdmin")
    ):
        raise HTTPException(
            status_code=403,
            detail="MFA_REQUIRED",
            headers={"X-MFA-Setup-Required": "true"},
        )

    return user
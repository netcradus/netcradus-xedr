from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session
from typing import Optional

from app.database.db import get_db
from app.core.permissions import admin_required, analyst_required
from app.core.dependencies import get_current_user
from app.core.security import hash_password, verify_password
from app.models.user import User
from app.models.role import Role
from app.models.tenant import Tenant

router = APIRouter(prefix="/settings", tags=["Settings"])


# ── Schemas ──────────────────────────────────────────────────────────────────

class UpdateOrgPayload(BaseModel):
    name: str


class InviteUserPayload(BaseModel):
    name: str
    email: EmailStr
    role: str
    temp_password: str


class ChangeRolePayload(BaseModel):
    role: str


class ChangePasswordPayload(BaseModel):
    current_password: str
    new_password: str


class SecuritySettingsPayload(BaseModel):
    require_mfa: bool


# ── Helpers ───────────────────────────────────────────────────────────────────

def _user_dict(u: User) -> dict:
    return {
        "id": u.id,
        "name": u.name,
        "email": u.email,
        "role": u.role.name if u.role else "Viewer",
        "is_active": u.is_active,
    }


def _tenant_dict(t: Tenant) -> dict:
    return {
        "id":          t.id,
        "name":        t.name,
        "api_key":     t.api_key,
        "is_active":   t.is_active,
        "require_mfa": getattr(t, "require_mfa", False),
    }


# ── Organization ──────────────────────────────────────────────────────────────

@router.get("/org")
def get_org(
    current_user: User = Depends(analyst_required),
    db: Session = Depends(get_db),
):
    tenant = db.query(Tenant).filter(Tenant.id == current_user.tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    return _tenant_dict(tenant)


@router.put("/org")
def update_org(
    payload: UpdateOrgPayload,
    current_user: User = Depends(admin_required),
    db: Session = Depends(get_db),
):
    name = payload.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Organization name cannot be empty")

    # Ensure the new name isn't already taken by another tenant
    conflict = (
        db.query(Tenant)
        .filter(Tenant.name == name, Tenant.id != current_user.tenant_id)
        .first()
    )
    if conflict:
        raise HTTPException(status_code=400, detail="Organization name already in use")

    tenant = db.query(Tenant).filter(Tenant.id == current_user.tenant_id).first()
    tenant.name = name
    db.commit()
    db.refresh(tenant)
    return _tenant_dict(tenant)


# ── Team management ───────────────────────────────────────────────────────────

@router.get("/team")
def list_team(
    current_user: User = Depends(admin_required),
    db: Session = Depends(get_db),
):
    users = (
        db.query(User)
        .filter(User.tenant_id == current_user.tenant_id)
        .order_by(User.id)
        .all()
    )
    return [_user_dict(u) for u in users]


@router.post("/team/invite")
def invite_member(
    payload: InviteUserPayload,
    current_user: User = Depends(admin_required),
    db: Session = Depends(get_db),
):
    # Block elevating to SuperAdmin
    if payload.role == "SuperAdmin":
        raise HTTPException(status_code=403, detail="Cannot assign SuperAdmin role")

    # Resolve role
    role = db.query(Role).filter(Role.name == payload.role).first()
    if not role:
        raise HTTPException(status_code=400, detail=f"Unknown role: {payload.role}")

    # Unique email check
    if db.query(User).filter(User.email == payload.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")

    user = User(
        name=payload.name.strip(),
        email=payload.email,
        password=hash_password(payload.temp_password),
        role_id=role.id,
        tenant_id=current_user.tenant_id,
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    try:
        from app.services.audit_service import log_event
        log_event(db, tenant_id=current_user.tenant_id, action="INVITE_USER",
                  user_id=current_user.id, user_name=current_user.name,
                  resource_type="User", resource_id=user.id,
                  details=f"Invited {user.name} ({user.email}) as {payload.role}")
    except Exception:
        pass

    return _user_dict(user)


@router.put("/team/{user_id}/role")
def change_role(
    user_id: int,
    payload: ChangeRolePayload,
    current_user: User = Depends(admin_required),
    db: Session = Depends(get_db),
):
    if payload.role == "SuperAdmin":
        raise HTTPException(status_code=403, detail="Cannot assign SuperAdmin role")

    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot change your own role")

    user = (
        db.query(User)
        .filter(User.id == user_id, User.tenant_id == current_user.tenant_id)
        .first()
    )
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    role = db.query(Role).filter(Role.name == payload.role).first()
    if not role:
        raise HTTPException(status_code=400, detail=f"Unknown role: {payload.role}")

    user.role_id = role.id
    db.commit()
    db.refresh(user)
    return _user_dict(user)


@router.put("/team/{user_id}/status")
def toggle_user_status(
    user_id: int,
    current_user: User = Depends(admin_required),
    db: Session = Depends(get_db),
):
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot deactivate your own account")

    user = (
        db.query(User)
        .filter(User.id == user_id, User.tenant_id == current_user.tenant_id)
        .first()
    )
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.is_active = not user.is_active
    db.commit()
    db.refresh(user)
    return _user_dict(user)


# ── Security policy ──────────────────────────────────────────────────────────

@router.get("/security")
def get_security_settings(
    current_user: User = Depends(admin_required),
    db: Session = Depends(get_db),
):
    """Return the tenant's security policy (MFA enforcement, etc.)."""
    tenant = db.query(Tenant).filter(Tenant.id == current_user.tenant_id).first()
    return {"require_mfa": getattr(tenant, "require_mfa", False)}


@router.put("/security")
def update_security_settings(
    payload: SecuritySettingsPayload,
    current_user: User = Depends(admin_required),
    db: Session = Depends(get_db),
):
    """Enable or disable mandatory MFA for all users in this tenant."""
    tenant = db.query(Tenant).filter(Tenant.id == current_user.tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    tenant.require_mfa = payload.require_mfa
    db.commit()

    try:
        from app.services.audit_service import log_event
        action = "REQUIRE_MFA_ENABLED" if payload.require_mfa else "REQUIRE_MFA_DISABLED"
        log_event(
            db, tenant_id=current_user.tenant_id, action=action,
            user_id=current_user.id, user_name=current_user.name,
            resource_type="Tenant", resource_id=current_user.tenant_id,
            details=f"Tenant MFA enforcement set to {payload.require_mfa}",
        )
    except Exception:
        pass

    return {"require_mfa": tenant.require_mfa}


# ── Account ───────────────────────────────────────────────────────────────────

@router.put("/account/password")
def change_password(
    payload: ChangePasswordPayload,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not verify_password(payload.current_password, current_user.password):
        raise HTTPException(status_code=400, detail="Current password is incorrect")

    if len(payload.new_password) < 8:
        raise HTTPException(status_code=400, detail="New password must be at least 8 characters")

    current_user.password = hash_password(payload.new_password)
    db.commit()
    return {"message": "Password updated successfully"}

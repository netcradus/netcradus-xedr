import secrets
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.core.permissions import superadmin_required
from app.core.security import hash_password
from app.database.db import get_db
from app.models.agent import Agent
from app.models.alert import Alert
from app.models.role import Role
from app.models.tenant import Tenant
from app.models.user import User

router = APIRouter(prefix="/super-admin", tags=["SuperAdmin"])

PLANS = {"Free", "Pro", "Enterprise"}
ASSIGNABLE_ROLES = {"Admin", "Analyst", "Viewer"}


# ── Schemas ───────────────────────────────────────────────────────────────────

class CreateTenantRequest(BaseModel):
    name: str
    plan: Optional[str] = "Free"


class UpdateTenantStatusRequest(BaseModel):
    is_active: bool


class UpdateTenantPlanRequest(BaseModel):
    plan: str


class AddUserRequest(BaseModel):
    name: str
    email: str
    password: str
    role: str = "Analyst"


# ── Helpers ───────────────────────────────────────────────────────────────────

def _tenant_row(db: Session, t: Tenant) -> dict:
    user_count = db.query(func.count(User.id)).filter(User.tenant_id == t.id).scalar() or 0
    agent_count = db.query(func.count(Agent.id)).filter(Agent.tenant_id == t.id).scalar() or 0
    alert_count = (
        db.query(func.count(Alert.id))
        .join(Agent, Alert.agent_id == Agent.id)
        .filter(Agent.tenant_id == t.id)
        .scalar() or 0
    )
    return {
        "id": t.id,
        "name": t.name,
        "api_key_tail": ("•" * 8 + (t.api_key or "")[-4:]) if t.api_key else None,
        "is_active": t.is_active,
        "plan": t.plan or "Free",
        "user_count": user_count,
        "agent_count": agent_count,
        "alert_count": alert_count,
        "created_at": t.created_at.isoformat() if t.created_at else None,
    }


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/tenants")
def list_tenants(
        current_user: User = Depends(superadmin_required),
        db: Session = Depends(get_db)):
    tenants = db.query(Tenant).order_by(Tenant.id).all()
    return [_tenant_row(db, t) for t in tenants]


@router.post("/tenants", status_code=201)
def create_tenant(
        request: CreateTenantRequest,
        current_user: User = Depends(superadmin_required),
        db: Session = Depends(get_db)):
    existing = db.query(Tenant).filter(Tenant.name == request.name).first()
    if existing:
        raise HTTPException(status_code=409, detail="Tenant name already exists")
    plan = request.plan if request.plan in PLANS else "Free"
    tenant = Tenant(
        name=request.name.strip(),
        api_key=secrets.token_hex(32),
        is_active=True,
        plan=plan,
    )
    db.add(tenant)
    db.commit()
    db.refresh(tenant)
    return _tenant_row(db, tenant)


@router.put("/tenants/{tenant_id}/status")
def update_tenant_status(
        tenant_id: int,
        request: UpdateTenantStatusRequest,
        current_user: User = Depends(superadmin_required),
        db: Session = Depends(get_db)):
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    tenant.is_active = request.is_active
    db.commit()
    return {"id": tenant.id, "is_active": tenant.is_active}


@router.put("/tenants/{tenant_id}/plan")
def update_tenant_plan(
        tenant_id: int,
        request: UpdateTenantPlanRequest,
        current_user: User = Depends(superadmin_required),
        db: Session = Depends(get_db)):
    if request.plan not in PLANS:
        raise HTTPException(status_code=422, detail=f"Plan must be one of: {', '.join(PLANS)}")
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    tenant.plan = request.plan
    db.commit()
    return {"id": tenant.id, "plan": tenant.plan}


@router.get("/tenants/{tenant_id}/users")
def list_tenant_users(
        tenant_id: int,
        current_user: User = Depends(superadmin_required),
        db: Session = Depends(get_db)):
    if not db.query(Tenant).filter(Tenant.id == tenant_id).first():
        raise HTTPException(status_code=404, detail="Tenant not found")
    users = (
        db.query(User)
        .options(joinedload(User.role))
        .filter(User.tenant_id == tenant_id)
        .all()
    )
    return [
        {
            "id": u.id,
            "name": u.name,
            "email": u.email,
            "role": u.role.name if u.role else "Viewer",
            "is_active": u.is_active,
        }
        for u in users
    ]


@router.post("/tenants/{tenant_id}/users", status_code=201)
def add_tenant_user(
        tenant_id: int,
        request: AddUserRequest,
        current_user: User = Depends(superadmin_required),
        db: Session = Depends(get_db)):
    if not db.query(Tenant).filter(Tenant.id == tenant_id).first():
        raise HTTPException(status_code=404, detail="Tenant not found")
    if db.query(User).filter(User.email == request.email).first():
        raise HTTPException(status_code=409, detail="Email already registered")
    if request.role not in ASSIGNABLE_ROLES:
        raise HTTPException(status_code=422, detail=f"Role must be one of: {', '.join(ASSIGNABLE_ROLES)}")
    role = db.query(Role).filter(Role.name == request.role).first()
    if not role:
        raise HTTPException(status_code=422, detail=f"Role '{request.role}' not found in database")
    user = User(
        name=request.name.strip(),
        email=request.email.strip().lower(),
        password=hash_password(request.password),
        role_id=role.id,
        tenant_id=tenant_id,
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return {"id": user.id, "name": user.name, "email": user.email, "role": role.name, "is_active": user.is_active}


@router.delete("/tenants/{tenant_id}/users/{user_id}", status_code=204)
def remove_tenant_user(
        tenant_id: int,
        user_id: int,
        current_user: User = Depends(superadmin_required),
        db: Session = Depends(get_db)):
    user = (
        db.query(User)
        .options(joinedload(User.role))
        .filter(User.id == user_id, User.tenant_id == tenant_id)
        .first()
    )
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.role and user.role.name == "SuperAdmin":
        raise HTTPException(status_code=403, detail="Cannot remove a SuperAdmin user")
    if user.id == current_user.id:
        raise HTTPException(status_code=403, detail="Cannot remove yourself")
    db.delete(user)
    db.commit()


@router.get("/tenants/{tenant_id}/agents")
def list_tenant_agents(
        tenant_id: int,
        current_user: User = Depends(superadmin_required),
        db: Session = Depends(get_db)):
    if not db.query(Tenant).filter(Tenant.id == tenant_id).first():
        raise HTTPException(status_code=404, detail="Tenant not found")
    agents = db.query(Agent).filter(Agent.tenant_id == tenant_id).all()
    return [
        {
            "id": a.id,
            "hostname": a.hostname,
            "ip_address": a.ip_address,
            "os_type": a.os_type,
            "agent_version": a.agent_version,
            "status": a.status,
            "last_seen": a.last_seen.isoformat() if a.last_seen else None,
        }
        for a in agents
    ]


@router.delete("/tenants/{tenant_id}/agents/{agent_id}", status_code=204)
def remove_tenant_agent(
        tenant_id: int,
        agent_id: int,
        current_user: User = Depends(superadmin_required),
        db: Session = Depends(get_db)):
    agent = db.query(Agent).filter(Agent.id == agent_id, Agent.tenant_id == tenant_id).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    db.delete(agent)
    db.commit()


@router.get("/stats")
def platform_stats(
        current_user: User = Depends(superadmin_required),
        db: Session = Depends(get_db)):
    total_tenants = db.query(func.count(Tenant.id)).scalar() or 0
    active_tenants = db.query(func.count(Tenant.id)).filter(Tenant.is_active == True).scalar() or 0
    total_agents = db.query(func.count(Agent.id)).scalar() or 0
    online_agents = db.query(func.count(Agent.id)).filter(Agent.status == "Online").scalar() or 0
    total_users = db.query(func.count(User.id)).scalar() or 0
    total_alerts = db.query(func.count(Alert.id)).scalar() or 0
    return {
        "total_tenants": total_tenants,
        "active_tenants": active_tenants,
        "total_agents": total_agents,
        "online_agents": online_agents,
        "total_users": total_users,
        "total_alerts": total_alerts,
    }

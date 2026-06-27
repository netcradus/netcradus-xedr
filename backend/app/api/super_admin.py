import secrets
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.permissions import superadmin_required
from app.database.db import get_db
from app.models.agent import Agent
from app.models.alert import Alert
from app.models.tenant import Tenant
from app.models.user import User

router = APIRouter(prefix="/super-admin", tags=["SuperAdmin"])

PLANS = {"Free", "Pro", "Enterprise"}


# ── Schemas ───────────────────────────────────────────────────────────────────

class CreateTenantRequest(BaseModel):
    name: str
    plan: Optional[str] = "Free"


class UpdateTenantStatusRequest(BaseModel):
    is_active: bool


class UpdateTenantPlanRequest(BaseModel):
    plan: str


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

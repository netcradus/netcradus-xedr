from typing import Optional
from datetime import datetime

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.agent import Agent
from app.models.tenant import Tenant
from app.core.billing import PLAN_LIMITS, VALID_PLANS, PLAN_DISPLAY, agent_limit_for_plan


def get_plan_usage(db: Session, tenant_id: int) -> dict:
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant:
        raise HTTPException(404, "Tenant not found")

    plan = (tenant.plan or "free").lower()
    agent_count = db.query(Agent).filter(Agent.tenant_id == tenant_id).count()

    # Custom per-tenant override takes precedence over plan default
    limit: Optional[int] = (
        tenant.plan_agent_limit
        if tenant.plan_agent_limit is not None
        else agent_limit_for_plan(plan)
    )

    expires_at = None
    if tenant.plan_expires_at:
        expires_at = tenant.plan_expires_at.isoformat()

    return {
        "plan":            plan,
        "plan_display":    PLAN_DISPLAY.get(plan, plan.title()),
        "agents_used":     agent_count,
        "agents_limit":    limit,          # None = unlimited
        "agents_remaining": None if limit is None else max(0, limit - agent_count),
        "plan_expires_at": expires_at,
    }


def check_agent_quota(db: Session, tenant_id: int) -> bool:
    """Return True if one more agent can be registered under this tenant's plan."""
    usage = get_plan_usage(db, tenant_id)
    limit = usage["agents_limit"]
    if limit is None:
        return True
    return usage["agents_used"] < limit


def change_plan(
    db: Session,
    tenant_id: int,
    plan: str,
    agent_limit_override: Optional[int] = None,
    plan_expires_at: Optional[datetime] = None,
) -> dict:
    plan = plan.lower()
    if plan not in VALID_PLANS:
        raise HTTPException(400, f"Invalid plan. Valid plans: {VALID_PLANS}")

    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant:
        raise HTTPException(404, "Tenant not found")

    tenant.plan = plan
    if agent_limit_override is not None:
        tenant.plan_agent_limit = agent_limit_override
    if plan_expires_at is not None:
        tenant.plan_expires_at = plan_expires_at

    db.commit()
    db.refresh(tenant)
    return get_plan_usage(db, tenant_id)

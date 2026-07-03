from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.billing import PLAN_LIMITS, PLAN_DISPLAY
from app.core.permissions import admin_required, platform_admin_required
from app.database.db import get_db
from app.models.user import User
from app.services.billing_service import change_plan, get_plan_usage

router = APIRouter(prefix="/billing", tags=["Billing"])


class ChangePlanRequest(BaseModel):
    plan: str
    agent_limit_override: Optional[int] = None
    plan_expires_at: Optional[datetime] = None


# ── Tenant-scoped (any admin of the tenant) ────────────────────────────────────

@router.get("/plan")
def get_current_plan(
    current_user: User = Depends(admin_required),
    db: Session = Depends(get_db),
):
    """Return the current plan and live usage for the caller's tenant."""
    return get_plan_usage(db, current_user.tenant_id)


@router.get("/plans")
def list_plans(_: User = Depends(admin_required)):
    """Return all available plans with their limits."""
    return [
        {
            "plan":         key,
            "display":      PLAN_DISPLAY[key],
            "agents_limit": limit,
        }
        for key, limit in PLAN_LIMITS.items()
    ]


# ── Platform admin only ────────────────────────────────────────────────────────

@router.put("/plan/{tenant_id}")
def set_tenant_plan(
    tenant_id: int,
    request: ChangePlanRequest,
    current_user: User = Depends(platform_admin_required),
    db: Session = Depends(get_db),
):
    """
    Change a tenant's plan.
    agent_limit_override: custom cap that overrides the plan default.
    plan_expires_at: optional UTC datetime when the plan downgrades/expires.
    """
    return change_plan(
        db,
        tenant_id=tenant_id,
        plan=request.plan,
        agent_limit_override=request.agent_limit_override,
        plan_expires_at=request.plan_expires_at,
    )

from datetime import datetime, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy import func, text
from sqlalchemy.orm import Session

from app.core.permissions import superadmin_required
from app.database.db import get_db
from app.models.agent import Agent
from app.models.alert import Alert
from app.models.audit_log import AuditLog
from app.models.tenant import Tenant
from app.models.user import User

router = APIRouter(prefix="/platform", tags=["Platform Admin"])


@router.get("/overview")
def platform_overview(
    _=Depends(superadmin_required),
    db: Session = Depends(get_db),
):
    """Platform-wide KPIs and trend data for the SaaS operator."""
    now = datetime.utcnow()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)

    total_tenants    = db.query(func.count(Tenant.id)).scalar() or 0
    active_tenants   = db.query(func.count(Tenant.id)).filter(Tenant.is_active.is_(True)).scalar() or 0
    total_users      = db.query(func.count(User.id)).scalar() or 0
    total_agents     = db.query(func.count(Agent.id)).scalar() or 0
    online_agents    = db.query(func.count(Agent.id)).filter(Agent.status == "Online").scalar() or 0
    alerts_today     = db.query(func.count(Alert.id)).filter(Alert.timestamp >= today_start).scalar() or 0
    critical_today   = (
        db.query(func.count(Alert.id))
        .filter(Alert.timestamp >= today_start, Alert.severity == "Critical")
        .scalar() or 0
    )

    # Plan distribution
    plan_rows = db.query(Tenant.plan, func.count(Tenant.id)).group_by(Tenant.plan).all()
    plan_distribution = {(row[0] or "Free"): row[1] for row in plan_rows}

    # Signup trend — last 14 days
    signup_trend = []
    for i in range(13, -1, -1):
        day = (now - timedelta(days=i)).date()
        d0 = datetime.combine(day, datetime.min.time())
        d1 = datetime.combine(day, datetime.max.time())
        cnt = db.query(func.count(Tenant.id)).filter(Tenant.created_at >= d0, Tenant.created_at <= d1).scalar() or 0
        signup_trend.append({"date": day.strftime("%b %d"), "count": cnt})

    # Alert trend — last 7 days
    alert_trend = []
    for i in range(6, -1, -1):
        day = (now - timedelta(days=i)).date()
        d0 = datetime.combine(day, datetime.min.time())
        d1 = datetime.combine(day, datetime.max.time())
        cnt = db.query(func.count(Alert.id)).filter(Alert.timestamp >= d0, Alert.timestamp <= d1).scalar() or 0
        alert_trend.append({"date": day.strftime("%a"), "count": cnt})

    return {
        "total_tenants":    total_tenants,
        "active_tenants":   active_tenants,
        "total_users":      total_users,
        "total_agents":     total_agents,
        "online_agents":    online_agents,
        "alerts_today":     alerts_today,
        "critical_today":   critical_today,
        "plan_distribution": plan_distribution,
        "signup_trend":     signup_trend,
        "alert_trend":      alert_trend,
    }


@router.get("/tenants")
def platform_tenants(
    _=Depends(superadmin_required),
    db: Session = Depends(get_db),
):
    """All tenants with usage stats and last-activity timestamp."""
    tenants = db.query(Tenant).order_by(Tenant.created_at.desc()).all()
    result = []
    for t in tenants:
        user_count   = db.query(func.count(User.id)).filter(User.tenant_id == t.id).scalar() or 0
        agent_count  = db.query(func.count(Agent.id)).filter(Agent.tenant_id == t.id).scalar() or 0
        online_count = db.query(func.count(Agent.id)).filter(Agent.tenant_id == t.id, Agent.status == "Online").scalar() or 0
        alert_count  = (
            db.query(func.count(Alert.id))
            .join(Agent, Alert.agent_id == Agent.id)
            .filter(Agent.tenant_id == t.id)
            .scalar() or 0
        )
        last_log = (
            db.query(AuditLog.timestamp)
            .filter(AuditLog.tenant_id == t.id)
            .order_by(AuditLog.timestamp.desc())
            .first()
        )
        result.append({
            "id":            t.id,
            "name":          t.name,
            "plan":          t.plan or "Free",
            "is_active":     t.is_active,
            "user_count":    user_count,
            "agent_count":   agent_count,
            "online_agents": online_count,
            "alert_count":   alert_count,
            "created_at":    t.created_at.isoformat() if t.created_at else None,
            "last_activity": last_log[0].isoformat() if last_log and last_log[0] else None,
        })
    return result


@router.get("/activity")
def platform_activity(
    _=Depends(superadmin_required),
    db: Session = Depends(get_db),
):
    """Latest 100 audit log entries across all tenants."""
    rows = (
        db.query(AuditLog, Tenant.name.label("tenant_name"))
        .join(Tenant, AuditLog.tenant_id == Tenant.id)
        .order_by(AuditLog.timestamp.desc())
        .limit(100)
        .all()
    )
    return [
        {
            "id":            r.AuditLog.id,
            "tenant_id":     r.AuditLog.tenant_id,
            "tenant_name":   r.tenant_name,
            "user_name":     r.AuditLog.user_name,
            "action":        r.AuditLog.action,
            "resource_type": r.AuditLog.resource_type,
            "details":       r.AuditLog.details,
            "timestamp":     r.AuditLog.timestamp.isoformat() if r.AuditLog.timestamp else None,
        }
        for r in rows
    ]


@router.get("/system")
def platform_system(
    _=Depends(superadmin_required),
    db: Session = Depends(get_db),
):
    """System health status for the SaaS operator."""
    import time
    from app.api.health import _start_time

    db_status = "ok"
    try:
        db.execute(text("SELECT 1"))
    except Exception:
        db_status = "error"

    redis_status = "not configured"
    try:
        from app.core.config import settings
        if settings.redis_url:
            import redis as redis_client
            r = redis_client.from_url(settings.redis_url, socket_connect_timeout=2)
            r.ping()
            redis_status = "ok"
    except Exception:
        redis_status = "error"

    return {
        "status":         "ok" if db_status == "ok" else "degraded",
        "db":             db_status,
        "redis":          redis_status,
        "version":        "1.0.0",
        "uptime_seconds": round(time.time() - _start_time),
    }

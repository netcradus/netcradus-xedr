from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import case, func, or_
from sqlalchemy.orm import Session

from app.database.db import get_db
from app.core.permissions import analyst_required
from app.models.alert import Alert
from app.models.agent import Agent
from app.models.user import User

router = APIRouter(prefix="/alerts", tags=["Alerts"])


def _serialize(a: Alert, hostname: str | None) -> dict:
    return {
        "id":               a.id,
        "title":            a.title,
        "description":      a.description,
        "severity":         a.severity,
        "mitre_technique":  a.mitre_technique,
        "status":           a.status,
        "occurrence_count": a.occurrence_count,
        "timestamp":        a.timestamp.isoformat() if a.timestamp else None,
        "agent_id":         a.agent_id,
        "agent_hostname":   hostname,
    }


def _severity_order():
    return case(
        (Alert.severity == "Critical", 0),
        (Alert.severity == "High",     1),
        (Alert.severity == "Medium",   2),
        (Alert.severity == "Low",      3),
        else_=4,
    )


def _base_query(db: Session, tenant_id: int):
    return (
        db.query(Alert, Agent.hostname)
        .join(Agent, Alert.agent_id == Agent.id)
        .filter(Agent.tenant_id == tenant_id)
    )


# ── GET /alerts/ ─────────────────────────────────────────────────────────────

@router.get("/")
def get_alerts(
    offset:          int        = Query(default=0,    ge=0),
    limit:           int        = Query(default=25,   le=200),
    status:          str | None = Query(default=None, description="Open | Resolved"),
    severity:        str | None = Query(default=None, description="Critical | High | Medium | Low"),
    search:          str | None = Query(default=None, description="Full-text search on title and description"),
    from_date:       str | None = Query(default=None, description="ISO date — inclusive lower bound"),
    to_date:         str | None = Query(default=None, description="ISO date — exclusive upper bound"),
    agent_id:        int | None = Query(default=None),
    mitre_technique: str | None = Query(default=None, description="MITRE technique ID/name substring"),
    sort_by:         str        = Query(default="timestamp", description="timestamp | severity | title | status"),
    sort_dir:        str        = Query(default="desc",      description="asc | desc"),
    current_user: User    = Depends(analyst_required),
    db: Session           = Depends(get_db),
):
    """
    Paginated alert list with full server-side filtering and sorting.

    Returns { total, offset, limit, items[] } where each item includes
    agent_hostname so the frontend needs no second fetch.
    """
    q = _base_query(db, current_user.tenant_id)

    if status:
        q = q.filter(Alert.status == status)
    if severity:
        q = q.filter(Alert.severity == severity)
    if agent_id is not None:
        q = q.filter(Alert.agent_id == agent_id)
    if mitre_technique:
        q = q.filter(Alert.mitre_technique.ilike(f"%{mitre_technique}%"))
    if search:
        q = q.filter(or_(
            Alert.title.ilike(f"%{search}%"),
            Alert.description.ilike(f"%{search}%"),
        ))
    if from_date:
        try:
            q = q.filter(Alert.timestamp >= datetime.fromisoformat(from_date))
        except ValueError:
            pass
    if to_date:
        try:
            q = q.filter(Alert.timestamp < datetime.fromisoformat(to_date))
        except ValueError:
            pass

    total = q.count()

    _sort_cols = {
        "timestamp": Alert.timestamp,
        "severity":  _severity_order(),
        "title":     Alert.title,
        "status":    Alert.status,
    }
    col = _sort_cols.get(sort_by, Alert.timestamp)
    q = q.order_by(col.asc() if sort_dir == "asc" else col.desc())

    rows = q.offset(offset).limit(limit).all()

    return {
        "total":  total,
        "offset": offset,
        "limit":  limit,
        "items":  [_serialize(a, hostname) for a, hostname in rows],
    }


# ── GET /alerts/open ─────────────────────────────────────────────────────────

@router.get("/open")
def get_open_alerts(
    limit: int = Query(default=10, le=100),
    current_user: User = Depends(analyst_required),
    db: Session = Depends(get_db),
):
    rows = (
        _base_query(db, current_user.tenant_id)
        .filter(Alert.status == "Open")
        .order_by(_severity_order(), Alert.timestamp.desc())
        .limit(limit)
        .all()
    )
    return [_serialize(a, hostname) for a, hostname in rows]


# ── GET /alerts/stats ─────────────────────────────────────────────────────────

@router.get("/stats")
def get_alert_stats(
    current_user: User = Depends(analyst_required),
    db: Session = Depends(get_db),
):
    stats = {"critical": 0, "high": 0, "medium": 0, "low": 0, "open": 0, "resolved": 0}

    base = (
        db.query(Alert)
        .join(Agent, Alert.agent_id == Agent.id)
        .filter(Agent.tenant_id == current_user.tenant_id)
    )

    for sev, cnt in base.with_entities(Alert.severity, func.count(Alert.id)).group_by(Alert.severity).all():
        if (k := (sev or "").lower()) in stats:
            stats[k] = cnt

    for st, cnt in base.with_entities(Alert.status, func.count(Alert.id)).group_by(Alert.status).all():
        if (k := (st or "").lower()) in stats:
            stats[k] = cnt

    return stats


# ── GET /alerts/{id} ─────────────────────────────────────────────────────────

@router.get("/{alert_id}")
def get_alert(
    alert_id: int,
    current_user: User = Depends(analyst_required),
    db: Session = Depends(get_db),
):
    row = (
        _base_query(db, current_user.tenant_id)
        .filter(Alert.id == alert_id)
        .first()
    )
    if not row:
        raise HTTPException(status_code=404, detail="Alert not found")
    a, hostname = row
    return _serialize(a, hostname)


# ── PUT /alerts/{id}/resolve ──────────────────────────────────────────────────

@router.put("/{alert_id}/resolve")
def resolve_alert(
    alert_id: int,
    current_user: User = Depends(analyst_required),
    db: Session = Depends(get_db),
):
    row = (
        _base_query(db, current_user.tenant_id)
        .filter(Alert.id == alert_id)
        .first()
    )
    if not row:
        raise HTTPException(status_code=404, detail="Alert not found")

    a, _ = row
    a.status = "Resolved"
    db.commit()

    try:
        from app.services.audit_service import log_event
        log_event(db, tenant_id=current_user.tenant_id, action="RESOLVE_ALERT",
                  user_id=current_user.id, user_name=current_user.name,
                  resource_type="Alert", resource_id=alert_id,
                  details=f"Resolved: {a.title}")
    except Exception:
        pass

    return {"message": "Alert resolved"}

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database.db import get_db
from app.core.permissions import analyst_required
from app.models.alert import Alert
from app.models.agent import Agent
from app.models.user import User

router = APIRouter(
    prefix="/alerts",
    tags=["Alerts"]
)


@router.get("/")
def get_alerts(
        current_user: User = Depends(analyst_required),
        db: Session = Depends(get_db),
        limit: int = Query(default=200, le=500),
        status: str = Query(default=None),
        severity: str = Query(default=None)):

    q = db.query(Alert).join(
        Agent, Alert.agent_id == Agent.id
    ).filter(Agent.tenant_id == current_user.tenant_id)

    if status:
        q = q.filter(Alert.status == status)
    if severity:
        q = q.filter(Alert.severity == severity)

    alerts = (
        q.order_by(Alert.timestamp.desc())
         .limit(limit)
         .all()
    )

    return alerts

@router.get("/open")
def get_open_alerts(
        current_user: User = Depends(analyst_required),
        db: Session = Depends(get_db)):

    alerts = db.query(Alert).join(
        Agent,
        Alert.agent_id == Agent.id
    ).filter(
        Agent.tenant_id == current_user.tenant_id,
        Alert.status == "Open"
    ).all()

    return alerts


@router.get("/stats")
def get_alert_stats(
        current_user: User = Depends(analyst_required),
        db: Session = Depends(get_db)):

    stats = {
        "critical": 0,
        "high": 0,
        "medium": 0,
        "low": 0,
        "open": 0,
        "resolved": 0
    }

    severity_counts = db.query(
        Alert.severity,
        func.count(Alert.id)
    ).join(
        Agent,
        Alert.agent_id == Agent.id
    ).filter(
        Agent.tenant_id == current_user.tenant_id
    ).group_by(
        Alert.severity
    ).all()

    for severity, count in severity_counts:

        key = (severity or "").lower()

        if key in stats:

            stats[key] = count

    status_counts = db.query(
        Alert.status,
        func.count(Alert.id)
    ).join(
        Agent,
        Alert.agent_id == Agent.id
    ).filter(
        Agent.tenant_id == current_user.tenant_id
    ).group_by(
        Alert.status
    ).all()

    for status, count in status_counts:

        key = (status or "").lower()

        if key in stats:

            stats[key] = count

    return stats


@router.get("/{alert_id}")
def get_alert(
        alert_id: int,
        current_user: User = Depends(analyst_required),
        db: Session = Depends(get_db)):

    alert = db.query(Alert).join(
        Agent,
        Alert.agent_id == Agent.id
    ).filter(
        Alert.id == alert_id,
        Agent.tenant_id == current_user.tenant_id
    ).first()

    if not alert:

        raise HTTPException(
            status_code=404,
            detail="Alert not found"
        )

    return alert


@router.put("/{alert_id}/resolve")
def resolve_alert(
        alert_id: int,
        current_user: User = Depends(analyst_required),
        db: Session = Depends(get_db)):

    alert = db.query(Alert).join(
        Agent,
        Alert.agent_id == Agent.id
    ).filter(
        Alert.id == alert_id,
        Agent.tenant_id == current_user.tenant_id
    ).first()

    if not alert:

        raise HTTPException(
            status_code=404,
            detail="Alert not found"
        )

    alert.status = "Resolved"
    db.commit()

    try:
        from app.services.audit_service import log_event
        log_event(db, tenant_id=current_user.tenant_id, action="RESOLVE_ALERT",
                  user_id=current_user.id, user_name=current_user.name,
                  resource_type="Alert", resource_id=alert_id,
                  details=f"Resolved: {alert.title}")
    except Exception:
        pass

    return {"message": "Alert resolved"}

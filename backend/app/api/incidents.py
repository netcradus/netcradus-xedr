from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.permissions import analyst_required, admin_required
from app.database.db import get_db
from app.models.user import User
from app.schemas.incident_schema import (
    IncidentResponse,
    IncidentDetailResponse,
    IncidentStatsResponse,
    UpdateStatusRequest,
    LinkedAlert,
)
from app.services import incident_service

router = APIRouter(prefix="/incidents", tags=["Incidents"])


@router.get("/stats", response_model=IncidentStatsResponse)
def get_stats(
    current_user: User = Depends(analyst_required),
    db: Session = Depends(get_db),
):
    return incident_service.get_incident_stats(db, current_user.tenant_id)


@router.get("/", response_model=list[IncidentResponse])
def list_incidents(
    status: str = Query(default=None),
    severity: str = Query(default=None),
    current_user: User = Depends(analyst_required),
    db: Session = Depends(get_db),
):
    return incident_service.list_incidents(db, current_user.tenant_id, status, severity)


@router.get("/{incident_id}", response_model=IncidentDetailResponse)
def get_incident(
    incident_id: int,
    current_user: User = Depends(analyst_required),
    db: Session = Depends(get_db),
):
    incident = incident_service.get_incident(db, incident_id, current_user.tenant_id)
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")

    raw_alerts = incident_service.get_incident_alerts(db, incident_id)
    linked = [LinkedAlert(**a) for a in raw_alerts]

    return IncidentDetailResponse(
        id=incident.id,
        title=incident.title,
        description=incident.description,
        severity=incident.severity,
        status=incident.status,
        tenant_id=incident.tenant_id,
        assigned_to=incident.assigned_to,
        mitre_tactics=incident.mitre_tactics,
        alert_count=incident.alert_count,
        affected_endpoints=incident.affected_endpoints,
        created_at=incident.created_at,
        updated_at=incident.updated_at,
        resolved_at=incident.resolved_at,
        alerts=linked,
    )


@router.put("/{incident_id}/status", response_model=IncidentResponse)
def update_status(
    incident_id: int,
    body: UpdateStatusRequest,
    current_user: User = Depends(analyst_required),
    db: Session = Depends(get_db),
):
    incident = incident_service.get_incident(db, incident_id, current_user.tenant_id)
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")

    try:
        updated = incident_service.update_status(db, incident, body.status)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

    try:
        from app.services.audit_service import log_event
        log_event(db, tenant_id=current_user.tenant_id, action="UPDATE_INCIDENT_STATUS",
                  user_id=current_user.id, user_name=current_user.name,
                  resource_type="Incident", resource_id=incident_id,
                  details=f"Status → {body.status}: {incident.title}")
    except Exception:
        pass

    return updated


@router.post("/{incident_id}/backfill")
def backfill(
    current_user: User = Depends(admin_required),
    db: Session = Depends(get_db),
):
    """Retroactively correlate all existing unlinked alerts into incidents."""
    count = incident_service.backfill_incidents(db, current_user.tenant_id)
    return {"incidents_total": count}

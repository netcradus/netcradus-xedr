from datetime import datetime

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from sqlalchemy.orm import Session

from app.core.permissions import analyst_required, admin_required
from app.database.db import get_db
from app.models.user import User
from app.schemas.incident_schema import (
    IncidentResponse,
    IncidentDetailResponse,
    IncidentStatsResponse,
    InvestigationNoteResponse,
    EvidenceResponse,
    UpdateStatusRequest,
    ResolveIncidentRequest,
    CreateNoteRequest,
    CreateEvidenceRequest,
    LinkedAlert,
)
from app.services import incident_service

router = APIRouter(prefix="/incidents", tags=["Incidents"])


def _audit(db, tenant_id, user, action, resource_id, details):
    try:
        from app.services.audit_service import log_event
        log_event(db, tenant_id=tenant_id, action=action,
                  user_id=user.id, user_name=user.name,
                  resource_type="Incident", resource_id=resource_id,
                  details=details)
    except Exception:
        pass


# ── Stats & list ──────────────────────────────────────────────────────────────

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


# ── Detail ────────────────────────────────────────────────────────────────────

@router.get("/{incident_id}", response_model=IncidentDetailResponse)
def get_incident(
    incident_id: int,
    current_user: User = Depends(analyst_required),
    db: Session = Depends(get_db),
):
    incident = incident_service.get_incident(db, incident_id, current_user.tenant_id)
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")

    raw_alerts  = incident_service.get_incident_alerts(db, incident_id)
    raw_notes   = incident_service.list_notes(db, incident_id)
    raw_evidence = incident_service.list_evidence(db, incident_id)

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
        root_cause=incident.root_cause,
        resolution_summary=incident.resolution_summary,
        containment_actions=incident.containment_actions,
        lessons_learned=incident.lessons_learned,
        created_at=incident.created_at,
        updated_at=incident.updated_at,
        resolved_at=incident.resolved_at,
        alerts=[LinkedAlert(**a) for a in raw_alerts],
        notes=[InvestigationNoteResponse.model_validate(n) for n in raw_notes],
        evidence=[EvidenceResponse.model_validate(e) for e in raw_evidence],
    )


# ── Status & resolve ──────────────────────────────────────────────────────────

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
    _audit(db, current_user.tenant_id, current_user, "UPDATE_INCIDENT_STATUS",
           incident_id, f"Status → {body.status}: {incident.title}")
    return updated


@router.put("/{incident_id}/resolve", response_model=IncidentResponse)
def resolve_incident(
    incident_id: int,
    body: ResolveIncidentRequest,
    current_user: User = Depends(analyst_required),
    db: Session = Depends(get_db),
):
    """Resolve an incident and persist root-cause / resolution documentation."""
    incident = incident_service.get_incident(db, incident_id, current_user.tenant_id)
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")
    updated = incident_service.resolve_incident(
        db, incident,
        root_cause=body.root_cause,
        resolution_summary=body.resolution_summary,
        containment_actions=body.containment_actions,
        lessons_learned=body.lessons_learned,
    )
    _audit(db, current_user.tenant_id, current_user, "RESOLVE_INCIDENT",
           incident_id, f"Resolved: {incident.title}")
    return updated


# ── Investigation notes ───────────────────────────────────────────────────────

@router.get("/{incident_id}/notes", response_model=list[InvestigationNoteResponse])
def get_notes(
    incident_id: int,
    current_user: User = Depends(analyst_required),
    db: Session = Depends(get_db),
):
    if not incident_service.get_incident(db, incident_id, current_user.tenant_id):
        raise HTTPException(status_code=404, detail="Incident not found")
    return incident_service.list_notes(db, incident_id)


@router.post("/{incident_id}/notes", response_model=InvestigationNoteResponse, status_code=201)
def add_note(
    incident_id: int,
    body: CreateNoteRequest,
    current_user: User = Depends(analyst_required),
    db: Session = Depends(get_db),
):
    if not incident_service.get_incident(db, incident_id, current_user.tenant_id):
        raise HTTPException(status_code=404, detail="Incident not found")
    valid_types = {"note", "finding", "action_taken", "ioc_ref"}
    if body.note_type not in valid_types:
        raise HTTPException(status_code=422, detail=f"note_type must be one of {valid_types}")
    return incident_service.add_note(
        db, incident_id, current_user.id, current_user.name,
        body.note_type, body.content,
    )


@router.delete("/{incident_id}/notes/{note_id}", status_code=204)
def delete_note(
    incident_id: int,
    note_id: int,
    current_user: User = Depends(analyst_required),
    db: Session = Depends(get_db),
):
    if not incident_service.get_incident(db, incident_id, current_user.tenant_id):
        raise HTTPException(status_code=404, detail="Incident not found")
    if not incident_service.delete_note(db, note_id, incident_id):
        raise HTTPException(status_code=404, detail="Note not found")


# ── Evidence ──────────────────────────────────────────────────────────────────

@router.get("/{incident_id}/evidence", response_model=list[EvidenceResponse])
def get_evidence(
    incident_id: int,
    current_user: User = Depends(analyst_required),
    db: Session = Depends(get_db),
):
    if not incident_service.get_incident(db, incident_id, current_user.tenant_id):
        raise HTTPException(status_code=404, detail="Incident not found")
    return incident_service.list_evidence(db, incident_id)


@router.post("/{incident_id}/evidence", response_model=EvidenceResponse, status_code=201)
def add_evidence(
    incident_id: int,
    body: CreateEvidenceRequest,
    current_user: User = Depends(analyst_required),
    db: Session = Depends(get_db),
):
    if not incident_service.get_incident(db, incident_id, current_user.tenant_id):
        raise HTTPException(status_code=404, detail="Incident not found")
    valid_types = {"log_snippet", "ioc_ref", "artifact", "network_capture", "command_output", "note"}
    if body.evidence_type not in valid_types:
        raise HTTPException(status_code=422, detail=f"evidence_type must be one of {valid_types}")
    return incident_service.add_evidence(
        db, incident_id, current_user.id, current_user.name,
        body.title, body.evidence_type, body.content,
    )


@router.post("/{incident_id}/evidence/upload", response_model=EvidenceResponse, status_code=201)
async def upload_evidence_file(
    incident_id: int,
    title: str = Form(...),
    evidence_type: str = Form(default="artifact"),
    file: UploadFile = File(...),
    current_user: User = Depends(analyst_required),
    db: Session = Depends(get_db),
):
    """Upload a binary artifact (pcap, log archive, memory dump, etc.) as evidence."""
    if not incident_service.get_incident(db, incident_id, current_user.tenant_id):
        raise HTTPException(status_code=404, detail="Incident not found")
    valid_types = {"log_snippet", "ioc_ref", "artifact", "network_capture", "command_output", "note"}
    if evidence_type not in valid_types:
        raise HTTPException(status_code=422, detail=f"evidence_type must be one of {valid_types}")

    from app.core.storage import get_storage
    file_bytes = await file.read()
    ts  = datetime.utcnow().strftime("%Y%m%d%H%M%S")
    key = f"evidence/{incident_id}/{ts}_{file.filename}"
    get_storage().put(key, file_bytes, file.content_type or "application/octet-stream")

    return incident_service.add_evidence(
        db, incident_id, current_user.id, current_user.name,
        title, evidence_type, content=None,
        storage_key=key, file_name=file.filename,
    )


@router.delete("/{incident_id}/evidence/{evidence_id}", status_code=204)
def delete_evidence(
    incident_id: int,
    evidence_id: int,
    current_user: User = Depends(analyst_required),
    db: Session = Depends(get_db),
):
    if not incident_service.get_incident(db, incident_id, current_user.tenant_id):
        raise HTTPException(status_code=404, detail="Incident not found")
    if not incident_service.delete_evidence(db, evidence_id, incident_id):
        raise HTTPException(status_code=404, detail="Evidence not found")


# ── Backfill ──────────────────────────────────────────────────────────────────

@router.post("/backfill")
def backfill(
    current_user: User = Depends(admin_required),
    db: Session = Depends(get_db),
):
    count = incident_service.backfill_incidents(db, current_user.tenant_id)
    return {"incidents_total": count}

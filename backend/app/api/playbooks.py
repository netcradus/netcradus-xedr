"""
SOAR Playbook CRUD API.

Playbooks define automated response workflows that fire when a new alert
matches their trigger conditions (severity, MITRE technique, title pattern).

Supported action types
----------------------
close_alert        — set alert.status = "Closed"
escalate_incident  — bump linked incident severity to Critical
isolate_agent      — queue an ISOLATE command for the reporting agent
add_ioc            — add params.ip to the tenant IOC list as IPv4/High
send_notification  — fire the existing email/webhook notification pipeline
enrich_ioc         — background-enrich params.value (params.ioc_type optional)
"""
import json
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.permissions import admin_required, analyst_required
from app.database.db import get_db
from app.models.playbook import Playbook, PlaybookRun
from app.models.user import User
from app.services.audit_service import log_event

router = APIRouter(prefix="/playbooks", tags=["SOAR Playbooks"])

VALID_ACTION_TYPES = {
    "close_alert", "escalate_incident", "isolate_agent",
    "add_ioc", "send_notification", "enrich_ioc",
}


# ── Pydantic schemas ──────────────────────────────────────────────────────────

class ActionSchema(BaseModel):
    type: str
    params: dict = {}


class PlaybookPayload(BaseModel):
    name: str
    description: Optional[str] = None
    enabled: bool = True
    trigger_severities: Optional[str] = None    # "Critical,High"
    trigger_mitre: Optional[str] = None          # "T1059,T1055"
    trigger_rule_pattern: Optional[str] = None   # alert title substring
    actions: List[ActionSchema] = []


# ── Helpers ───────────────────────────────────────────────────────────────────

def _playbook_to_dict(pb: Playbook, include_runs: bool = False) -> dict:
    d = {
        "id":                   pb.id,
        "name":                 pb.name,
        "description":          pb.description,
        "enabled":              pb.enabled,
        "is_system":            pb.is_system,
        "trigger_severities":   pb.trigger_severities,
        "trigger_mitre":        pb.trigger_mitre,
        "trigger_rule_pattern": pb.trigger_rule_pattern,
        "actions":              json.loads(pb.actions or "[]"),
        "created_at":           pb.created_at.isoformat() if pb.created_at else None,
        "updated_at":           pb.updated_at.isoformat() if pb.updated_at else None,
    }
    if include_runs:
        d["runs"] = [_run_to_dict(r) for r in pb.runs]
    return d


def _run_to_dict(r: PlaybookRun) -> dict:
    return {
        "id":           r.id,
        "alert_id":     r.alert_id,
        "status":       r.status,
        "results":      json.loads(r.results or "[]"),
        "triggered_at": r.triggered_at.isoformat() if r.triggered_at else None,
    }


def _get_playbook(db: Session, playbook_id: int, tenant_id: int) -> Playbook:
    pb = db.query(Playbook).filter(
        Playbook.id == playbook_id,
        (Playbook.tenant_id == tenant_id) | (Playbook.tenant_id == None),
    ).first()
    if not pb:
        raise HTTPException(status_code=404, detail="Playbook not found")
    return pb


def _validate_actions(actions: List[ActionSchema]) -> None:
    for a in actions:
        if a.type not in VALID_ACTION_TYPES:
            raise HTTPException(
                status_code=422,
                detail=f"Unknown action type '{a.type}'. Valid: {sorted(VALID_ACTION_TYPES)}",
            )


# ── Routes ────────────────────────────────────────────────────────────────────

@router.get("/")
def list_playbooks(
    current_user: User = Depends(analyst_required),
    db: Session = Depends(get_db),
):
    pbs = db.query(Playbook).filter(
        (Playbook.tenant_id == current_user.tenant_id) | (Playbook.tenant_id == None)
    ).order_by(Playbook.id).all()
    return [_playbook_to_dict(pb) for pb in pbs]


@router.post("/", status_code=201)
def create_playbook(
    payload: PlaybookPayload,
    current_user: User = Depends(admin_required),
    db: Session = Depends(get_db),
):
    _validate_actions(payload.actions)
    pb = Playbook(
        name=payload.name,
        description=payload.description,
        enabled=payload.enabled,
        tenant_id=current_user.tenant_id,
        trigger_severities=payload.trigger_severities,
        trigger_mitre=payload.trigger_mitre,
        trigger_rule_pattern=payload.trigger_rule_pattern,
        actions=json.dumps([a.dict() for a in payload.actions]),
    )
    db.add(pb); db.commit(); db.refresh(pb)
    log_event(db, current_user.tenant_id, "PLAYBOOK_CREATED",
              user_id=current_user.id, user_name=current_user.name,
              resource_type="playbook", resource_id=pb.id, details=pb.name)
    return _playbook_to_dict(pb)


@router.get("/{playbook_id}")
def get_playbook(
    playbook_id: int,
    current_user: User = Depends(analyst_required),
    db: Session = Depends(get_db),
):
    return _playbook_to_dict(_get_playbook(db, playbook_id, current_user.tenant_id), include_runs=True)


@router.put("/{playbook_id}")
def update_playbook(
    playbook_id: int,
    payload: PlaybookPayload,
    current_user: User = Depends(admin_required),
    db: Session = Depends(get_db),
):
    pb = db.query(Playbook).filter(
        Playbook.id == playbook_id,
        Playbook.tenant_id == current_user.tenant_id,
        Playbook.is_system == False,
    ).first()
    if not pb:
        raise HTTPException(status_code=404, detail="Playbook not found")
    _validate_actions(payload.actions)
    pb.name                 = payload.name
    pb.description          = payload.description
    pb.enabled              = payload.enabled
    pb.trigger_severities   = payload.trigger_severities
    pb.trigger_mitre        = payload.trigger_mitre
    pb.trigger_rule_pattern = payload.trigger_rule_pattern
    pb.actions              = json.dumps([a.dict() for a in payload.actions])
    db.commit()
    log_event(db, current_user.tenant_id, "PLAYBOOK_UPDATED",
              user_id=current_user.id, user_name=current_user.name,
              resource_type="playbook", resource_id=pb.id, details=pb.name)
    return _playbook_to_dict(pb)


@router.patch("/{playbook_id}/toggle")
def toggle_playbook(
    playbook_id: int,
    current_user: User = Depends(admin_required),
    db: Session = Depends(get_db),
):
    pb = _get_playbook(db, playbook_id, current_user.tenant_id)
    pb.enabled = not pb.enabled
    db.commit()
    return {"id": pb.id, "enabled": pb.enabled}


@router.delete("/{playbook_id}", status_code=204)
def delete_playbook(
    playbook_id: int,
    current_user: User = Depends(admin_required),
    db: Session = Depends(get_db),
):
    pb = db.query(Playbook).filter(
        Playbook.id == playbook_id,
        Playbook.tenant_id == current_user.tenant_id,
        Playbook.is_system == False,
    ).first()
    if not pb:
        raise HTTPException(status_code=404, detail="Playbook not found")
    name = pb.name
    db.delete(pb); db.commit()
    log_event(db, current_user.tenant_id, "PLAYBOOK_DELETED",
              user_id=current_user.id, user_name=current_user.name,
              resource_type="playbook", resource_id=playbook_id, details=name)


@router.post("/{playbook_id}/trigger")
def manual_trigger(
    playbook_id: int,
    alert_id: int,
    current_user: User = Depends(admin_required),
    db: Session = Depends(get_db),
):
    """Manually execute a playbook against a specific alert."""
    pb = _get_playbook(db, playbook_id, current_user.tenant_id)

    from app.models.alert import Alert
    alert = db.query(Alert).filter(Alert.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")

    from app.services.playbook_engine import _execute_action
    actions   = json.loads(pb.actions or "[]")
    results   = [_execute_action(db, alert, a) for a in actions]
    has_error = any(r.get("outcome") == "error" for r in results)

    run = PlaybookRun(
        playbook_id=pb.id, alert_id=alert.id,
        status="partial" if has_error else "success",
        results=json.dumps(results),
    )
    db.add(run); db.commit(); db.refresh(run)

    log_event(db, current_user.tenant_id, "PLAYBOOK_MANUALLY_TRIGGERED",
              user_id=current_user.id, user_name=current_user.name,
              resource_type="playbook", resource_id=pb.id,
              details=f"Against alert {alert_id}")

    return {"run_id": run.id, "status": run.status, "results": results}


@router.get("/{playbook_id}/runs")
def list_runs(
    playbook_id: int,
    limit: int = 50,
    current_user: User = Depends(analyst_required),
    db: Session = Depends(get_db),
):
    _get_playbook(db, playbook_id, current_user.tenant_id)  # ownership check
    runs = (
        db.query(PlaybookRun)
        .filter(PlaybookRun.playbook_id == playbook_id)
        .order_by(PlaybookRun.triggered_at.desc())
        .limit(limit)
        .all()
    )
    return [_run_to_dict(r) for r in runs]

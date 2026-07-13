"""
AI Security Copilot API.

Existing endpoints (preserved)
───────────────────────────────
POST /ai/incident-summary          — AI summary of an incident + correlated alerts
POST /ai/nl-query                  — Natural-language search over alerts/incidents
POST /ai/playbook-recommendation   — AI-generated IR playbook for MITRE techniques

Copilot endpoints (new)
───────────────────────
POST /ai/alerts/{id}/explain       — Plain-English alert explanation
POST /ai/alerts/{id}/root-cause    — Root cause analysis with process chain
POST /ai/alerts/{id}/remediation   — Prioritised, evidence-based remediation steps
POST /ai/alerts/{id}/attack-chain  — Annotated chronological attack chain
POST /ai/chat                      — Multi-turn conversational Q&A
"""
from datetime import datetime, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.core.permissions import analyst_required
from app.database.db import get_db
from app.models.agent import Agent
from app.models.alert import Alert
from app.models.incident import Incident
from app.models.user import User
from app.services import incident_service
from app.services.ai_service import (
    build_attack_chain,
    chat_with_copilot,
    explain_alert,
    analyze_root_cause,
    generate_alert_remediation,
    generate_incident_summary,
    generate_playbook_recommendation,
    parse_nl_query,
    _fmt_context,
)

router = APIRouter(prefix="/ai", tags=["AI"])

_CONTEXT_WINDOW_MINUTES = 30   # telemetry fetch window around alert timestamp


# ── Pydantic schemas ──────────────────────────────────────────────────────────

class IncidentSummaryRequest(BaseModel):
    incident_id: int


class NLQueryRequest(BaseModel):
    query: str


class PlaybookRecommendationRequest(BaseModel):
    mitre_techniques: List[str] = []
    context: str = ""


class ChatMessage(BaseModel):
    role: str       # "user" | "assistant"
    content: str


class ChatRequest(BaseModel):
    message: str
    context_type: Optional[str] = None   # "alert" | "incident" | None
    context_id: Optional[int] = None
    history: List[ChatMessage] = []


# ── Helpers ───────────────────────────────────────────────────────────────────

def _get_alert(db: Session, alert_id: int, tenant_id: int) -> tuple[Alert, Agent]:
    row = (
        db.query(Alert, Agent)
        .join(Agent, Alert.agent_id == Agent.id)
        .filter(Alert.id == alert_id, Agent.tenant_id == tenant_id)
        .first()
    )
    if not row:
        raise HTTPException(status_code=404, detail="Alert not found")
    return row[0], row[1]


def _build_telemetry_context(db: Session, alert: Alert, agent: Agent) -> dict:
    """Fetch telemetry in the ±CONTEXT_WINDOW_MINUTES window around the alert."""
    from app.models.process_telemetry import ProcessTelemetry
    from app.models.network_telemetry import NetworkTelemetry
    from app.models.file_telemetry import FileTelemetry
    from app.models.dns_telemetry import DnsTelemetry
    from app.models.persistence_telemetry import PersistenceTelemetry

    ts = alert.timestamp or datetime.utcnow()
    after  = ts - timedelta(minutes=_CONTEXT_WINDOW_MINUTES)
    before = ts + timedelta(minutes=5)

    def q_base(Model):
        return (
            db.query(Model)
            .filter(Model.agent_id == agent.id, Model.timestamp >= after, Model.timestamp <= before)
            .order_by(Model.timestamp.desc())
        )

    procs = [
        {
            "timestamp": str(r.timestamp)[:19],
            "process_name": r.process_name, "parent_process_name": r.parent_process_name,
            "pid": r.pid, "cmdline": r.cmdline, "exe_path": r.exe_path,
            "username": r.username, "sha256": r.sha256,
        }
        for r in q_base(ProcessTelemetry).limit(15).all()
    ]

    nets = [
        {
            "timestamp": str(r.timestamp)[:19],
            "local_ip": r.local_ip, "remote_ip": r.remote_ip,
            "remote_port": r.remote_port, "protocol": r.protocol,
        }
        for r in q_base(NetworkTelemetry).limit(10).all()
    ]

    files = [
        {
            "timestamp": str(r.timestamp)[:19],
            "event_type": r.event_type, "file_path": r.file_path,
            "sha256": r.sha256, "md5": r.md5,
        }
        for r in q_base(FileTelemetry).limit(10).all()
    ]

    dns_events = [
        {
            "timestamp": str(r.timestamp)[:19],
            "query_name": r.query_name, "query_type": r.query_type,
            "response": r.response, "process_name": r.process_name,
        }
        for r in q_base(DnsTelemetry).limit(10).all()
    ]

    persist = [
        {
            "timestamp": str(r.timestamp)[:19],
            "persistence_type": r.persistence_type,
            "entry_name": r.entry_name, "entry_path": r.entry_path,
        }
        for r in q_base(PersistenceTelemetry).limit(5).all()
    ]

    # Other recent alerts on the same agent (past 2 hours)
    recent_alerts = [
        {
            "timestamp": str(a.timestamp)[:19], "title": a.title,
            "severity": a.severity, "mitre_technique": a.mitre_technique,
        }
        for a in db.query(Alert).filter(
            Alert.agent_id == agent.id,
            Alert.id != alert.id,
            Alert.timestamp >= ts - timedelta(hours=2),
        ).order_by(Alert.timestamp.desc()).limit(8).all()
    ]

    # Derive most-likely affected username from process telemetry
    usernames = [p["username"] for p in procs if p.get("username")]
    affected_user = usernames[0] if usernames else "Unknown"

    return {
        "hostname": agent.hostname,
        "os_type": agent.os_type,
        "ip": agent.ip_address,
        "affected_user": affected_user,
        "processes": procs,
        "network": nets,
        "files": files,
        "dns": dns_events,
        "persistence": persist,
        "recent_alerts": recent_alerts,
    }


def _alert_to_dict(alert: Alert, agent: Agent) -> dict:
    return {
        "id": alert.id,
        "title": alert.title,
        "description": alert.description,
        "severity": alert.severity,
        "mitre_technique": alert.mitre_technique,
        "timestamp": str(alert.timestamp)[:19],
        "hostname": agent.hostname,
        "os_type": agent.os_type,
    }


def _events_for_chain(ctx: dict, alert: dict) -> list[dict]:
    """Merge all telemetry into a flat, sorted event list for attack chain."""
    events = []
    for p in ctx.get("processes", []):
        events.append({
            "timestamp": p["timestamp"], "type": "process",
            "summary": (
                f"{p.get('process_name','?')} (pid={p.get('pid','?')}) "
                f"spawned by {p.get('parent_process_name','?')} "
                f"user={p.get('username','?')} cmd={str(p.get('cmdline',''))[:80]}"
            ),
        })
    for n in ctx.get("network", []):
        events.append({
            "timestamp": n["timestamp"], "type": "network",
            "summary": (
                f"Connection to {n.get('remote_ip','?')}:{n.get('remote_port','?')} "
                f"({n.get('protocol','?')})"
            ),
        })
    for f in ctx.get("files", []):
        events.append({
            "timestamp": f["timestamp"], "type": "file",
            "summary": f"{f.get('event_type','?')} {f.get('file_path','?')}",
        })
    for d in ctx.get("dns", []):
        events.append({
            "timestamp": d["timestamp"], "type": "dns",
            "summary": f"DNS {d.get('query_name','?')} ({d.get('query_type','?')}) → {d.get('response','?')}",
        })
    for pe in ctx.get("persistence", []):
        events.append({
            "timestamp": pe["timestamp"], "type": "persistence",
            "summary": f"{pe.get('persistence_type','?')} {pe.get('entry_name','?')} → {pe.get('entry_path','?')}",
        })
    for a in ctx.get("recent_alerts", []):
        events.append({
            "timestamp": a["timestamp"], "type": "alert",
            "summary": f"[ALERT:{a.get('severity','?')}] {a.get('title','?')} ({a.get('mitre_technique','')})",
        })
    # Add the triggering alert itself
    events.append({
        "timestamp": alert.get("timestamp", ""), "type": "alert",
        "summary": f"[ALERT:{alert.get('severity','?')}] {alert.get('title','?')} ← TRIGGERING ALERT",
    })
    return sorted(events, key=lambda e: e.get("timestamp", ""))


def _ai_error(exc: Exception):
    if isinstance(exc, ValueError):
        raise HTTPException(status_code=503, detail=str(exc))
    raise HTTPException(status_code=502, detail=f"AI service error: {exc}")


# ── Existing endpoints (preserved) ────────────────────────────────────────────

@router.post("/incident-summary")
def ai_incident_summary(
        request: IncidentSummaryRequest,
        current_user: User = Depends(analyst_required),
        db: Session = Depends(get_db)):

    incident = incident_service.get_incident(db, request.incident_id, current_user.tenant_id)
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")

    raw_alerts = incident_service.get_incident_alerts(db, request.incident_id)
    incident_dict = {
        "title": incident.title, "description": incident.description,
        "severity": incident.severity, "status": incident.status,
        "mitre_tactics": incident.mitre_tactics, "alert_count": incident.alert_count,
        "affected_endpoints": incident.affected_endpoints,
        "created_at": str(incident.created_at),
    }
    try:
        return generate_incident_summary(incident_dict, raw_alerts)
    except Exception as exc:
        _ai_error(exc)


@router.post("/nl-query")
def ai_nl_query(
        request: NLQueryRequest,
        current_user: User = Depends(analyst_required),
        db: Session = Depends(get_db)):

    try:
        parsed = parse_nl_query(request.query)
    except Exception as exc:
        _ai_error(exc)

    resource  = parsed.get("resource", "alerts")
    filters   = parsed.get("filters", {}) or {}
    hours_back = filters.get("hours_back")
    cutoff = None
    if hours_back:
        try:
            cutoff = datetime.utcnow() - timedelta(hours=int(hours_back))
        except (TypeError, ValueError):
            pass

    results = []
    if resource == "incidents":
        q = db.query(Incident).filter(Incident.tenant_id == current_user.tenant_id)
        if filters.get("severity"):
            q = q.filter(Incident.severity == filters["severity"])
        if filters.get("status"):
            q = q.filter(Incident.status == filters["status"])
        if cutoff:
            q = q.filter(Incident.created_at >= cutoff)
        if filters.get("search"):
            q = q.filter(Incident.title.ilike(f"%{filters['search']}%"))
        results = [
            {
                "id": r.id, "title": r.title, "severity": r.severity,
                "status": r.status, "alert_count": r.alert_count,
                "created_at": str(r.created_at), "mitre_tactics": r.mitre_tactics,
            }
            for r in q.order_by(Incident.created_at.desc()).limit(50).all()
        ]
    else:
        q = (
            db.query(Alert, Agent.hostname, Agent.os_type)
            .join(Agent, Alert.agent_id == Agent.id)
            .filter(Agent.tenant_id == current_user.tenant_id)
        )
        if filters.get("severity"):
            q = q.filter(Alert.severity == filters["severity"])
        if filters.get("status"):
            q = q.filter(Alert.status == filters["status"])
        if cutoff:
            q = q.filter(Alert.timestamp >= cutoff)
        if filters.get("agent_os"):
            q = q.filter(Agent.os_type.ilike(f"%{filters['agent_os']}%"))
        if filters.get("mitre_technique"):
            q = q.filter(Alert.mitre_technique.ilike(f"%{filters['mitre_technique']}%"))
        if filters.get("search"):
            like = f"%{filters['search']}%"
            q = q.filter(or_(Alert.title.ilike(like), Alert.description.ilike(like)))
        results = [
            {
                "id": alert.id, "title": alert.title, "severity": alert.severity,
                "status": alert.status, "agent_hostname": hostname, "agent_os": os_type,
                "mitre_technique": alert.mitre_technique, "timestamp": str(alert.timestamp),
                "occurrence_count": alert.occurrence_count,
            }
            for alert, hostname, os_type in q.order_by(Alert.timestamp.desc()).limit(50).all()
        ]

    return {
        "resource": resource, "explanation": parsed.get("explanation", ""),
        "filters_applied": filters, "total": len(results), "results": results,
    }


@router.post("/playbook-recommendation")
def ai_playbook_recommendation(
        request: PlaybookRecommendationRequest,
        current_user: User = Depends(analyst_required),
        db: Session = Depends(get_db)):
    try:
        return generate_playbook_recommendation(request.mitre_techniques, request.context)
    except Exception as exc:
        _ai_error(exc)


# ── AI Security Copilot endpoints ─────────────────────────────────────────────

@router.post("/alerts/{alert_id}/explain")
def copilot_explain(
    alert_id: int,
    current_user: User = Depends(analyst_required),
    db: Session = Depends(get_db),
):
    """
    Explain an alert in plain English.

    Returns: headline, explanation, why_dangerous, attacker_intent,
             mitre_technique, mitre_description, blast_radius, confidence.
    """
    alert, agent = _get_alert(db, alert_id, current_user.tenant_id)
    ctx = _build_telemetry_context(db, alert, agent)
    try:
        return explain_alert(_alert_to_dict(alert, agent), ctx)
    except Exception as exc:
        _ai_error(exc)


@router.post("/alerts/{alert_id}/root-cause")
def copilot_root_cause(
    alert_id: int,
    current_user: User = Depends(analyst_required),
    db: Session = Depends(get_db),
):
    """
    Root cause analysis of an alert with process chain reconstruction.

    Returns: root_cause, attack_vector, initial_access_method, process_chain,
             affected_user, lateral_movement_detected, persistence_detected,
             exfiltration_risk, timeline_summary, confidence.
    """
    alert, agent = _get_alert(db, alert_id, current_user.tenant_id)
    ctx = _build_telemetry_context(db, alert, agent)
    try:
        return analyze_root_cause(_alert_to_dict(alert, agent), ctx)
    except Exception as exc:
        _ai_error(exc)


@router.post("/alerts/{alert_id}/remediation")
def copilot_remediation(
    alert_id: int,
    current_user: User = Depends(analyst_required),
    db: Session = Depends(get_db),
):
    """
    Prioritised, evidence-based remediation steps for an alert.

    Returns: urgency, immediate_actions[], investigation_steps[],
             prevention[], estimated_containment_time, escalation_criteria.
    """
    alert, agent = _get_alert(db, alert_id, current_user.tenant_id)
    ctx = _build_telemetry_context(db, alert, agent)
    try:
        return generate_alert_remediation(_alert_to_dict(alert, agent), ctx)
    except Exception as exc:
        _ai_error(exc)


@router.post("/alerts/{alert_id}/attack-chain")
def copilot_attack_chain(
    alert_id: int,
    current_user: User = Depends(analyst_required),
    db: Session = Depends(get_db),
):
    """
    Reconstruct the chronological attack chain around an alert.

    Returns: summary, attacker_stage, dwell_time_estimate,
             chain[{sequence, timestamp, event_type, description, role,
                    mitre_technique, is_malicious}].

    The raw telemetry events are also included as `raw_events` for
    frontend timeline rendering without an AI call.
    """
    alert, agent = _get_alert(db, alert_id, current_user.tenant_id)
    ctx = _build_telemetry_context(db, alert, agent)
    alert_dict = _alert_to_dict(alert, agent)
    events = _events_for_chain(ctx, alert_dict)

    try:
        chain = build_attack_chain(alert_dict, events)
    except Exception as exc:
        _ai_error(exc)

    chain["raw_events"] = events   # let frontend render without AI if needed
    return chain


@router.post("/chat")
def copilot_chat(
    request: ChatRequest,
    current_user: User = Depends(analyst_required),
    db: Session = Depends(get_db),
):
    """
    Multi-turn conversational Q&A with the AI Security Copilot.

    Pass `context_type` + `context_id` to ground the conversation on a
    specific alert or incident. Pass previous turns in `history` to maintain
    conversation continuity (stateless — client stores history).

    Returns: answer, confidence, follow_up_questions[], suggested_actions[].
    """
    system_context = None

    if request.context_type == "alert" and request.context_id:
        try:
            alert, agent = _get_alert(db, request.context_id, current_user.tenant_id)
            ctx = _build_telemetry_context(db, alert, agent)
            system_context = _fmt_context(_alert_to_dict(alert, agent), ctx)
        except HTTPException:
            pass

    elif request.context_type == "incident" and request.context_id:
        incident = incident_service.get_incident(db, request.context_id, current_user.tenant_id)
        if incident:
            raw_alerts = incident_service.get_incident_alerts(db, request.context_id)
            alerts_text = "\n".join(
                f"  [{a.get('severity','?')}] {a.get('title','?')} ({a.get('mitre_technique','')})"
                for a in raw_alerts[:10]
            )
            system_context = (
                f"Incident: {incident.title} | {incident.severity} | {incident.status}\n"
                f"Tactics: {incident.mitre_tactics or 'Unknown'}\n"
                f"Alerts: {incident.alert_count} | Endpoints: {incident.affected_endpoints}\n\n"
                f"Correlated alerts:\n{alerts_text}"
            )

    history_dicts = [{"role": h.role, "content": h.content} for h in request.history]

    try:
        return chat_with_copilot(request.message, system_context, history_dicts)
    except Exception as exc:
        _ai_error(exc)

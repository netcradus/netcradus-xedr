from datetime import datetime, timedelta
from sqlalchemy.orm import Session

from app.models.incident import Incident
from app.models.incident_alert import IncidentAlert
from app.models.investigation_note import InvestigationNote
from app.models.evidence import Evidence
from app.models.alert import Alert
from app.models.agent import Agent

SEVERITY_RANK = {"Critical": 0, "High": 1, "Medium": 2, "Low": 3, "Informational": 4}

# How long a window an open incident stays eligible for correlation
CORRELATION_WINDOW_HOURS = 4


# ── Correlation engine ────────────────────────────────────────────────────────

def correlate_alert(db: Session, alert: Alert) -> Incident:
    """
    Core correlation rule (MVP):
      Same tenant + same agent + open/investigating incident within CORRELATION_WINDOW_HOURS
      → add this alert to that incident.
      No match → open a fresh incident.
    """
    agent = db.query(Agent).filter(Agent.id == alert.agent_id).first()
    if not agent:
        return None

    tenant_id = agent.tenant_id
    cutoff = datetime.utcnow() - timedelta(hours=CORRELATION_WINDOW_HOURS)

    # Find an open incident in this tenant that already contains an alert
    # from the same agent and was created recently enough.
    existing = (
        db.query(Incident)
        .join(IncidentAlert, Incident.id == IncidentAlert.incident_id)
        .join(Alert, IncidentAlert.alert_id == Alert.id)
        .filter(
            Incident.tenant_id == tenant_id,
            Incident.status.in_(["Open", "Investigating"]),
            Incident.created_at >= cutoff,
            Alert.agent_id == alert.agent_id,
        )
        .order_by(Incident.created_at.desc())
        .first()
    )

    if existing:
        _add_alert_to_incident(db, existing, alert)
        return existing

    return _create_incident_from_alert(db, alert, tenant_id)


def _add_alert_to_incident(db: Session, incident: Incident, alert: Alert) -> None:
    # Guard against duplicates (idempotent)
    already = db.query(IncidentAlert).filter(
        IncidentAlert.incident_id == incident.id,
        IncidentAlert.alert_id == alert.id,
    ).first()
    if already:
        return

    db.add(IncidentAlert(incident_id=incident.id, alert_id=alert.id))

    # Escalate severity if this alert is more severe
    if SEVERITY_RANK.get(alert.severity, 99) < SEVERITY_RANK.get(incident.severity, 99):
        incident.severity = alert.severity

    # Rebuild alert count
    incident.alert_count = (
        db.query(IncidentAlert)
        .filter(IncidentAlert.incident_id == incident.id)
        .count()
    ) + 1  # +1 for the one we just added (not yet committed)

    # Rebuild affected endpoints (distinct agents among linked alerts)
    linked_agent_ids = (
        db.query(Alert.agent_id)
        .join(IncidentAlert, Alert.id == IncidentAlert.alert_id)
        .filter(IncidentAlert.incident_id == incident.id)
        .distinct()
        .all()
    )
    agent_id_set = {r[0] for r in linked_agent_ids}
    agent_id_set.add(alert.agent_id)
    incident.affected_endpoints = len(agent_id_set)

    # Merge MITRE tactics
    if alert.mitre_technique:
        existing_tactics = [
            t.strip()
            for t in (incident.mitre_tactics or "").split(",")
            if t.strip()
        ]
        if alert.mitre_technique not in existing_tactics:
            existing_tactics.append(alert.mitre_technique)
            incident.mitre_tactics = ", ".join(existing_tactics)

    incident.updated_at = datetime.utcnow()
    db.commit()


def _create_incident_from_alert(db: Session, alert: Alert, tenant_id: int) -> Incident:
    now = datetime.utcnow()
    incident = Incident(
        title=alert.title,
        description=alert.description,
        severity=alert.severity,
        status="Open",
        tenant_id=tenant_id,
        mitre_tactics=alert.mitre_technique or "",
        alert_count=1,
        affected_endpoints=1,
        created_at=now,
        updated_at=now,
    )
    db.add(incident)
    db.flush()  # get PK before creating the junction row

    db.add(IncidentAlert(incident_id=incident.id, alert_id=alert.id))
    db.commit()
    db.refresh(incident)

    # Notify on new incident creation
    try:
        from app.services.notification_service import notify_new_incident
        notify_new_incident(db, incident, tenant_id)
    except Exception:
        pass

    return incident


# ── CRUD helpers ──────────────────────────────────────────────────────────────

def list_incidents(db: Session, tenant_id: int, status: str = None, severity: str = None):
    q = db.query(Incident).filter(Incident.tenant_id == tenant_id)
    if status:
        q = q.filter(Incident.status == status)
    if severity:
        q = q.filter(Incident.severity == severity)
    return q.order_by(Incident.created_at.desc()).all()


def get_incident(db: Session, incident_id: int, tenant_id: int):
    return (
        db.query(Incident)
        .filter(Incident.id == incident_id, Incident.tenant_id == tenant_id)
        .first()
    )


def get_incident_stats(db: Session, tenant_id: int) -> dict:
    all_incidents = db.query(Incident).filter(Incident.tenant_id == tenant_id).all()
    return {
        "total": len(all_incidents),
        "open": sum(1 for i in all_incidents if i.status == "Open"),
        "investigating": sum(1 for i in all_incidents if i.status == "Investigating"),
        "contained": sum(1 for i in all_incidents if i.status == "Contained"),
        "resolved": sum(1 for i in all_incidents if i.status == "Resolved"),
        "critical": sum(1 for i in all_incidents if i.severity == "Critical"),
        "high": sum(1 for i in all_incidents if i.severity == "High"),
    }


def get_incident_alerts(db: Session, incident_id: int) -> list:
    """Return alerts linked to an incident, enriched with agent hostname."""
    rows = (
        db.query(Alert, Agent.hostname)
        .join(IncidentAlert, Alert.id == IncidentAlert.alert_id)
        .join(Agent, Alert.agent_id == Agent.id)
        .filter(IncidentAlert.incident_id == incident_id)
        .order_by(Alert.timestamp.asc())
        .all()
    )
    result = []
    for alert, hostname in rows:
        result.append({
            "id": alert.id,
            "title": alert.title,
            "description": alert.description,
            "severity": alert.severity,
            "mitre_technique": alert.mitre_technique,
            "status": alert.status,
            "occurrence_count": alert.occurrence_count,
            "timestamp": alert.timestamp,
            "agent_id": alert.agent_id,
            "agent_hostname": hostname,
        })
    return result


def update_status(db: Session, incident: Incident, new_status: str) -> Incident:
    allowed = {"Open", "Investigating", "Contained", "Resolved"}
    if new_status not in allowed:
        raise ValueError(f"Invalid status: {new_status}")

    incident.status = new_status
    incident.updated_at = datetime.utcnow()

    if new_status == "Resolved" and not incident.resolved_at:
        incident.resolved_at = datetime.utcnow()
    elif new_status != "Resolved":
        incident.resolved_at = None

    db.commit()
    db.refresh(incident)
    return incident


def resolve_incident(
    db: Session,
    incident: Incident,
    root_cause: str | None,
    resolution_summary: str | None,
    containment_actions: str | None,
    lessons_learned: str | None,
) -> Incident:
    incident.status = "Resolved"
    incident.resolved_at = datetime.utcnow()
    incident.updated_at = datetime.utcnow()
    if root_cause is not None:
        incident.root_cause = root_cause
    if resolution_summary is not None:
        incident.resolution_summary = resolution_summary
    if containment_actions is not None:
        incident.containment_actions = containment_actions
    if lessons_learned is not None:
        incident.lessons_learned = lessons_learned
    db.commit()
    db.refresh(incident)
    return incident


# ── Investigation notes ────────────────────────────────────────────────────────

def list_notes(db: Session, incident_id: int) -> list:
    return (
        db.query(InvestigationNote)
        .filter(InvestigationNote.incident_id == incident_id)
        .order_by(InvestigationNote.created_at.asc())
        .all()
    )


def add_note(
    db: Session,
    incident_id: int,
    user_id: int,
    user_name: str,
    note_type: str,
    content: str,
) -> InvestigationNote:
    note = InvestigationNote(
        incident_id=incident_id,
        user_id=user_id,
        user_name=user_name,
        note_type=note_type,
        content=content,
    )
    db.add(note)
    db.commit()
    db.refresh(note)
    return note


def delete_note(db: Session, note_id: int, incident_id: int) -> bool:
    note = db.query(InvestigationNote).filter(
        InvestigationNote.id == note_id,
        InvestigationNote.incident_id == incident_id,
    ).first()
    if not note:
        return False
    db.delete(note)
    db.commit()
    return True


# ── Evidence ───────────────────────────────────────────────────────────────────

def list_evidence(db: Session, incident_id: int) -> list:
    return (
        db.query(Evidence)
        .filter(Evidence.incident_id == incident_id)
        .order_by(Evidence.created_at.asc())
        .all()
    )


def add_evidence(
    db: Session,
    incident_id: int,
    user_id: int,
    user_name: str,
    title: str,
    evidence_type: str,
    content: str | None,
    storage_key: str | None = None,
    file_name: str | None = None,
) -> Evidence:
    ev = Evidence(
        incident_id=incident_id,
        added_by_id=user_id,
        added_by_name=user_name,
        title=title,
        evidence_type=evidence_type,
        content=content,
        storage_key=storage_key,
        file_name=file_name,
    )
    db.add(ev)
    db.commit()
    db.refresh(ev)
    return ev


def delete_evidence(db: Session, evidence_id: int, incident_id: int) -> bool:
    ev = db.query(Evidence).filter(
        Evidence.id == evidence_id,
        Evidence.incident_id == incident_id,
    ).first()
    if not ev:
        return False
    db.delete(ev)
    db.commit()
    return True


def backfill_incidents(db: Session, tenant_id: int) -> int:
    """
    One-shot backfill: correlate all existing Open alerts for this tenant
    into incidents. Useful when the feature is first enabled.
    Returns the number of incidents created.
    """
    from app.models.agent import Agent as AgentModel

    # Only backfill alerts not yet linked to any incident
    linked_alert_ids = {
        r[0] for r in db.query(IncidentAlert.alert_id).all()
    }

    unlinked_alerts = (
        db.query(Alert)
        .join(AgentModel, Alert.agent_id == AgentModel.id)
        .filter(
            AgentModel.tenant_id == tenant_id,
            Alert.id.notin_(linked_alert_ids),
        )
        .order_by(Alert.timestamp.asc())
        .all()
    )

    for alert in unlinked_alerts:
        correlate_alert(db, alert)

    db.query(Incident).filter(Incident.tenant_id == tenant_id).count()
    return db.query(Incident).filter(Incident.tenant_id == tenant_id).count()

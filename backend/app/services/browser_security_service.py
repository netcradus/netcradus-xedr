"""Browser Security monitoring service."""
from datetime import datetime, timezone
from typing import Any
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.models.browser_security_event import BrowserSecurityEvent
from app.models.agent import Agent
from app.services.alert_service import create_alert_if_not_exists

EVENT_TYPES = ("extension", "password_leak", "ai_usage", "malicious_download", "malicious_site")
SEVERITIES  = ("Critical", "High", "Medium", "Low", "Info")

# MITRE mapping by event type
_MITRE = {
    "extension":          "T1176",   # Browser Extensions
    "malicious_download": "T1105",   # Ingress Tool Transfer
    "malicious_site":     "T1189",   # Drive-by Compromise
    "password_leak":      "T1555",   # Credentials from Password Stores
    "ai_usage":           "T1567",   # Exfiltration Over Web Service
}


# ---------------------------------------------------------------------------
# Ingest from agent
# ---------------------------------------------------------------------------

def submit_events(db: Session, agent_token: str, events: list[dict]) -> dict:
    agent = db.query(Agent).filter_by(agent_token=agent_token).first()
    if not agent:
        return {"error": "Invalid agent token"}

    now = datetime.now(timezone.utc)
    inserted = 0

    for ev in events:
        event_type = ev.get("event_type", "extension")
        severity   = ev.get("severity",   "Medium")
        title      = ev.get("title",      "Browser Security Event")

        db_ev = BrowserSecurityEvent(
            agent_id       = agent.id,
            tenant_id      = agent.tenant_id,
            event_type     = event_type,
            severity       = severity,
            browser        = ev.get("browser"),
            title          = title,
            description    = ev.get("description"),
            url            = ev.get("url"),
            extension_id   = ev.get("extension_id"),
            extension_name = ev.get("extension_name"),
            file_name      = ev.get("file_name"),
            file_path      = ev.get("file_path"),
            sha256         = ev.get("sha256"),
            username       = ev.get("username"),
            status         = "open",
            detected_at    = now,
            created_at     = now,
            updated_at     = now,
        )
        db.add(db_ev)
        inserted += 1

        # Create XDR alert for Critical / High events
        if severity in ("Critical", "High"):
            create_alert_if_not_exists(
                db,
                title=title,
                description=ev.get("description", ""),
                severity=severity,
                mitre_technique=_MITRE.get(event_type, "T1176"),
                agent_id=agent.id,
            )

    db.commit()
    return {"inserted": inserted}


# ---------------------------------------------------------------------------
# Dashboard
# ---------------------------------------------------------------------------

def get_dashboard(db: Session, tenant_id: int) -> dict[str, Any]:
    base = (
        db.query(BrowserSecurityEvent)
        .filter(
            BrowserSecurityEvent.tenant_id == tenant_id,
            BrowserSecurityEvent.status == "open",
        )
    )

    total_open = base.count()

    # Counts by event type
    type_rows = (
        db.query(BrowserSecurityEvent.event_type, func.count(BrowserSecurityEvent.id))
        .filter(BrowserSecurityEvent.tenant_id == tenant_id,
                BrowserSecurityEvent.status == "open")
        .group_by(BrowserSecurityEvent.event_type)
        .all()
    )
    by_type = {et: 0 for et in EVENT_TYPES}
    for et, cnt in type_rows:
        if et in by_type:
            by_type[et] = cnt

    # Counts by severity
    sev_rows = (
        db.query(BrowserSecurityEvent.severity, func.count(BrowserSecurityEvent.id))
        .filter(BrowserSecurityEvent.tenant_id == tenant_id,
                BrowserSecurityEvent.status == "open")
        .group_by(BrowserSecurityEvent.severity)
        .all()
    )
    by_severity = {s: 0 for s in SEVERITIES}
    for sev, cnt in sev_rows:
        if sev in by_severity:
            by_severity[sev] = cnt

    # Counts by browser
    browser_rows = (
        db.query(BrowserSecurityEvent.browser, func.count(BrowserSecurityEvent.id))
        .filter(BrowserSecurityEvent.tenant_id == tenant_id,
                BrowserSecurityEvent.status == "open",
                BrowserSecurityEvent.browser.isnot(None))
        .group_by(BrowserSecurityEvent.browser)
        .all()
    )
    by_browser = {}
    for br, cnt in browser_rows:
        by_browser[br] = cnt

    # Recent events (last 20)
    recent = (
        db.query(BrowserSecurityEvent)
        .join(Agent, BrowserSecurityEvent.agent_id == Agent.id)
        .filter(BrowserSecurityEvent.tenant_id == tenant_id)
        .order_by(BrowserSecurityEvent.detected_at.desc())
        .limit(20)
        .all()
    )

    return {
        "total_open":   total_open,
        "by_type":      by_type,
        "by_severity":  by_severity,
        "by_browser":   by_browser,
        "recent_events": [_ev_to_dict(e) for e in recent],
    }


# ---------------------------------------------------------------------------
# List / update
# ---------------------------------------------------------------------------

def list_events(
    db: Session,
    tenant_id: int,
    event_type: str | None = None,
    severity: str | None   = None,
    status: str | None     = None,
    browser: str | None    = None,
    limit: int             = 100,
) -> list[dict]:
    q = (
        db.query(BrowserSecurityEvent)
        .join(Agent, BrowserSecurityEvent.agent_id == Agent.id)
        .filter(BrowserSecurityEvent.tenant_id == tenant_id)
    )
    if event_type:
        q = q.filter(BrowserSecurityEvent.event_type == event_type)
    if severity:
        q = q.filter(BrowserSecurityEvent.severity == severity)
    if status:
        q = q.filter(BrowserSecurityEvent.status == status)
    if browser:
        q = q.filter(BrowserSecurityEvent.browser == browser)

    rows = q.order_by(BrowserSecurityEvent.detected_at.desc()).limit(limit).all()
    return [_ev_to_dict(e) for e in rows]


def update_event_status(db: Session, tenant_id: int, event_id: int, status: str) -> dict | None:
    ev = (
        db.query(BrowserSecurityEvent)
        .filter_by(id=event_id, tenant_id=tenant_id)
        .first()
    )
    if not ev:
        return None
    ev.status     = status
    ev.updated_at = datetime.now(timezone.utc)
    db.commit()
    return _ev_to_dict(ev)


# ---------------------------------------------------------------------------
# Serialiser
# ---------------------------------------------------------------------------

def _ev_to_dict(e: BrowserSecurityEvent) -> dict:
    return {
        "id":             e.id,
        "agent_id":       e.agent_id,
        "event_type":     e.event_type,
        "severity":       e.severity,
        "browser":        e.browser,
        "title":          e.title,
        "description":    e.description,
        "url":            e.url,
        "extension_id":   e.extension_id,
        "extension_name": e.extension_name,
        "file_name":      e.file_name,
        "file_path":      e.file_path,
        "sha256":         e.sha256,
        "username":       e.username,
        "status":         e.status,
        "detected_at":    e.detected_at.isoformat() if e.detected_at else None,
    }

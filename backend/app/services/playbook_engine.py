"""
SOAR playbook engine.

Called from alert_service after a NEW alert is persisted.  Each enabled
playbook is evaluated against the alert; matching ones execute their action
list in order and a PlaybookRun record is written regardless of outcome.

Supported action types
──────────────────────
close_alert        — set alert.status = "Closed"
escalate_incident  — bump linked incident severity to "Critical"
isolate_agent      — queue ISOLATE command for the reporting agent
kill_process       — queue KILL_PROCESS command (params: process_name)
block_ip           — queue BLOCK_IP command   (params: ip, direction)
add_ioc            — add an IP to the tenant IOC list (params: ip)
notify_slack       — send Slack message (params: webhook_url [optional])
send_notification  — fire the full email/Slack/Teams notification pipeline
create_incident    — force-create a new incident (params: title, severity)
enrich_ioc         — background-enrich an IOC (params: value, ioc_type)
"""
import json
import logging
import threading
from datetime import datetime

from sqlalchemy.orm import Session

from app.models.playbook import Playbook, PlaybookRun

_log = logging.getLogger("netcradxdr.playbook")


# ── Trigger matching ──────────────────────────────────────────────────────────

def _match(pb: Playbook, alert) -> bool:
    """Return True only if ALL non-null trigger conditions match."""
    if pb.trigger_severities:
        if alert.severity not in {s.strip() for s in pb.trigger_severities.split(",")}:
            return False
    if pb.trigger_mitre:
        if not alert.mitre_technique or alert.mitre_technique not in {
            t.strip() for t in pb.trigger_mitre.split(",")
        }:
            return False
    if pb.trigger_rule_pattern:
        if pb.trigger_rule_pattern.lower() not in (alert.title or "").lower():
            return False
    return True


# ── Action execution ──────────────────────────────────────────────────────────

def _execute_action(db: Session, alert, action: dict) -> dict:  # noqa: C901
    atype  = action.get("type", "")
    params = action.get("params", {})
    try:

        # ── close_alert ───────────────────────────────────────────────────────
        if atype == "close_alert":
            alert.status = "Closed"
            return {"type": atype, "outcome": "ok"}

        # ── escalate_incident ─────────────────────────────────────────────────
        elif atype == "escalate_incident":
            from app.models.incident_alert import IncidentAlert
            from app.models.incident import Incident
            ia = db.query(IncidentAlert).filter(IncidentAlert.alert_id == alert.id).first()
            if ia:
                inc = db.query(Incident).filter(Incident.id == ia.incident_id).first()
                if inc and inc.severity != "Critical":
                    inc.severity = "Critical"
                    return {"type": atype, "outcome": "escalated", "incident_id": inc.id}
            return {"type": atype, "outcome": "no_incident"}

        # ── isolate_agent ─────────────────────────────────────────────────────
        elif atype == "isolate_agent":
            from app.models.command import Command
            db.add(Command(
                agent_id=alert.agent_id,
                command_type="ISOLATE",
                argument=f"Auto-isolated by SOAR playbook: {alert.title}",
                status="Pending",
            ))
            return {"type": atype, "outcome": "command_queued"}

        # ── kill_process ──────────────────────────────────────────────────────
        elif atype == "kill_process":
            from app.models.command import Command
            process_name = params.get("process_name", "")
            db.add(Command(
                agent_id=alert.agent_id,
                command_type="KILL_PROCESS",
                argument=process_name or alert.title,
                status="Pending",
            ))
            return {"type": atype, "outcome": "command_queued", "process_name": process_name}

        # ── block_ip ──────────────────────────────────────────────────────────
        elif atype == "block_ip":
            from app.models.command import Command
            ip        = params.get("ip", "").strip()
            direction = params.get("direction", "both")
            if not ip:
                return {"type": atype, "outcome": "skipped", "reason": "no ip in params"}
            db.add(Command(
                agent_id=alert.agent_id,
                command_type="BLOCK_IP",
                argument=json.dumps({"ip": ip, "direction": direction}),
                status="Pending",
            ))
            return {"type": atype, "outcome": "command_queued", "ip": ip}

        # ── add_ioc ───────────────────────────────────────────────────────────
        elif atype == "add_ioc":
            from app.models.ioc import IOC
            from app.models.agent import Agent
            agent     = db.query(Agent).filter(Agent.id == alert.agent_id).first()
            tenant_id = agent.tenant_id if agent else None
            ip_value  = params.get("ip", "").strip()
            if ip_value and tenant_id:
                exists = db.query(IOC).filter(
                    IOC.tenant_id == tenant_id, IOC.value == ip_value
                ).first()
                if not exists:
                    db.add(IOC(
                        tenant_id=tenant_id, type="IPv4", value=ip_value,
                        severity="High", source="SOAR Playbook", is_active=True,
                        description=f"Auto-added from alert: {alert.title}",
                    ))
            return {"type": atype, "outcome": "ok"}

        # ── notify_slack ──────────────────────────────────────────────────────
        elif atype == "notify_slack":
            from app.models.agent import Agent
            from app.services.notification_service import _slack_alert_payload, _send_slack
            agent    = db.query(Agent).filter(Agent.id == alert.agent_id).first()
            hostname = agent.hostname if agent else f"agent-{alert.agent_id}"

            webhook_url = params.get("webhook_url", "").strip()
            if not webhook_url and agent:
                from app.models.notification_config import NotificationConfig
                cfg = db.query(NotificationConfig).filter(
                    NotificationConfig.tenant_id == agent.tenant_id
                ).first()
                webhook_url = (cfg.slack_webhook_url or "") if cfg else ""

            if not webhook_url:
                return {"type": atype, "outcome": "skipped", "reason": "no_webhook_configured"}

            payload = _slack_alert_payload(
                alert.title,
                alert.severity,
                hostname,
                alert.mitre_technique or "",
                params.get("message") or alert.description or "",
            )
            threading.Thread(target=_send_slack, args=(webhook_url, payload), daemon=True).start()
            return {"type": atype, "outcome": "dispatched"}

        # ── send_notification ─────────────────────────────────────────────────
        elif atype == "send_notification":
            from app.models.agent import Agent
            from app.services.notification_service import notify_new_alert
            agent    = db.query(Agent).filter(Agent.id == alert.agent_id).first()
            hostname = agent.hostname if agent else f"agent-{alert.agent_id}"
            if not hasattr(alert, "tenant_id") or alert.tenant_id is None:
                alert.tenant_id = agent.tenant_id if agent else None
            notify_new_alert(db, alert, hostname)
            return {"type": atype, "outcome": "ok"}

        # ── create_incident ───────────────────────────────────────────────────
        elif atype == "create_incident":
            from app.models.agent import Agent
            from app.models.incident import Incident
            from app.models.incident_alert import IncidentAlert
            agent     = db.query(Agent).filter(Agent.id == alert.agent_id).first()
            tenant_id = agent.tenant_id if agent else None
            if not tenant_id:
                return {"type": atype, "outcome": "error", "detail": "no_tenant"}

            title    = params.get("title") or f"[SOAR] {alert.title}"
            severity = params.get("severity") or alert.severity
            now      = datetime.utcnow()
            incident = Incident(
                title=title,
                description=(
                    f"Auto-created by SOAR playbook.\n"
                    f"Triggering alert: {alert.title} [{alert.severity}]\n"
                    f"MITRE: {alert.mitre_technique or 'N/A'}"
                ),
                severity=severity,
                status="Open",
                tenant_id=tenant_id,
                mitre_tactics=alert.mitre_technique or "",
                alert_count=1,
                affected_endpoints=1,
                created_at=now,
                updated_at=now,
            )
            db.add(incident)
            db.flush()  # get PK
            db.add(IncidentAlert(incident_id=incident.id, alert_id=alert.id))
            return {"type": atype, "outcome": "created", "incident_id": incident.id}

        # ── enrich_ioc ────────────────────────────────────────────────────────
        elif atype == "enrich_ioc":
            value    = params.get("value", "").strip()
            ioc_type = params.get("ioc_type", "IPv4")
            if value:
                from app.models.agent import Agent
                from app.models.ioc import IOC
                from app.services.enrichment_service import enrich_ioc_background
                agent     = db.query(Agent).filter(Agent.id == alert.agent_id).first()
                tenant_id = agent.tenant_id if agent else None
                if tenant_id:
                    ioc = db.query(IOC).filter(
                        IOC.tenant_id == tenant_id, IOC.value == value
                    ).first()
                    if ioc:
                        enrich_ioc_background(ioc.id, tenant_id)
            return {"type": atype, "outcome": "triggered"}

        else:
            return {"type": atype, "outcome": "unknown_action_type"}

    except Exception as exc:
        _log.warning("Playbook action '%s' failed: %s", atype, exc)
        return {"type": atype, "outcome": "error", "detail": str(exc)}


# ── Public entry point ────────────────────────────────────────────────────────

def evaluate_playbooks(db: Session, alert) -> None:
    """Evaluate all enabled playbooks for a newly created alert."""
    try:
        from app.models.agent import Agent
        agent     = db.query(Agent).filter(Agent.id == alert.agent_id).first()
        tenant_id = agent.tenant_id if agent else None

        playbooks = db.query(Playbook).filter(
            Playbook.enabled == True,
            (Playbook.tenant_id == tenant_id) | (Playbook.tenant_id == None),
        ).all()

        for pb in playbooks:
            if not _match(pb, alert):
                continue

            try:
                actions = json.loads(pb.actions or "[]")
            except Exception:
                actions = []

            results   = [_execute_action(db, alert, a) for a in actions]
            has_error = any(r.get("outcome") == "error" for r in results)

            db.add(PlaybookRun(
                playbook_id=pb.id,
                alert_id=alert.id,
                status="partial" if has_error else "success",
                results=json.dumps(results),
                triggered_at=datetime.utcnow(),
            ))

        db.commit()
    except Exception as exc:
        _log.error("Playbook evaluation failed for alert %s: %s", getattr(alert, "id", "?"), exc)
        try:
            db.rollback()
        except Exception:
            pass

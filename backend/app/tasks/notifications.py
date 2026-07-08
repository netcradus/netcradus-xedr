from typing import List

from app.core.celery_app import celery_app


@celery_app.task(bind=True, max_retries=2, default_retry_delay=60)
def send_email_task(self, to: str, subject: str, html: str):
    """Send a platform email (verification, password reset)."""
    from app.services.email_service import _send
    try:
        _send(to, subject, html)
    except Exception as exc:
        raise self.retry(exc=exc)


@celery_app.task(bind=True, max_retries=3, default_retry_delay=30)
def notify_alert_task(
    self,
    tenant_id: int,
    title: str,
    severity: str,
    agent_hostname: str,
    mitre: str,
    description: str,
):
    """Send alert notifications to all configured channels for a tenant."""
    from app.database.db import SessionLocal
    from app.services.notification_service import (
        get_or_create_config,
        _send_slack, _slack_alert_payload,
        _send_teams, _teams_alert_payload,
        _send_email, _alert_email_html,
    )
    db = SessionLocal()
    try:
        cfg = get_or_create_config(db, tenant_id)
        if cfg.slack_webhook_url:
            _send_slack(cfg.slack_webhook_url,
                        _slack_alert_payload(title, severity, agent_hostname, mitre, description))
        if cfg.teams_webhook_url:
            _send_teams(cfg.teams_webhook_url,
                        _teams_alert_payload(title, severity, agent_hostname, mitre, description))
        if cfg.email_to:
            _send_email(cfg,
                        f"[NetcradXDR] {severity} Alert: {title}",
                        _alert_email_html(title, severity, agent_hostname, mitre, description))
    except Exception as exc:
        raise self.retry(exc=exc)
    finally:
        db.close()


@celery_app.task(bind=True, max_retries=3, default_retry_delay=30)
def notify_incident_task(
    self,
    tenant_id: int,
    title: str,
    severity: str,
    alert_count: int,
    endpoints: int,
):
    """Send incident notifications to all configured channels for a tenant."""
    from app.database.db import SessionLocal
    from app.services.notification_service import (
        get_or_create_config,
        _send_slack, _slack_incident_payload,
        _send_teams, _teams_incident_payload,
        _send_email, _incident_email_html,
    )
    db = SessionLocal()
    try:
        cfg = get_or_create_config(db, tenant_id)
        if not cfg.notify_on_new_incident:
            return
        if cfg.slack_webhook_url:
            _send_slack(cfg.slack_webhook_url,
                        _slack_incident_payload(title, severity, alert_count, endpoints))
        if cfg.teams_webhook_url:
            _send_teams(cfg.teams_webhook_url,
                        _teams_incident_payload(title, severity, alert_count, endpoints))
        if cfg.email_to:
            _send_email(cfg,
                        f"[NetcradXDR] New Incident: {title}",
                        _incident_email_html(title, severity, alert_count, endpoints))
    except Exception as exc:
        raise self.retry(exc=exc)
    finally:
        db.close()


@celery_app.task(bind=True, max_retries=3, default_retry_delay=30, queue="notifications")
def notify_agent_offline_task(self, tenant_id: int, hostnames: List[str]):
    """Send agent-offline notifications for one or more agents in a tenant."""
    from app.database.db import SessionLocal
    from app.services.notification_service import (
        get_or_create_config,
        _send_slack, _send_teams, _send_email,
    )

    label = ", ".join(hostnames)
    slack_payload = {
        "text": f":red_circle: *Agent Offline* — `{label}` has stopped heartbeating.",
        "attachments": [{
            "color": "#e53e3e",
            "fields": [
                {"title": "Endpoints", "value": label, "short": False},
                {"title": "Action", "value": "Check connectivity and agent service status.", "short": False},
            ],
        }],
    }
    teams_payload = {
        "@type": "MessageCard",
        "@context": "http://schema.org/extensions",
        "themeColor": "e53e3e",
        "summary": f"Agent Offline: {label}",
        "sections": [{"activityTitle": f"**Agent Offline**: {label}",
                      "activityText": "The agent has stopped sending heartbeats to NetcradXDR."}],
    }
    html = (
        f"<h2>Agent Offline</h2>"
        f"<p>The following agent(s) have gone offline: <strong>{label}</strong></p>"
        f"<p>Please check connectivity and confirm the agent service is running.</p>"
    )

    db = SessionLocal()
    try:
        cfg = get_or_create_config(db, tenant_id)
        if not cfg.notify_on_agent_offline:
            return
        if cfg.slack_webhook_url:
            _send_slack(cfg.slack_webhook_url, slack_payload)
        if cfg.teams_webhook_url:
            _send_teams(cfg.teams_webhook_url, teams_payload)
        if cfg.email_to:
            _send_email(cfg, f"[NetcradXDR] Agent Offline: {label}", html)
    except Exception as exc:
        raise self.retry(exc=exc)
    finally:
        db.close()

"""
Notification service — builds payloads and dispatches channels.

notify_new_alert / notify_new_incident check config synchronously (one cheap
indexed DB read) then hand off all I/O (HTTP to Slack/Teams, SMTP) to
Celery workers via notify_alert_task / notify_incident_task.

send_test_notification keeps the HTTP calls synchronous because it returns
per-channel results to the caller immediately.
"""

import smtplib
from datetime import datetime
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

import requests as http
from sqlalchemy.orm import Session

from app.models.notification_config import NotificationConfig

# ── Config helper ─────────────────────────────────────────────────────────────

def get_or_create_config(db: Session, tenant_id: int) -> NotificationConfig:
    cfg = db.query(NotificationConfig).filter(
        NotificationConfig.tenant_id == tenant_id
    ).first()
    if not cfg:
        cfg = NotificationConfig(tenant_id=tenant_id)
        db.add(cfg)
        db.commit()
        db.refresh(cfg)
    return cfg


# ── Severity colour map ───────────────────────────────────────────────────────

_SEVERITY_COLOUR = {
    "Critical":     "#7C3AED",
    "High":         "#DC2626",
    "Medium":       "#D97706",
    "Low":          "#2563EB",
    "Informational":"#6B7280",
}

_SEVERITY_EMOJI = {
    "Critical": "🚨",
    "High":     "⚠️",
    "Medium":   "🔶",
    "Low":      "🔵",
}


# ── Slack ─────────────────────────────────────────────────────────────────────

def _send_slack(webhook_url: str, payload: dict) -> None:
    try:
        r = http.post(webhook_url, json=payload, timeout=5)
        r.raise_for_status()
    except Exception as e:
        print(f"[notify:slack] {e}")


def _slack_alert_payload(title: str, severity: str, agent: str, mitre: str, description: str) -> dict:
    emoji  = _SEVERITY_EMOJI.get(severity, "🔔")
    colour = _SEVERITY_COLOUR.get(severity, "#6B7280")
    return {
        "attachments": [
            {
                "color": colour,
                "blocks": [
                    {
                        "type": "header",
                        "text": {"type": "plain_text", "text": f"{emoji} SentryXDR — {severity} Alert"},
                    },
                    {
                        "type": "section",
                        "text": {"type": "mrkdwn", "text": f"*{title}*\n{description or ''}"},
                    },
                    {
                        "type": "section",
                        "fields": [
                            {"type": "mrkdwn", "text": f"*Agent:*\n{agent}"},
                            {"type": "mrkdwn", "text": f"*MITRE:*\n{mitre or '—'}"},
                        ],
                    },
                    {
                        "type": "context",
                        "elements": [
                            {"type": "mrkdwn", "text": f"SentryXDR · {datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')}"}
                        ],
                    },
                ],
            }
        ]
    }


def _slack_incident_payload(title: str, severity: str, alert_count: int, endpoints: int) -> dict:
    emoji  = _SEVERITY_EMOJI.get(severity, "🔔")
    colour = _SEVERITY_COLOUR.get(severity, "#6B7280")
    return {
        "attachments": [
            {
                "color": colour,
                "blocks": [
                    {
                        "type": "header",
                        "text": {"type": "plain_text", "text": f"{emoji} SentryXDR — New Incident"},
                    },
                    {
                        "type": "section",
                        "text": {"type": "mrkdwn", "text": f"*{title}*"},
                    },
                    {
                        "type": "section",
                        "fields": [
                            {"type": "mrkdwn", "text": f"*Severity:*\n{severity}"},
                            {"type": "mrkdwn", "text": f"*Correlated Alerts:*\n{alert_count}"},
                            {"type": "mrkdwn", "text": f"*Affected Endpoints:*\n{endpoints}"},
                        ],
                    },
                    {
                        "type": "context",
                        "elements": [
                            {"type": "mrkdwn", "text": f"SentryXDR · {datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')}"}
                        ],
                    },
                ],
            }
        ]
    }


# ── Teams ─────────────────────────────────────────────────────────────────────

def _send_teams(webhook_url: str, payload: dict) -> None:
    try:
        r = http.post(webhook_url, json=payload, timeout=5)
        r.raise_for_status()
    except Exception as e:
        print(f"[notify:teams] {e}")


def _teams_alert_payload(title: str, severity: str, agent: str, mitre: str, description: str) -> dict:
    colour = _SEVERITY_COLOUR.get(severity, "#6B7280").lstrip("#")
    emoji  = _SEVERITY_EMOJI.get(severity, "🔔")
    return {
        "@type": "MessageCard",
        "@context": "https://schema.org/extensions",
        "themeColor": colour,
        "summary": f"{severity} Alert: {title}",
        "sections": [
            {
                "activityTitle": f"{emoji} {severity} Alert Detected",
                "activitySubtitle": title,
                "text": description or "",
                "facts": [
                    {"name": "Agent",    "value": agent},
                    {"name": "MITRE",    "value": mitre or "—"},
                    {"name": "Severity", "value": severity},
                    {"name": "Time",     "value": datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC")},
                ],
            }
        ],
    }


def _teams_incident_payload(title: str, severity: str, alert_count: int, endpoints: int) -> dict:
    colour = _SEVERITY_COLOUR.get(severity, "#6B7280").lstrip("#")
    return {
        "@type": "MessageCard",
        "@context": "https://schema.org/extensions",
        "themeColor": colour,
        "summary": f"New Incident: {title}",
        "sections": [
            {
                "activityTitle": "🚨 New Incident Created",
                "activitySubtitle": title,
                "facts": [
                    {"name": "Severity",            "value": severity},
                    {"name": "Correlated Alerts",   "value": str(alert_count)},
                    {"name": "Affected Endpoints",  "value": str(endpoints)},
                    {"name": "Time",                "value": datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC")},
                ],
            }
        ],
    }


# ── Email ─────────────────────────────────────────────────────────────────────

def _send_email(cfg: NotificationConfig, subject: str, html_body: str) -> None:
    """Synchronous SMTP send. Call this only from inside a Celery worker."""
    if not all([cfg.email_smtp_host, cfg.email_smtp_user, cfg.email_smtp_pass,
                cfg.email_smtp_from, cfg.email_to]):
        return
    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"]    = cfg.email_smtp_from
        msg["To"]      = cfg.email_to
        msg.attach(MIMEText(html_body, "html"))

        port = cfg.email_smtp_port or 587
        if cfg.email_use_tls:
            server = smtplib.SMTP(cfg.email_smtp_host, port, timeout=10)
            server.ehlo()
            server.starttls()
        else:
            server = smtplib.SMTP_SSL(cfg.email_smtp_host, port, timeout=10)

        server.login(cfg.email_smtp_user, cfg.email_smtp_pass)
        recipients = [r.strip() for r in cfg.email_to.split(",") if r.strip()]
        server.sendmail(cfg.email_smtp_from, recipients, msg.as_string())
        server.quit()
    except Exception as e:
        print(f"[notify:email] {e}")


def _alert_email_html(title: str, severity: str, agent: str, mitre: str, description: str) -> str:
    colour = _SEVERITY_COLOUR.get(severity, "#6B7280")
    return f"""
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
      <div style="background:{colour};color:#fff;padding:16px 24px;border-radius:8px 8px 0 0">
        <h2 style="margin:0">{severity} Alert — SentryXDR</h2>
      </div>
      <div style="border:1px solid #e5e7eb;border-top:none;padding:24px;border-radius:0 0 8px 8px">
        <h3 style="margin-top:0;color:#111827">{title}</h3>
        <p style="color:#6b7280">{description or ''}</p>
        <table style="width:100%;border-collapse:collapse;margin-top:16px">
          <tr><td style="padding:8px 0;color:#6b7280;width:40%">Agent</td><td style="color:#111827;font-weight:600">{agent}</td></tr>
          <tr><td style="padding:8px 0;color:#6b7280">MITRE</td><td style="color:#111827">{mitre or '—'}</td></tr>
          <tr><td style="padding:8px 0;color:#6b7280">Severity</td><td style="color:{colour};font-weight:600">{severity}</td></tr>
          <tr><td style="padding:8px 0;color:#6b7280">Time</td><td style="color:#111827">{datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')}</td></tr>
        </table>
      </div>
      <p style="color:#9ca3af;font-size:12px;text-align:center;margin-top:16px">SentryXDR by Netcradus</p>
    </div>
    """


def _incident_email_html(title: str, severity: str, alert_count: int, endpoints: int) -> str:
    colour = _SEVERITY_COLOUR.get(severity, "#6B7280")
    return f"""
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
      <div style="background:{colour};color:#fff;padding:16px 24px;border-radius:8px 8px 0 0">
        <h2 style="margin:0">New Incident — SentryXDR</h2>
      </div>
      <div style="border:1px solid #e5e7eb;border-top:none;padding:24px;border-radius:0 0 8px 8px">
        <h3 style="margin-top:0;color:#111827">{title}</h3>
        <table style="width:100%;border-collapse:collapse;margin-top:16px">
          <tr><td style="padding:8px 0;color:#6b7280;width:40%">Severity</td><td style="color:{colour};font-weight:600">{severity}</td></tr>
          <tr><td style="padding:8px 0;color:#6b7280">Correlated Alerts</td><td style="color:#111827;font-weight:600">{alert_count}</td></tr>
          <tr><td style="padding:8px 0;color:#6b7280">Affected Endpoints</td><td style="color:#111827">{endpoints}</td></tr>
          <tr><td style="padding:8px 0;color:#6b7280">Time</td><td style="color:#111827">{datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')}</td></tr>
        </table>
      </div>
      <p style="color:#9ca3af;font-size:12px;text-align:center;margin-top:16px">SentryXDR by Netcradus</p>
    </div>
    """


# ── Public API ────────────────────────────────────────────────────────────────

def _dispatch_notify_alert(tenant_id: int, title: str, severity: str,
                            agent_hostname: str, mitre: str, description: str) -> None:
    """Send alert notification via Celery, fall back to in-process thread."""
    try:
        from app.tasks.notifications import notify_alert_task
        notify_alert_task.delay(tenant_id, title, severity, agent_hostname, mitre, description)
    except Exception:
        import threading
        from app.database.db import SessionLocal
        def _run():
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
                    _send_email(cfg, f"[SentryXDR] {severity} Alert: {title}",
                                _alert_email_html(title, severity, agent_hostname, mitre, description))
            except Exception as e:
                print(f"[notify_alert fallback] {e}")
            finally:
                db.close()
        threading.Thread(target=_run, daemon=True).start()


def _dispatch_notify_incident(tenant_id: int, title: str, severity: str,
                               alert_count: int, endpoints: int) -> None:
    """Send incident notification via Celery, fall back to in-process thread."""
    try:
        from app.tasks.notifications import notify_incident_task
        notify_incident_task.delay(tenant_id, title, severity, alert_count, endpoints)
    except Exception:
        import threading
        from app.database.db import SessionLocal
        def _run():
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
                    _send_email(cfg, f"[SentryXDR] New Incident: {title}",
                                _incident_email_html(title, severity, alert_count, endpoints))
            except Exception as e:
                print(f"[notify_incident fallback] {e}")
            finally:
                db.close()
        threading.Thread(target=_run, daemon=True).start()


def notify_new_alert(db: Session, alert, agent_hostname: str) -> None:
    """Called after a new alert is created. Reads config, then dispatches to Celery."""
    try:
        tid      = alert.tenant_id if hasattr(alert, "tenant_id") else _resolve_tenant(db, alert.agent_id)
        severity = alert.severity or "Low"
        cfg      = get_or_create_config(db, tid)

        should_notify = (
            (severity == "Critical" and cfg.notify_on_critical) or
            (severity == "High"     and cfg.notify_on_high)
        )
        if not should_notify:
            return

        _dispatch_notify_alert(
            tenant_id=tid,
            title=alert.title or "Untitled Alert",
            severity=severity,
            agent_hostname=agent_hostname,
            mitre=alert.mitre_technique or "",
            description=alert.description or "",
        )
    except Exception as e:
        print(f"[notify_new_alert] {e}")


def notify_new_incident(db: Session, incident, tenant_id: int) -> None:
    """Called after a new incident is created. Reads config, then dispatches to Celery."""
    try:
        cfg = get_or_create_config(db, tenant_id)
        if not cfg.notify_on_new_incident:
            return

        _dispatch_notify_incident(
            tenant_id=tenant_id,
            title=incident.title or "New Incident",
            severity=incident.severity or "Low",
            alert_count=incident.alert_count or 1,
            endpoints=incident.affected_endpoints or 1,
        )
    except Exception as e:
        print(f"[notify_new_incident] {e}")


def send_test_notification(db: Session, tenant_id: int) -> dict:
    """Send test messages synchronously and return per-channel results."""
    cfg    = get_or_create_config(db, tenant_id)
    result = {}

    test_payload = _slack_alert_payload(
        "Test Alert", "High", "TEST-HOST-01", "T1059",
        "This is a test notification from SentryXDR.",
    )

    if cfg.slack_webhook_url:
        try:
            r = http.post(cfg.slack_webhook_url, json=test_payload, timeout=5)
            result["slack"] = "ok" if r.ok else f"HTTP {r.status_code}"
        except Exception as e:
            result["slack"] = str(e)
    else:
        result["slack"] = "not_configured"

    if cfg.teams_webhook_url:
        try:
            payload = _teams_alert_payload("Test Alert", "High", "TEST-HOST-01", "T1059",
                                           "This is a test notification from SentryXDR.")
            r = http.post(cfg.teams_webhook_url, json=payload, timeout=5)
            result["teams"] = "ok" if r.ok else f"HTTP {r.status_code}"
        except Exception as e:
            result["teams"] = str(e)
    else:
        result["teams"] = "not_configured"

    if cfg.email_to:
        try:
            _send_email(cfg, "[SentryXDR] Test Notification",
                        _alert_email_html("Test Alert", "High", "TEST-HOST-01", "T1059",
                                          "This is a test notification from SentryXDR."))
            result["email"] = "dispatched"
        except Exception as e:
            result["email"] = str(e)
    else:
        result["email"] = "not_configured"

    return result


# ── Internal helpers ──────────────────────────────────────────────────────────

def _resolve_tenant(db: Session, agent_id: int) -> int:
    from app.models.agent import Agent
    agent = db.query(Agent).filter(Agent.id == agent_id).first()
    return agent.tenant_id if agent else 0

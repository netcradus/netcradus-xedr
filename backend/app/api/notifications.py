from fastapi import APIRouter, Depends
from pydantic import BaseModel
from typing import Optional
from sqlalchemy.orm import Session

from app.database.db import get_db
from app.core.permissions import admin_required, analyst_required
from app.models.user import User
from app.services.notification_service import get_or_create_config, send_test_notification

router = APIRouter(prefix="/notifications", tags=["Notifications"])


# ── Schemas ───────────────────────────────────────────────────────────────────

class NotificationConfigPayload(BaseModel):
    slack_webhook_url:       Optional[str]  = None
    teams_webhook_url:       Optional[str]  = None
    email_to:                Optional[str]  = None
    email_smtp_host:         Optional[str]  = None
    email_smtp_port:         Optional[int]  = 587
    email_smtp_user:         Optional[str]  = None
    email_smtp_pass:         Optional[str]  = None
    email_smtp_from:         Optional[str]  = None
    email_use_tls:           Optional[bool] = True
    notify_on_critical:      Optional[bool] = True
    notify_on_high:          Optional[bool] = False
    notify_on_new_incident:  Optional[bool] = True
    notify_on_agent_offline: Optional[bool] = False


def _cfg_dict(cfg) -> dict:
    return {
        "slack_webhook_url":       cfg.slack_webhook_url,
        "teams_webhook_url":       cfg.teams_webhook_url,
        "email_to":                cfg.email_to,
        "email_smtp_host":         cfg.email_smtp_host,
        "email_smtp_port":         cfg.email_smtp_port,
        "email_smtp_user":         cfg.email_smtp_user,
        # Never return the password — redact it
        "email_smtp_pass":         "••••••••" if cfg.email_smtp_pass else None,
        "email_smtp_from":         cfg.email_smtp_from,
        "email_use_tls":           cfg.email_use_tls,
        "notify_on_critical":      cfg.notify_on_critical,
        "notify_on_high":          cfg.notify_on_high,
        "notify_on_new_incident":  cfg.notify_on_new_incident,
        "notify_on_agent_offline": cfg.notify_on_agent_offline,
    }


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/config")
def get_config(
    current_user: User = Depends(analyst_required),
    db: Session = Depends(get_db),
):
    cfg = get_or_create_config(db, current_user.tenant_id)
    return _cfg_dict(cfg)


@router.put("/config")
def update_config(
    payload: NotificationConfigPayload,
    current_user: User = Depends(admin_required),
    db: Session = Depends(get_db),
):
    cfg = get_or_create_config(db, current_user.tenant_id)

    # Update only fields that were explicitly provided
    if payload.slack_webhook_url is not None:
        cfg.slack_webhook_url = payload.slack_webhook_url or None
    if payload.teams_webhook_url is not None:
        cfg.teams_webhook_url = payload.teams_webhook_url or None
    if payload.email_to is not None:
        cfg.email_to = payload.email_to or None
    if payload.email_smtp_host is not None:
        cfg.email_smtp_host = payload.email_smtp_host or None
    if payload.email_smtp_port is not None:
        cfg.email_smtp_port = payload.email_smtp_port
    if payload.email_smtp_user is not None:
        cfg.email_smtp_user = payload.email_smtp_user or None
    # Only overwrite password if a real value was sent (not the redacted placeholder)
    if payload.email_smtp_pass is not None and payload.email_smtp_pass != "••••••••":
        cfg.email_smtp_pass = payload.email_smtp_pass or None
    if payload.email_smtp_from is not None:
        cfg.email_smtp_from = payload.email_smtp_from or None
    if payload.email_use_tls is not None:
        cfg.email_use_tls = payload.email_use_tls
    if payload.notify_on_critical is not None:
        cfg.notify_on_critical = payload.notify_on_critical
    if payload.notify_on_high is not None:
        cfg.notify_on_high = payload.notify_on_high
    if payload.notify_on_new_incident is not None:
        cfg.notify_on_new_incident = payload.notify_on_new_incident
    if payload.notify_on_agent_offline is not None:
        cfg.notify_on_agent_offline = payload.notify_on_agent_offline

    db.commit()
    db.refresh(cfg)
    return _cfg_dict(cfg)


@router.post("/test")
def test_notification(
    current_user: User = Depends(admin_required),
    db: Session = Depends(get_db),
):
    results = send_test_notification(db, current_user.tenant_id)
    return {"results": results}

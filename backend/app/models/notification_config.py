from datetime import datetime
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey
from app.database.db import Base


class NotificationConfig(Base):
    __tablename__ = "notification_configs"

    id        = Column(Integer, primary_key=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), unique=True, nullable=False)

    # ── Channels ──────────────────────────────────────────────────────────────
    slack_webhook_url = Column(String)
    teams_webhook_url = Column(String)

    # Email / SMTP
    email_to        = Column(String)   # comma-separated recipient list
    email_smtp_host = Column(String)
    email_smtp_port = Column(Integer, default=587)
    email_smtp_user = Column(String)
    email_smtp_pass = Column(String)   # store encrypted in production
    email_smtp_from = Column(String)
    email_use_tls   = Column(Boolean, default=True)

    # ── Rules ─────────────────────────────────────────────────────────────────
    notify_on_critical      = Column(Boolean, default=True)
    notify_on_high          = Column(Boolean, default=False)
    notify_on_new_incident  = Column(Boolean, default=True)
    notify_on_agent_offline = Column(Boolean, default=False)

    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

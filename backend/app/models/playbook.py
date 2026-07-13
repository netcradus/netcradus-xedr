from datetime import datetime
from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship
from app.database.db import Base


class Playbook(Base):
    __tablename__ = "playbooks"

    id                   = Column(Integer, primary_key=True)
    name                 = Column(String, nullable=False)
    description          = Column(String)
    enabled              = Column(Boolean, default=True, nullable=False)
    is_system            = Column(Boolean, default=False, nullable=False)
    tenant_id            = Column(Integer, ForeignKey("tenants.id"), nullable=True)

    # Trigger conditions — all non-null conditions must match (AND logic)
    trigger_severities   = Column(String)   # comma-sep: "Critical,High"
    trigger_mitre        = Column(String)   # comma-sep technique IDs: "T1059,T1055"
    trigger_rule_pattern = Column(String)   # alert title substring (case-insensitive)

    # JSON list of {"type": "<action>", "params": {...}}
    actions = Column(Text)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    runs = relationship("PlaybookRun", cascade="all, delete-orphan", back_populates="playbook")


class PlaybookRun(Base):
    __tablename__ = "playbook_runs"

    id           = Column(Integer, primary_key=True)
    playbook_id  = Column(Integer, ForeignKey("playbooks.id", ondelete="CASCADE"), nullable=False, index=True)
    alert_id     = Column(Integer, ForeignKey("alerts.id",    ondelete="SET NULL"), nullable=True, index=True)
    status       = Column(String, default="success")   # success | partial | failed
    results      = Column(Text)                        # JSON list of per-action outcomes
    triggered_at = Column(DateTime, default=datetime.utcnow)

    playbook = relationship("Playbook", back_populates="runs")

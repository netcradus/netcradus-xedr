from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from datetime import datetime
from app.database.db import Base


class Incident(Base):
    __tablename__ = "incidents"

    id = Column(Integer, primary_key=True)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    severity = Column(String, nullable=False, default="Low")
    status = Column(String, nullable=False, default="Open")  # Open | Investigating | Resolved

    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False)
    assigned_to = Column(Integer, ForeignKey("users.id"), nullable=True)

    mitre_tactics = Column(String, nullable=True)   # comma-separated technique strings
    alert_count = Column(Integer, default=1)
    affected_endpoints = Column(Integer, default=1)  # distinct agent count

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow)
    resolved_at = Column(DateTime, nullable=True)

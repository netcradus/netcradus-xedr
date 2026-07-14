from datetime import datetime
from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, DateTime, Text
from app.database.db import Base


class ComplianceAssessment(Base):
    """One row per (tenant, control) — the tenant's current status for a control."""
    __tablename__ = "compliance_assessments"

    id              = Column(Integer, primary_key=True)
    control_id      = Column(Integer, ForeignKey("compliance_controls.id"), nullable=False)
    tenant_id       = Column(Integer, ForeignKey("tenants.id"), nullable=False)
    # compliant | partial | non_compliant | not_applicable
    status          = Column(String, nullable=False, default="non_compliant")
    notes           = Column(Text, nullable=True)
    auto_derived    = Column(Boolean, default=False, nullable=False)
    evidence_count  = Column(Integer, default=0, nullable=False)
    last_checked_at = Column(DateTime, nullable=True)
    updated_at      = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

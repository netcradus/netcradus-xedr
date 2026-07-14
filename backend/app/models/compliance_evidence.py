from datetime import datetime
from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Text
from app.database.db import Base


class ComplianceEvidence(Base):
    """Evidence record attached to a control assessment."""
    __tablename__ = "compliance_evidence"

    id            = Column(Integer, primary_key=True)
    control_id    = Column(Integer, ForeignKey("compliance_controls.id"), nullable=False)
    tenant_id     = Column(Integer, ForeignKey("tenants.id"), nullable=False)
    title         = Column(String, nullable=False)
    description   = Column(Text, nullable=True)
    # document | screenshot | log_export | config | policy | test_result
    evidence_type = Column(String, nullable=False, default="document")
    storage_key   = Column(String, nullable=True)   # filled when a file is attached
    uploaded_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at    = Column(DateTime, default=datetime.utcnow)

from datetime import datetime
from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, DateTime
from app.database.db import Base


class ComplianceControl(Base):
    __tablename__ = "compliance_controls"

    id            = Column(Integer, primary_key=True)
    framework_id  = Column(Integer, ForeignKey("compliance_frameworks.id"), nullable=False)
    control_ref   = Column(String, nullable=False)   # e.g. "A.8.7", "CC6.8", "Req-5"
    title         = Column(String, nullable=False)
    description   = Column(String, nullable=True)
    category      = Column(String, nullable=True)    # domain / chapter
    priority      = Column(String, nullable=False, default="High")  # Critical/High/Medium/Low
    # When True, status can be auto-derived from XDR telemetry state
    xdr_auto_check = Column(Boolean, default=False, nullable=False)
    # Key used by compliance_service to know which XDR state to query
    check_type    = Column(String, nullable=True)
    created_at    = Column(DateTime, default=datetime.utcnow)

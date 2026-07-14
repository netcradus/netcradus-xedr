from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from app.database.db import Base


class VulnScan(Base):
    """One scan session per agent submission."""
    __tablename__ = "vuln_scans"

    id              = Column(Integer, primary_key=True)
    agent_id        = Column(Integer, ForeignKey("agents.id"),  nullable=False)
    tenant_id       = Column(Integer, ForeignKey("tenants.id"), nullable=False)
    critical_count  = Column(Integer, default=0, nullable=False)
    high_count      = Column(Integer, default=0, nullable=False)
    medium_count    = Column(Integer, default=0, nullable=False)
    low_count       = Column(Integer, default=0, nullable=False)
    info_count      = Column(Integer, default=0, nullable=False)
    total_findings  = Column(Integer, default=0, nullable=False)
    started_at      = Column(DateTime, default=datetime.utcnow)
    completed_at    = Column(DateTime, nullable=True)

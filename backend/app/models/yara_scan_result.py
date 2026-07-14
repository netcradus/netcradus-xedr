from datetime import datetime
from sqlalchemy import Column, Integer, String, ForeignKey, DateTime
from app.database.db import Base


class YaraScanResult(Base):
    __tablename__ = "yara_scan_results"

    id                = Column(Integer, primary_key=True)
    file_path         = Column(String, nullable=True)
    sha256            = Column(String, nullable=True)
    matched_rule_name = Column(String, nullable=False)
    malware_family    = Column(String, nullable=True)
    severity          = Column(String, nullable=False, default="High")
    mitre_tactic      = Column(String, nullable=True)
    mitre_technique   = Column(String, nullable=True)
    # "auto" = triggered by file telemetry, "download" = download event, "manual" = UI upload
    scan_context      = Column(String, nullable=True)
    agent_id          = Column(Integer, ForeignKey("agents.id"),  nullable=True)
    tenant_id         = Column(Integer, ForeignKey("tenants.id"), nullable=True)
    created_at        = Column(DateTime, default=datetime.utcnow)

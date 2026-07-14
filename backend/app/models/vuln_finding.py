from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Text
from app.database.db import Base


class VulnFinding(Base):
    """Individual vulnerability finding reported by an agent."""
    __tablename__ = "vuln_findings"

    id                  = Column(Integer, primary_key=True)
    scan_id             = Column(Integer, ForeignKey("vuln_scans.id"),  nullable=True)
    agent_id            = Column(Integer, ForeignKey("agents.id"),      nullable=False)
    tenant_id           = Column(Integer, ForeignKey("tenants.id"),     nullable=False)

    # What type of check produced this finding
    # patch | password | smb | rdp | port | software | cve
    check_type          = Column(String,  nullable=False)

    severity            = Column(String,  nullable=False)  # Critical | High | Medium | Low | Info
    title               = Column(String,  nullable=False)
    description         = Column(Text,    nullable=True)
    remediation         = Column(Text,    nullable=True)

    cve_id              = Column(String,  nullable=True)
    cvss_score          = Column(Float,   nullable=True)
    affected_component  = Column(String,  nullable=True)  # e.g. "Port 3389", "SMBv1", "curl 7.68"

    # For software CVE matches
    package_name        = Column(String,  nullable=True)
    installed_version   = Column(String,  nullable=True)
    fixed_version       = Column(String,  nullable=True)

    # Lifecycle
    # open | acknowledged | resolved | false_positive
    status              = Column(String,  nullable=False, default="open")

    first_seen          = Column(DateTime, default=datetime.utcnow)
    last_seen           = Column(DateTime, default=datetime.utcnow)
    created_at          = Column(DateTime, default=datetime.utcnow)
    updated_at          = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

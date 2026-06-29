from datetime import datetime
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey
from app.database.db import Base


class DetectionRule(Base):
    __tablename__ = "detection_rules"

    id              = Column(Integer, primary_key=True)
    name            = Column(String, nullable=False)
    description     = Column(String, nullable=True)

    # Which telemetry stream this rule applies to
    rule_type       = Column(String, nullable=False)   # process | network | file | persistence

    # Field within that stream to inspect
    field           = Column(String, nullable=False)

    # How to compare
    operator        = Column(String, nullable=False)   # contains | not_contains | equals | not_equals |
                                                       # starts_with | ends_with | regex | in_list |
                                                       # greater_than | less_than

    # The comparison value (comma-separated for in_list)
    value           = Column(String, nullable=False)

    severity        = Column(String, nullable=False, default="Medium")  # Low | Medium | High | Critical
    mitre_tactic    = Column(String, nullable=True)
    mitre_technique = Column(String, nullable=True)

    enabled         = Column(Boolean, default=True, nullable=False)

    # NULL = system-wide (built-in); set to tenant_id for tenant-specific rules
    tenant_id       = Column(Integer, ForeignKey("tenants.id"), nullable=True)
    is_system       = Column(Boolean, default=False, nullable=False)

    created_at      = Column(DateTime, default=datetime.utcnow)
    updated_at      = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

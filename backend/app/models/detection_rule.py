from datetime import datetime
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Index
from sqlalchemy.orm import relationship
from app.database.db import Base


class DetectionRule(Base):
    __tablename__ = "detection_rules"
    __table_args__ = (
        Index("ix_detection_rules_type_enabled_tenant", "rule_type", "enabled", "tenant_id"),
    )

    id              = Column(Integer, primary_key=True)
    name            = Column(String, nullable=False)
    description     = Column(String, nullable=True)

    # Which telemetry stream this rule applies to
    rule_type       = Column(String, nullable=False)   # process | network | file | persistence | log

    # AND = all conditions must match; OR = any condition matches
    logic           = Column(String, nullable=False, default="OR")

    severity        = Column(String, nullable=False, default="Medium")  # Low | Medium | High | Critical
    mitre_tactic    = Column(String, nullable=True)
    mitre_technique = Column(String, nullable=True)

    enabled         = Column(Boolean, default=True, nullable=False)

    # NULL = system-wide (built-in); set to tenant_id for tenant-specific rules
    tenant_id       = Column(Integer, ForeignKey("tenants.id"), nullable=True)
    is_system       = Column(Boolean, default=False, nullable=False)

    created_at      = Column(DateTime, default=datetime.utcnow)
    updated_at      = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    conditions      = relationship(
        "DetectionRuleCondition",
        cascade="all, delete-orphan",
        order_by="DetectionRuleCondition.sort_order",
        lazy="selectin",
    )

from datetime import datetime
from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, DateTime, Text
from app.database.db import Base


class SigmaRule(Base):
    __tablename__ = "sigma_rules"

    id                  = Column(Integer, primary_key=True)
    title               = Column(String, nullable=False)
    status              = Column(String)              # stable | test | experimental | deprecated
    description         = Column(String)
    author              = Column(String)
    sigma_id            = Column(String)              # UUID from the Sigma rule
    yaml_content        = Column(Text, nullable=False)# raw Sigma YAML
    detection_rule_id   = Column(Integer, ForeignKey("detection_rules.id"), nullable=True)
    # NULL = not yet converted; set after successful conversion
    conversion_error    = Column(String)
    enabled             = Column(Boolean, default=True, nullable=False)
    tenant_id           = Column(Integer, ForeignKey("tenants.id"), nullable=True)
    created_at          = Column(DateTime, default=datetime.utcnow)
    updated_at          = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

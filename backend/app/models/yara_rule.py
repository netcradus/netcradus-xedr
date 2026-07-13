from datetime import datetime
from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, DateTime, Text
from app.database.db import Base


class YaraRule(Base):
    __tablename__ = "yara_rules"

    id          = Column(Integer, primary_key=True)
    name        = Column(String, nullable=False)
    description = Column(String)
    tags        = Column(String)           # space-separated YARA tags
    content     = Column(Text, nullable=False)  # raw YARA rule text
    severity    = Column(String, default="High")
    mitre_tactic    = Column(String)
    mitre_technique = Column(String)
    enabled     = Column(Boolean, default=True, nullable=False)
    is_system   = Column(Boolean, default=False, nullable=False)
    tenant_id   = Column(Integer, ForeignKey("tenants.id"), nullable=True)
    created_at  = Column(DateTime, default=datetime.utcnow)
    updated_at  = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

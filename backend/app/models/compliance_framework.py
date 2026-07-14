from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime
from app.database.db import Base


class ComplianceFramework(Base):
    __tablename__ = "compliance_frameworks"

    id          = Column(Integer, primary_key=True)
    name        = Column(String, nullable=False, unique=True)
    version     = Column(String, nullable=True)   # e.g. "2022", "v4.0"
    description = Column(String, nullable=True)
    category    = Column(String, nullable=True)   # e.g. "Information Security", "Privacy"
    color       = Column(String, nullable=True)   # hex for UI ring chart
    created_at  = Column(DateTime, default=datetime.utcnow)

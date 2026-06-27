from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from app.database.db import Base


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id            = Column(Integer, primary_key=True)
    tenant_id     = Column(Integer, ForeignKey("tenants.id"), nullable=False)
    user_id       = Column(Integer, nullable=True)
    user_name     = Column(String, nullable=True)
    action        = Column(String, nullable=False)
    resource_type = Column(String, nullable=True)
    resource_id   = Column(Integer, nullable=True)
    details       = Column(String, nullable=True)
    timestamp     = Column(DateTime, default=datetime.utcnow)

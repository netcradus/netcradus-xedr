from datetime import datetime
from sqlalchemy import Boolean, Column, DateTime, Integer, String, Text
from app.database.db import Base


class ScheduledReportConfig(Base):
    __tablename__ = "scheduled_report_configs"

    id          = Column(Integer, primary_key=True)
    tenant_id   = Column(Integer, nullable=False, index=True)
    report_type = Column(String(50), nullable=False)   # daily_soc | weekly_exec | monthly_compliance
    enabled     = Column(Boolean, default=True)
    recipients  = Column(Text, nullable=True)          # comma-separated email list
    last_run_at = Column(DateTime, nullable=True)
    created_at  = Column(DateTime, default=datetime.utcnow)
    updated_at  = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

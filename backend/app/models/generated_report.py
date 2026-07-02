from datetime import datetime
from sqlalchemy import Column, DateTime, Integer, LargeBinary, String
from app.database.db import Base


class GeneratedReport(Base):
    __tablename__ = "generated_reports"

    id           = Column(Integer, primary_key=True)
    tenant_id    = Column(Integer, nullable=False, index=True)
    report_type  = Column(String(50), nullable=False)   # daily_soc | weekly_exec | monthly_compliance
    period_start = Column(DateTime, nullable=False)
    period_end   = Column(DateTime, nullable=False)
    pdf_data     = Column(LargeBinary, nullable=True)
    file_size    = Column(Integer, nullable=True)        # bytes
    generated_at = Column(DateTime, default=datetime.utcnow)
    triggered_by = Column(String(50), default="schedule")  # schedule | manual | api
    status       = Column(String(20), default="pending")   # pending | done | failed
    error        = Column(String(500), nullable=True)

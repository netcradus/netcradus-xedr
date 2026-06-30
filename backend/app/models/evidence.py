from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from datetime import datetime
from app.database.db import Base


class Evidence(Base):
    __tablename__ = "evidence"

    id            = Column(Integer, primary_key=True)
    incident_id   = Column(Integer, ForeignKey("incidents.id", ondelete="CASCADE"), nullable=False)
    added_by_id   = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    added_by_name = Column(String(255), nullable=True)
    title         = Column(String(500), nullable=False)
    # log_snippet | ioc_ref | artifact | network_capture | command_output | note
    evidence_type = Column(String(50), default="note")
    content       = Column(Text, nullable=True)
    created_at    = Column(DateTime, default=datetime.utcnow)

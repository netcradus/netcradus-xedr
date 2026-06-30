from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from datetime import datetime
from app.database.db import Base


class InvestigationNote(Base):
    __tablename__ = "investigation_notes"

    id          = Column(Integer, primary_key=True)
    incident_id = Column(Integer, ForeignKey("incidents.id", ondelete="CASCADE"), nullable=False)
    user_id     = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    user_name   = Column(String(255), nullable=True)
    note_type   = Column(String(50), default="note")   # note | finding | action_taken | ioc_ref
    content     = Column(Text, nullable=False)
    created_at  = Column(DateTime, default=datetime.utcnow)

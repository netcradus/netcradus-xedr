from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from app.database.db import Base


class SupportTicket(Base):
    __tablename__ = "support_tickets"

    id         = Column(Integer, primary_key=True)
    tenant_id  = Column(Integer, ForeignKey("tenants.id"), nullable=True)
    user_id    = Column(Integer, ForeignKey("users.id"), nullable=True)
    user_name  = Column(String, nullable=True)
    user_email = Column(String, nullable=True)
    tenant_name = Column(String, nullable=True)
    subject    = Column(String, nullable=False)
    message    = Column(Text, nullable=False)
    priority   = Column(String, default="Medium")   # Low | Medium | High | Critical
    status     = Column(String, default="Open")     # Open | In Progress | Resolved | Closed
    admin_note = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

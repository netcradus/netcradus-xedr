from datetime import datetime
from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Text, Boolean
from sqlalchemy.orm import relationship
from app.database.db import Base


class LiveSession(Base):
    """An interactive live-response session with an agent."""
    __tablename__ = "live_sessions"

    id          = Column(Integer, primary_key=True)
    agent_id    = Column(Integer, ForeignKey("agents.id"), nullable=False)
    initiator_id= Column(Integer, ForeignKey("users.id"), nullable=False)
    tenant_id   = Column(Integer, ForeignKey("tenants.id"), nullable=False)
    status      = Column(String, default="open")   # open | closed | timed_out
    shell_type  = Column(String, default="cmd")    # cmd | powershell | bash
    opened_at   = Column(DateTime, default=datetime.utcnow)
    closed_at   = Column(DateTime, nullable=True)

    entries     = relationship("LiveSessionEntry", back_populates="session",
                               order_by="LiveSessionEntry.timestamp", cascade="all, delete-orphan")


class LiveSessionEntry(Base):
    """A single command/output pair within a live session."""
    __tablename__ = "live_session_entries"

    id          = Column(Integer, primary_key=True)
    session_id  = Column(Integer, ForeignKey("live_sessions.id", ondelete="CASCADE"), nullable=False)
    direction   = Column(String)   # input | output
    content     = Column(Text)
    timestamp   = Column(DateTime, default=datetime.utcnow)

    session     = relationship("LiveSession", back_populates="entries")

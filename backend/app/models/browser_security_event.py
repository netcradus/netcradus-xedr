from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from app.database.db import Base


class BrowserSecurityEvent(Base):
    __tablename__ = "browser_security_events"

    id             = Column(Integer, primary_key=True)
    agent_id       = Column(Integer, ForeignKey("agents.id"),  nullable=False)
    tenant_id      = Column(Integer, ForeignKey("tenants.id"), nullable=False)

    # extension | password_leak | ai_usage | malicious_download | malicious_site
    event_type     = Column(String, nullable=False)
    # Critical | High | Medium | Low | Info
    severity       = Column(String, nullable=False)

    browser        = Column(String, nullable=True)   # chrome | edge | firefox
    title          = Column(String, nullable=False)
    description    = Column(Text,   nullable=True)

    # Context — populated based on event_type
    url            = Column(String, nullable=True)
    extension_id   = Column(String, nullable=True)
    extension_name = Column(String, nullable=True)
    file_name      = Column(String, nullable=True)
    file_path      = Column(String, nullable=True)
    sha256         = Column(String, nullable=True)
    username       = Column(String, nullable=True)

    # open | acknowledged | resolved | false_positive
    status         = Column(String, nullable=False, default="open")

    detected_at    = Column(DateTime, default=datetime.utcnow)
    created_at     = Column(DateTime, default=datetime.utcnow)
    updated_at     = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

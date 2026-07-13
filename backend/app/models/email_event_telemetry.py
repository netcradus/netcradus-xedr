from datetime import datetime
from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Boolean, Text
from app.database.db import Base


class EmailEventTelemetry(Base):
    __tablename__ = "email_event_telemetry"

    id              = Column(Integer, primary_key=True)
    event_type      = Column(String)   # received | sent | blocked | phishing_click | attachment_executed | rule_triggered
    direction       = Column(String)   # inbound | outbound | internal
    sender          = Column(String)
    recipient       = Column(String)   # CSV for multiple recipients
    subject         = Column(String)
    message_id      = Column(String)
    source_ip       = Column(String)   # originating MTA IP
    has_attachment  = Column(Boolean, default=False)
    attachment_name = Column(String)
    attachment_sha256= Column(String)
    url_clicked     = Column(String)   # if phishing_click, the URL clicked
    verdict         = Column(String)   # clean | spam | phishing | malware | suspicious
    score           = Column(Integer)  # threat score 0-100
    raw_headers     = Column(Text)
    timestamp       = Column(DateTime, default=datetime.utcnow)
    agent_id        = Column(Integer, ForeignKey("agents.id"), nullable=True)
    tenant_id       = Column(Integer, ForeignKey("tenants.id"), nullable=True)

from datetime import datetime
from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text
from app.database.db import Base


class LogTelemetry(Base):
    __tablename__ = "log_telemetry"

    id           = Column(Integer, primary_key=True)
    agent_id     = Column(Integer, ForeignKey("agents.id"), nullable=False, index=True)
    log_source   = Column(String(50), nullable=False, index=True)  # syslog|wineventlog|iis|apache|nginx|application
    raw_message  = Column(Text, nullable=True)
    severity     = Column(String(20), nullable=True)               # info|warning|error|critical
    event_id     = Column(Integer, nullable=True)                   # Windows Event ID
    facility     = Column(Integer, nullable=True)                   # Syslog facility code
    hostname     = Column(String(255), nullable=True)
    process_name = Column(String(255), nullable=True)
    username     = Column(String(255), nullable=True)
    source_ip    = Column(String(45), nullable=True)
    log_message  = Column(Text, nullable=True)                      # Parsed/trimmed message
    extra        = Column(Text, nullable=True)                      # JSON for source-specific fields
    timestamp    = Column(DateTime, nullable=False, index=True)     # Timestamp from the log entry
    created_at   = Column(DateTime, default=datetime.utcnow)

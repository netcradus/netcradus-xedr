from pydantic import BaseModel
from typing import List, Optional


class LogEntry(BaseModel):
    log_source:   str
    raw_message:  Optional[str] = None
    severity:     Optional[str] = None     # info|warning|error|critical
    event_id:     Optional[int] = None     # Windows Event ID
    facility:     Optional[int] = None     # Syslog facility code
    hostname:     Optional[str] = None
    process_name: Optional[str] = None
    username:     Optional[str] = None
    source_ip:    Optional[str] = None
    log_message:  Optional[str] = None     # Parsed message / URL path for web logs
    extra:        Optional[dict] = None    # Source-specific fields (method, status, user_agent, etc.)
    timestamp:    str                      # ISO 8601


class LogTelemetryRequest(BaseModel):
    agent_token: str
    entries:     List[LogEntry]

from datetime import datetime
from sqlalchemy import Column, Integer, String, ForeignKey, DateTime
from app.database.db import Base


class RegistryTelemetry(Base):
    __tablename__ = "registry_telemetry"

    id           = Column(Integer, primary_key=True)
    event_type   = Column(String)   # created | modified | deleted | renamed
    registry_key = Column(String)   # full registry path
    value_name   = Column(String)   # registry value name (None = key-level op)
    value_data   = Column(String)   # registry value data (truncated to 512 chars)
    value_type   = Column(String)   # REG_SZ | REG_DWORD | REG_BINARY | REG_EXPAND_SZ | …
    process_name = Column(String)
    pid          = Column(Integer)
    username     = Column(String)
    timestamp    = Column(DateTime, default=datetime.utcnow)
    agent_id     = Column(Integer, ForeignKey("agents.id"))

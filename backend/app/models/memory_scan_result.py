from datetime import datetime
from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Text
from app.database.db import Base


class MemoryScanResult(Base):
    __tablename__ = "memory_scan_results"

    id            = Column(Integer, primary_key=True)
    scan_type     = Column(String)    # yara | signature | heuristic
    rule_name     = Column(String)    # matched YARA rule or signature name
    process_name  = Column(String)
    pid           = Column(Integer)
    memory_region = Column(String)    # address range (e.g. 0x00400000-0x00420000)
    matched_bytes = Column(String)    # hex snippet of the matched bytes (first 64 bytes)
    severity      = Column(String, default="High")
    details       = Column(Text)      # additional context / hex dump excerpt
    timestamp     = Column(DateTime, default=datetime.utcnow)
    agent_id      = Column(Integer, ForeignKey("agents.id"))

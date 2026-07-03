from sqlalchemy import Column, Integer, String, DateTime, Boolean, Text
from datetime import datetime

from app.database.db import Base


class AgentVersion(Base):
    __tablename__ = "agent_versions"

    id              = Column(Integer, primary_key=True)
    version         = Column(String(32), nullable=False, unique=True)
    platform        = Column(String(20), nullable=False, default="all")  # windows|linux|macos|all
    filename        = Column(String(255), nullable=False)
    checksum_sha256 = Column(String(64), nullable=False)
    file_size       = Column(Integer)
    release_notes   = Column(Text)
    is_current      = Column(Boolean, nullable=False, default=False, index=True)
    created_at      = Column(DateTime, default=datetime.utcnow)
    uploaded_by     = Column(String(255))

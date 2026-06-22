from sqlalchemy import (
    Column,
    Integer,
    String,
    ForeignKey,
    DateTime
)

from datetime import datetime

from app.database.db import Base


class ProcessTelemetry(Base):

    __tablename__ = "process_telemetry"

    id = Column(Integer, primary_key=True)

    pid = Column(Integer)

    ppid = Column(Integer)

    process_name = Column(String)
    parent_process_name = Column(String)

    cmdline = Column(String)

    exe_path = Column(String)

    username = Column(String)

    sha256 = Column(String)

    timestamp = Column(
        DateTime,
        default=datetime.utcnow
    )

    agent_id = Column(
        Integer,
        ForeignKey("agents.id")
    )
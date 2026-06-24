from sqlalchemy import (
    Column,
    Integer,
    String,
    ForeignKey,
    DateTime
)

from datetime import datetime

from app.database.db import Base


class FileTelemetry(Base):

    __tablename__ = "file_telemetry"

    id = Column(Integer, primary_key=True)

    event_type = Column(String)

    file_path = Column(String)

    timestamp = Column(
        DateTime,
        default=datetime.utcnow
    )

    agent_id = Column(
        Integer,
        ForeignKey("agents.id")
    )
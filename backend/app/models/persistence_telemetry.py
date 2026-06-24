from sqlalchemy import (
    Column,
    Integer,
    String,
    ForeignKey,
    DateTime
)

from datetime import datetime

from app.database.db import Base


class PersistenceTelemetry(Base):

    __tablename__ = "persistence_telemetry"

    id = Column(Integer, primary_key=True)

    persistence_type = Column(String)

    entry_name = Column(String)

    entry_path = Column(String)

    timestamp = Column(
        DateTime,
        default=datetime.utcnow
    )

    agent_id = Column(
        Integer,
        ForeignKey("agents.id")
    )
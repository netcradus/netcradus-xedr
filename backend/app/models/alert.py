from sqlalchemy import (
    Column,
    Integer,
    String,
    ForeignKey,
    DateTime
)

from datetime import datetime

from app.database.db import Base


class Alert(Base):

    __tablename__ = "alerts"

    id = Column(Integer, primary_key=True)

    title = Column(String)

    description = Column(String)

    severity = Column(String)

    mitre_technique = Column(String)

    status = Column(
        String,
        default="Open"
    )

    occurrence_count = Column(
        Integer,
        default=1
    )

    timestamp = Column(
        DateTime,
        default=datetime.utcnow
    )

    agent_id = Column(
        Integer,
        ForeignKey("agents.id")
    )

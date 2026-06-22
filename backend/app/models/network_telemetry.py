from sqlalchemy import (
    Column,
    Integer,
    String,
    ForeignKey,
    DateTime
)

from datetime import datetime

from app.database.db import Base


class NetworkTelemetry(Base):

    __tablename__ = "network_telemetry"

    id = Column(Integer, primary_key=True)

    local_ip = Column(String)

    remote_ip = Column(String)

    remote_port = Column(Integer)

    protocol = Column(String)

    timestamp = Column(
        DateTime,
        default=datetime.utcnow
    )

    agent_id = Column(
        Integer,
        ForeignKey("agents.id")
    )
from sqlalchemy import (
    Column,
    Integer,
    String,
    ForeignKey,
    DateTime
)

from datetime import datetime

from app.database.db import Base


class Command(Base):

    __tablename__ = "commands"

    id = Column(Integer, primary_key=True)

    command_type = Column(String)

    argument = Column(String)

    status = Column(
        String,
        default="Pending"
    )

    timestamp = Column(
        DateTime,
        default=datetime.utcnow
    )

    agent_id = Column(
        Integer,
        ForeignKey("agents.id")
    )
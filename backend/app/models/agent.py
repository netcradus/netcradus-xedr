from sqlalchemy import (
    Column,
    Integer,
    String,
    DateTime,
    ForeignKey
)
from sqlalchemy.orm import relationship
from datetime import datetime

from app.database.db import Base


class Agent(Base):

    __tablename__ = "agents"

    id = Column(Integer, primary_key=True)

    hostname = Column(String)

    ip_address = Column(String)

    os_type = Column(String)

    agent_version = Column(String)

    status = Column(
        String,
        default="Online"
    )

    last_seen = Column(
        DateTime,
        default=datetime.utcnow
    )

    agent_token = Column(
        String,
        unique=True
    )

    tenant_id = Column(
        Integer,
        ForeignKey("tenants.id")
    )

    tenant = relationship("Tenant")
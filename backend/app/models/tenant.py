from datetime import datetime
from sqlalchemy import Boolean, Column, DateTime, Integer, String
from app.database.db import Base


class Tenant(Base):

    __tablename__ = "tenants"

    id = Column(Integer, primary_key=True)

    name = Column(String, unique=True, nullable=False)

    api_key = Column(String, unique=True)

    is_active = Column(Boolean, default=True)

    plan = Column(String(50), default="Free")

    created_at = Column(DateTime, default=datetime.utcnow)
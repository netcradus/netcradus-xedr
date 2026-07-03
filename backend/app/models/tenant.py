from datetime import datetime
from sqlalchemy import Boolean, Column, DateTime, Integer, String
from app.database.db import Base


class Tenant(Base):

    __tablename__ = "tenants"

    id = Column(Integer, primary_key=True)

    name = Column(String, unique=True, nullable=False)

    api_key = Column(String, unique=True)

    is_active = Column(Boolean, default=True)

    # "free" | "professional" | "enterprise"
    plan = Column(String(50), default="free")

    # Per-tenant agent cap override; NULL means use the plan default
    plan_agent_limit = Column(Integer, nullable=True)

    # Optional expiry for time-limited plans / trials
    plan_expires_at = Column(DateTime, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
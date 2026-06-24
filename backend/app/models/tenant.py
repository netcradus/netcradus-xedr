from sqlalchemy import Column, Integer, String, Boolean
from app.database.db import Base


class Tenant(Base):

    __tablename__ = "tenants"

    id = Column(Integer, primary_key=True)

    name = Column(
        String,
        unique=True,
        nullable=False
    )

    api_key = Column(
        String,
        unique=True
    )

    is_active = Column(
        Boolean,
        default=True
    )
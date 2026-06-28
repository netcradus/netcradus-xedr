from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.database.db import Base


class User(Base):

    __tablename__ = "users"

    id = Column(Integer, primary_key=True)

    name = Column(String)

    email = Column(String, unique=True)

    password = Column(String)

    is_active = Column(Boolean, default=True)

    role_id = Column(
        Integer,
        ForeignKey("roles.id")
    )

    role = relationship("Role")

    tenant_id = Column(
        Integer,
        ForeignKey("tenants.id")
    )

    tenant = relationship("Tenant")

    email_verified = Column(Boolean, default=False)
    email_verification_token = Column(String, unique=True, nullable=True)
    password_reset_token = Column(String, unique=True, nullable=True)
    password_reset_expires = Column(DateTime, nullable=True)
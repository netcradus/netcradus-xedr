from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)

from datetime import datetime

from app.database.db import Base


class IOC(Base):

    __tablename__ = "iocs"
    __table_args__ = (
        # Two different tenants may legitimately track the same IOC value.
        # Uniqueness is enforced per-tenant, not globally.
        UniqueConstraint("tenant_id", "value", name="uq_ioc_tenant_value"),
    )

    id = Column(Integer, primary_key=True, index=True)

    # Every IOC belongs to exactly one tenant.  Nullable only during the
    # migration window — the application always sets this on creation.
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=True, index=True)

    type = Column(String(50), nullable=False, index=True)

    value = Column(String(512), nullable=False, index=True)

    description = Column(Text)

    category = Column(String(100))

    severity = Column(String(20))

    source = Column(String(100))

    created_by = Column(String(100))

    created_at = Column(
        DateTime,
        default=datetime.utcnow
    )

    expires_at = Column(
        DateTime,
        nullable=True
    )

    is_active = Column(
        Boolean,
        default=True
    )

    enrichment_status = Column(String(20), nullable=True, default="pending")

    vt_score = Column(Integer, nullable=True)

    enrichment_data = Column(Text, nullable=True)

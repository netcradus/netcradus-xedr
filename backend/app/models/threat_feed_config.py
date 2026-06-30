from datetime import datetime
from sqlalchemy import Column, DateTime, ForeignKey, Integer, String
from app.database.db import Base


class ThreatFeedConfig(Base):
    __tablename__ = "threat_feed_configs"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), unique=True, nullable=False)
    virustotal_api_key = Column(String(512), nullable=True)
    abuseipdb_api_key  = Column(String(512), nullable=True)
    otx_api_key        = Column(String(512), nullable=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

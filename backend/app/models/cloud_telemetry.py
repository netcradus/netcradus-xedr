from datetime import datetime
from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Text
from app.database.db import Base


class CloudTelemetry(Base):
    __tablename__ = "cloud_telemetry"

    id            = Column(Integer, primary_key=True)
    provider      = Column(String)   # aws | azure | gcp | generic
    event_type    = Column(String)   # api_call | resource_created | resource_deleted | policy_change | iam_change | login
    resource_type = Column(String)   # EC2 | S3 | IAM | StorageAccount | …
    resource_id   = Column(String)   # ARN / resource ID
    region        = Column(String)
    actor         = Column(String)   # IAM user / service principal that performed the action
    source_ip     = Column(String)
    action        = Column(String)   # API action name (e.g. s3:DeleteBucket)
    outcome       = Column(String, default="success")  # success | failure
    raw_event     = Column(Text)     # JSON-encoded original cloud event
    timestamp     = Column(DateTime, default=datetime.utcnow)
    agent_id      = Column(Integer, ForeignKey("agents.id"), nullable=True)
    tenant_id     = Column(Integer, ForeignKey("tenants.id"), nullable=True)

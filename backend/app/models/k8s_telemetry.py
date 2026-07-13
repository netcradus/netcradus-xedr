from datetime import datetime
from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Text
from app.database.db import Base


class K8sTelemetry(Base):
    __tablename__ = "k8s_telemetry"

    id            = Column(Integer, primary_key=True)
    event_type    = Column(String)   # pod_created | pod_deleted | exec_into_pod | privileged_container | secret_access | rbac_change | image_pull
    cluster       = Column(String)
    namespace     = Column(String)
    resource_kind = Column(String)   # Pod | Deployment | ServiceAccount | Role | ClusterRole | …
    resource_name = Column(String)
    actor         = Column(String)   # user / service account that performed the action
    container     = Column(String)   # container name (for exec events)
    image         = Column(String)   # container image (for pod/image events)
    command       = Column(String)   # command run via exec
    outcome       = Column(String, default="success")
    raw_event     = Column(Text)     # JSON-encoded Kubernetes audit log event
    timestamp     = Column(DateTime, default=datetime.utcnow)
    agent_id      = Column(Integer, ForeignKey("agents.id"), nullable=True)
    tenant_id     = Column(Integer, ForeignKey("tenants.id"), nullable=True)

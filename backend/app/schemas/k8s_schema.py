from pydantic import BaseModel
from typing import List, Optional


class K8sEvent(BaseModel):
    event_type:    str
    cluster:       Optional[str] = None
    namespace:     Optional[str] = None
    resource_kind: Optional[str] = None
    resource_name: Optional[str] = None
    actor:         Optional[str] = None
    container:     Optional[str] = None
    image:         Optional[str] = None
    command:       Optional[str] = None
    outcome:       str = "success"
    raw_event:     Optional[str] = None  # JSON string


class K8sTelemetryRequest(BaseModel):
    agent_token:    Optional[str] = None
    tenant_api_key: Optional[str] = None
    events:         List[K8sEvent]

from pydantic import BaseModel
from typing import List, Optional


class CloudEvent(BaseModel):
    provider:      str
    event_type:    str
    resource_type: Optional[str] = None
    resource_id:   Optional[str] = None
    region:        Optional[str] = None
    actor:         Optional[str] = None
    source_ip:     Optional[str] = None
    action:        Optional[str] = None
    outcome:       str = "success"
    raw_event:     Optional[str] = None  # JSON string


class CloudTelemetryRequest(BaseModel):
    agent_token: Optional[str] = None   # optional: cloud events may come from a collector, not an agent
    tenant_api_key: Optional[str] = None
    events:      List[CloudEvent]

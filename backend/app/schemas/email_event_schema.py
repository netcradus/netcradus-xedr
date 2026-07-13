from pydantic import BaseModel
from typing import List, Optional


class EmailEvent(BaseModel):
    event_type:       str
    direction:        str = "inbound"
    sender:           Optional[str] = None
    recipient:        Optional[str] = None
    subject:          Optional[str] = None
    message_id:       Optional[str] = None
    source_ip:        Optional[str] = None
    has_attachment:   bool = False
    attachment_name:  Optional[str] = None
    attachment_sha256:Optional[str] = None
    url_clicked:      Optional[str] = None
    verdict:          str = "clean"
    score:            int = 0
    raw_headers:      Optional[str] = None


class EmailTelemetryRequest(BaseModel):
    agent_token:    Optional[str] = None
    tenant_api_key: Optional[str] = None
    events:         List[EmailEvent]

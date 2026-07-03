from pydantic import BaseModel
from typing import Optional


class HeartbeatRequest(BaseModel):
    agent_token:   str
    hostname:      str
    os_type:       str
    ip_address:    str
    agent_version: Optional[str] = None

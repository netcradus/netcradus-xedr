from pydantic import BaseModel
from typing import List, Optional


class DnsEntry(BaseModel):
    query_name:   str
    query_type:   str = "A"
    response:     Optional[str] = None
    direction:    str = "query"
    process_name: Optional[str] = None
    pid:          Optional[int] = None
    username:     Optional[str] = None


class DnsTelemetryRequest(BaseModel):
    agent_token: str
    entries:     List[DnsEntry]

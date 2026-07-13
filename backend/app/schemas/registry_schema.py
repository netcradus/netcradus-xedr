from pydantic import BaseModel
from typing import List, Optional


class RegistryEntry(BaseModel):
    event_type:   str                    # created | modified | deleted | renamed
    registry_key: str
    value_name:   Optional[str] = None
    value_data:   Optional[str] = None
    value_type:   Optional[str] = None
    process_name: Optional[str] = None
    pid:          Optional[int] = None
    username:     Optional[str] = None


class RegistryTelemetryRequest(BaseModel):
    agent_token: str
    entries:     List[RegistryEntry]

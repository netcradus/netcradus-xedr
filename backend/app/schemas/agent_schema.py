from pydantic import BaseModel
from typing import Optional


class AgentRegister(BaseModel):

    hostname: str

    ip_address: str

    os_type: str

    agent_version: str

    registration_token: Optional[str] = None

from pydantic import BaseModel


class HeartbeatRequest(BaseModel):

    agent_token: str

    hostname: str

    os_type: str

    ip_address: str
from pydantic import BaseModel


class AgentRegister(BaseModel):

    hostname: str

    ip_address: str

    os_type: str

    agent_version: str
from pydantic import BaseModel
from typing import List


class NetworkConnection(BaseModel):

    local_ip: str

    remote_ip: str

    remote_port: int

    protocol: str


class NetworkTelemetryRequest(BaseModel):

    agent_token: str

    connections: List[NetworkConnection]
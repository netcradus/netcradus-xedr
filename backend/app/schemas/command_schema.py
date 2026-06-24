from pydantic import BaseModel


class KillProcessCommand(BaseModel):

    agent_id: int

    pid: int


class IsolateHostCommand(BaseModel):

    agent_id: int


class BlockIPCommand(BaseModel):

    agent_id: int

    ip_address: str


class QuarantineFileCommand(BaseModel):

    agent_id: int

    file_path: str
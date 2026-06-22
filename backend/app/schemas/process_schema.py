from pydantic import BaseModel
from typing import List


class ProcessData(BaseModel):

    pid: int

    ppid: int

    parent_process_name: str

    process_name: str

    cmdline: str

    exe_path: str

    username: str

    sha256: str


class ProcessTelemetryRequest(BaseModel):

    agent_token: str

    processes: List[ProcessData]
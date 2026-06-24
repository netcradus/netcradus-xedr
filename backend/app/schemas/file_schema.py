from pydantic import BaseModel
from typing import List


class FileEvent(BaseModel):

    event_type: str

    file_path: str


class FileTelemetryRequest(BaseModel):

    agent_token: str

    events: List[FileEvent]
from pydantic import BaseModel
from typing import List
from typing import Optional


class FileEvent(BaseModel):

    event_type: str

    file_path: str

    sha256: Optional[str] = None

    md5: Optional[str] = None


class FileTelemetryRequest(BaseModel):

    agent_token: str

    events: List[FileEvent]

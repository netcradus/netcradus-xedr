from pydantic import BaseModel
from typing import List
from typing import Optional


class FileEvent(BaseModel):

    event_type: str

    file_path: str

    sha256: Optional[str] = None

    md5: Optional[str] = None

    # Agent may include base64-encoded file bytes for YARA content scanning.
    # When absent, the YARA engine scans the file_path string instead.
    content_b64: Optional[str] = None

    file_size: Optional[int] = None


class FileTelemetryRequest(BaseModel):

    agent_token: str

    events: List[FileEvent]

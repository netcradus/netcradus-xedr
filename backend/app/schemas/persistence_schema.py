from pydantic import BaseModel
from typing import List


class PersistenceEntry(BaseModel):

    persistence_type: str

    entry_name: str

    entry_path: str


class PersistenceTelemetryRequest(BaseModel):

    agent_token: str

    entries: List[PersistenceEntry]
from pydantic import BaseModel
from typing import List, Optional


class MemoryScanEntry(BaseModel):
    scan_type:     str = "yara"          # yara | signature | heuristic
    rule_name:     str
    process_name:  str
    pid:           int
    memory_region: Optional[str] = None
    matched_bytes: Optional[str] = None
    severity:      str = "High"
    details:       Optional[str] = None


class MemoryScanRequest(BaseModel):
    agent_token: str
    entries:     List[MemoryScanEntry]

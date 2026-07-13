from pydantic import BaseModel
from typing import List, Optional


class BrowserExtensionEntry(BaseModel):
    event_type:     str
    browser:        str
    extension_id:   str
    extension_name: Optional[str] = None
    version:        Optional[str] = None
    permissions:    Optional[str] = None
    from_webstore:  bool = True
    update_url:     Optional[str] = None
    username:       Optional[str] = None


class BrowserExtensionRequest(BaseModel):
    agent_token: str
    entries:     List[BrowserExtensionEntry]

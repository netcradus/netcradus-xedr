from pydantic import BaseModel
from typing import List, Optional


class UsbEntry(BaseModel):
    event_type:   str
    device_id:    Optional[str] = None
    device_name:  Optional[str] = None
    vendor_id:    Optional[str] = None
    product_id:   Optional[str] = None
    drive_letter: Optional[str] = None
    file_path:    Optional[str] = None
    username:     Optional[str] = None


class UsbTelemetryRequest(BaseModel):
    agent_token: str
    entries:     List[UsbEntry]

from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


class LinkedAlert(BaseModel):
    id: int
    title: str
    description: Optional[str] = None
    severity: str
    mitre_technique: Optional[str] = None
    status: str
    occurrence_count: int
    timestamp: datetime
    agent_id: int
    agent_hostname: Optional[str] = None

    class Config:
        from_attributes = True


class IncidentResponse(BaseModel):
    id: int
    title: str
    description: Optional[str] = None
    severity: str
    status: str
    tenant_id: int
    assigned_to: Optional[int] = None
    mitre_tactics: Optional[str] = None
    alert_count: int
    affected_endpoints: int
    created_at: datetime
    updated_at: datetime
    resolved_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class IncidentDetailResponse(IncidentResponse):
    alerts: List[LinkedAlert] = []


class IncidentStatsResponse(BaseModel):
    total: int
    open: int
    investigating: int
    resolved: int
    critical: int
    high: int


class UpdateStatusRequest(BaseModel):
    status: str   # Open | Investigating | Resolved


class CreateIncidentRequest(BaseModel):
    title: str
    description: Optional[str] = None
    severity: str = "Medium"

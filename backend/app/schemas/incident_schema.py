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


class InvestigationNoteResponse(BaseModel):
    id: int
    user_name: Optional[str] = None
    note_type: str
    content: str
    created_at: datetime

    class Config:
        from_attributes = True


class EvidenceResponse(BaseModel):
    id: int
    added_by_name: Optional[str] = None
    title: str
    evidence_type: str
    content: Optional[str] = None
    created_at: datetime

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
    root_cause: Optional[str] = None
    resolution_summary: Optional[str] = None
    containment_actions: Optional[str] = None
    lessons_learned: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    resolved_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class IncidentDetailResponse(IncidentResponse):
    alerts: List[LinkedAlert] = []
    notes: List[InvestigationNoteResponse] = []
    evidence: List[EvidenceResponse] = []


class IncidentStatsResponse(BaseModel):
    total: int
    open: int
    investigating: int
    contained: int
    resolved: int
    critical: int
    high: int


class UpdateStatusRequest(BaseModel):
    status: str   # Open | Investigating | Contained | Resolved


class ResolveIncidentRequest(BaseModel):
    root_cause: Optional[str] = None
    resolution_summary: Optional[str] = None
    containment_actions: Optional[str] = None
    lessons_learned: Optional[str] = None


class CreateNoteRequest(BaseModel):
    note_type: str = "note"   # note | finding | action_taken | ioc_ref
    content: str


class CreateEvidenceRequest(BaseModel):
    title: str
    evidence_type: str = "note"  # log_snippet | ioc_ref | artifact | network_capture | command_output | note
    content: Optional[str] = None


class CreateIncidentRequest(BaseModel):
    title: str
    description: Optional[str] = None
    severity: str = "Medium"

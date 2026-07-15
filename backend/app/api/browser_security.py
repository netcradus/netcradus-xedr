"""Browser Security API endpoints."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List

from app.core.dependencies import get_db, get_current_user
from app.models.user import User
from app.services import browser_security_service as svc

router = APIRouter(prefix="/browser-security", tags=["Browser Security"])


# ---------------------------------------------------------------------------
# Agent ingest schema
# ---------------------------------------------------------------------------

class BrowserEventItem(BaseModel):
    event_type:     str
    severity:       str
    title:          str
    browser:        Optional[str] = None
    description:    Optional[str] = None
    url:            Optional[str] = None
    extension_id:   Optional[str] = None
    extension_name: Optional[str] = None
    file_name:      Optional[str] = None
    file_path:      Optional[str] = None
    sha256:         Optional[str] = None
    username:       Optional[str] = None


class BrowserEventsRequest(BaseModel):
    agent_token: str
    events:      List[BrowserEventItem]


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@router.post("/events/ingest")
def ingest_events(payload: BrowserEventsRequest, db: Session = Depends(get_db)):
    """Agent posts browser security events (no JWT — agent_token auth)."""
    result = svc.submit_events(db, payload.agent_token, [e.model_dump() for e in payload.events])
    if "error" in result:
        raise HTTPException(status_code=401, detail=result["error"])
    return result


@router.get("/dashboard")
def dashboard(
    current_user: User    = Depends(get_current_user),
    db: Session           = Depends(get_db),
):
    return svc.get_dashboard(db, current_user.tenant_id)


@router.get("/events")
def list_events(
    event_type:   Optional[str] = None,
    severity:     Optional[str] = None,
    status:       Optional[str] = None,
    browser:      Optional[str] = None,
    limit:        int           = 100,
    current_user: User          = Depends(get_current_user),
    db: Session                 = Depends(get_db),
):
    return svc.list_events(db, current_user.tenant_id, event_type, severity, status, browser, limit)


@router.patch("/events/{event_id}")
def update_status(
    event_id:     int,
    body:         dict,
    current_user: User   = Depends(get_current_user),
    db: Session          = Depends(get_db),
):
    status = body.get("status")
    if not status:
        raise HTTPException(status_code=422, detail="status required")
    result = svc.update_event_status(db, current_user.tenant_id, event_id, status)
    if not result:
        raise HTTPException(status_code=404, detail="Event not found")
    return result

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.permissions import admin_required, analyst_required
from app.database.db import get_db
from app.models.ioc import IOC
from app.models.user import User
from app.services.enrichment_service import (
    enrich_ioc_background,
    get_or_create_config,
    lookup_ioc,
)

router = APIRouter(prefix="/threat-feeds", tags=["Threat Feeds"])

_MASK = "••••••••"


def _config_response(config) -> "FeedConfigResponse":
    return FeedConfigResponse(
        virustotal_api_key=_MASK if config.virustotal_api_key else None,
        abuseipdb_api_key =_MASK if config.abuseipdb_api_key  else None,
        otx_api_key       =_MASK if config.otx_api_key         else None,
        has_virustotal    =bool(config.virustotal_api_key),
        has_abuseipdb     =bool(config.abuseipdb_api_key),
        has_otx           =bool(config.otx_api_key),
    )


# ── Schemas ───────────────────────────────────────────────────────────────────

class FeedConfigResponse(BaseModel):
    virustotal_api_key: Optional[str] = None
    abuseipdb_api_key:  Optional[str] = None
    otx_api_key:        Optional[str] = None
    has_virustotal: bool = False
    has_abuseipdb:  bool = False
    has_otx:        bool = False


class UpdateFeedConfigRequest(BaseModel):
    virustotal_api_key: Optional[str] = None
    abuseipdb_api_key:  Optional[str] = None
    otx_api_key:        Optional[str] = None


class LookupRequest(BaseModel):
    ioc_type: str
    value: str


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/config", response_model=FeedConfigResponse)
def get_feed_config(
        current_user: User = Depends(admin_required),
        db: Session = Depends(get_db)):
    config = get_or_create_config(db, current_user.tenant_id)
    return _config_response(config)


@router.put("/config", response_model=FeedConfigResponse)
def update_feed_config(
        request: UpdateFeedConfigRequest,
        current_user: User = Depends(admin_required),
        db: Session = Depends(get_db)):
    config = get_or_create_config(db, current_user.tenant_id)
    if request.virustotal_api_key is not None and request.virustotal_api_key != _MASK:
        config.virustotal_api_key = request.virustotal_api_key or None
    if request.abuseipdb_api_key is not None and request.abuseipdb_api_key != _MASK:
        config.abuseipdb_api_key = request.abuseipdb_api_key or None
    if request.otx_api_key is not None and request.otx_api_key != _MASK:
        config.otx_api_key = request.otx_api_key or None
    db.commit()
    db.refresh(config)
    return _config_response(config)


@router.post("/lookup")
def manual_lookup(
        request: LookupRequest,
        current_user: User = Depends(analyst_required),
        db: Session = Depends(get_db)):
    result = lookup_ioc(db, current_user.tenant_id, request.ioc_type, request.value)
    return result


@router.post("/enrich/{ioc_id}", status_code=202)
def enrich_ioc_endpoint(
        ioc_id: int,
        current_user: User = Depends(admin_required),
        db: Session = Depends(get_db)):
    """Enqueue enrichment for a single IOC. Poll GET /tasks/{task_id} for status."""
    from app.tasks.enrichment import enrich_ioc_task
    ioc = db.query(IOC).filter(IOC.id == ioc_id).first()
    if not ioc:
        raise HTTPException(status_code=404, detail="IOC not found")
    ioc.enrichment_status = "pending"
    db.commit()
    task = enrich_ioc_task.delay(ioc_id, current_user.tenant_id)
    return {"status": "accepted", "ioc_id": ioc_id, "task_id": task.id}


@router.post("/lookup-async", status_code=202)
def lookup_async(
        request: LookupRequest,
        current_user: User = Depends(analyst_required)):
    """
    Enqueue an async IOC lookup (VT / AbuseIPDB / OTX).
    Returns 202 immediately; poll GET /tasks/{task_id} for the result.
    """
    from app.tasks.lookup import lookup_ioc_task
    task = lookup_ioc_task.delay(current_user.tenant_id, request.ioc_type, request.value)
    return {"status": "accepted", "task_id": task.id}

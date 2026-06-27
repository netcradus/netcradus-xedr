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


# ── Schemas ───────────────────────────────────────────────────────────────────

class FeedConfigResponse(BaseModel):
    virustotal_api_key: Optional[str] = None
    abuseipdb_api_key: Optional[str] = None
    has_virustotal: bool = False
    has_abuseipdb: bool = False


class UpdateFeedConfigRequest(BaseModel):
    virustotal_api_key: Optional[str] = None
    abuseipdb_api_key: Optional[str] = None


class LookupRequest(BaseModel):
    ioc_type: str
    value: str


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/config", response_model=FeedConfigResponse)
def get_feed_config(
        current_user: User = Depends(admin_required),
        db: Session = Depends(get_db)):
    config = get_or_create_config(db, current_user.tenant_id)
    return FeedConfigResponse(
        virustotal_api_key=_MASK if config.virustotal_api_key else None,
        abuseipdb_api_key=_MASK if config.abuseipdb_api_key else None,
        has_virustotal=bool(config.virustotal_api_key),
        has_abuseipdb=bool(config.abuseipdb_api_key),
    )


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
    db.commit()
    db.refresh(config)
    return FeedConfigResponse(
        virustotal_api_key=_MASK if config.virustotal_api_key else None,
        abuseipdb_api_key=_MASK if config.abuseipdb_api_key else None,
        has_virustotal=bool(config.virustotal_api_key),
        has_abuseipdb=bool(config.abuseipdb_api_key),
    )


@router.post("/lookup")
def manual_lookup(
        request: LookupRequest,
        current_user: User = Depends(analyst_required),
        db: Session = Depends(get_db)):
    result = lookup_ioc(db, current_user.tenant_id, request.ioc_type, request.value)
    return result


@router.post("/enrich/{ioc_id}")
def enrich_ioc_endpoint(
        ioc_id: int,
        current_user: User = Depends(admin_required),
        db: Session = Depends(get_db)):
    ioc = db.query(IOC).filter(IOC.id == ioc_id).first()
    if not ioc:
        raise HTTPException(status_code=404, detail="IOC not found")
    ioc.enrichment_status = "pending"
    db.commit()
    enrich_ioc_background(ioc_id, current_user.tenant_id)
    return {"status": "queued", "ioc_id": ioc_id}

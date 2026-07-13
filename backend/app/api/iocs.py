import json

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.permissions import admin_required, analyst_required
from app.database.db import get_db
from app.models.user import User
from app.schemas.ioc_schema import (
    CreateIOCRequest,
    IOCResponse,
    UpdateIOCRequest,
    normalize_ioc_type
)
from app.services.ioc_service import (
    create_ioc,
    delete_ioc,
    get_ioc,
    list_iocs,
    search_ioc,
    update_ioc
)
from app.services.enrichment_service import enrich_ioc_background
from app.tasks.enrichment import sync_iocs_task

router = APIRouter(
    prefix="/iocs",
    tags=["IOCs"]
)


@router.post(
    "",
    response_model=IOCResponse,
    status_code=status.HTTP_201_CREATED
)
def create_ioc_endpoint(
        request: CreateIOCRequest,
        current_user: User = Depends(admin_required),
        db: Session = Depends(get_db)):

    try:

        ioc = create_ioc(
            db,
            request,
            current_user.email,
            current_user.tenant_id,
        )

        enrich_ioc_background(ioc.id, current_user.tenant_id)

        return ioc

    except IntegrityError:

        db.rollback()

        raise HTTPException(
            status_code=409,
            detail="IOC value already exists"
        )


@router.get(
    "",
    response_model=list[IOCResponse]
)
def list_iocs_endpoint(
        ioc_type: str = Query(default=None),
        search: str = Query(default=None),
        active_only: bool = Query(default=False),
        current_user: User = Depends(analyst_required),
        db: Session = Depends(get_db)):

    if search:

        return search_ioc(
            db,
            current_user.tenant_id,
            search,
        )

    if ioc_type:

        try:

            ioc_type = normalize_ioc_type(ioc_type)

        except ValueError:

            raise HTTPException(
                status_code=422,
                detail="Invalid IOC type"
            )

    return list_iocs(
        db,
        current_user.tenant_id,
        ioc_type,
        active_only,
    )


@router.get(
    "/{ioc_id}",
    response_model=IOCResponse
)
def get_ioc_endpoint(
        ioc_id: int,
        current_user: User = Depends(analyst_required),
        db: Session = Depends(get_db)):

    ioc = get_ioc(db, ioc_id, current_user.tenant_id)

    if not ioc:

        raise HTTPException(
            status_code=404,
            detail="IOC not found"
        )

    return ioc


@router.put(
    "/{ioc_id}",
    response_model=IOCResponse
)
def update_ioc_endpoint(
        ioc_id: int,
        request: UpdateIOCRequest,
        current_user: User = Depends(admin_required),
        db: Session = Depends(get_db)):

    try:

        ioc = update_ioc(
            db,
            ioc_id,
            request,
            current_user.tenant_id,
        )

    except IntegrityError:

        db.rollback()

        raise HTTPException(
            status_code=409,
            detail="IOC value already exists"
        )

    if not ioc:

        raise HTTPException(
            status_code=404,
            detail="IOC not found"
        )

    return ioc


@router.get("/{ioc_id}/enrichment")
def get_ioc_enrichment(
        ioc_id: int,
        current_user: User = Depends(analyst_required),
        db: Session = Depends(get_db)):
    """
    Return the full threat intelligence profile for an IOC.

    Combines data from all enrichment feeds (VirusTotal, AbuseIPDB, AlienVault OTX,
    URLHaus, MalwareBazaar, OpenPhish) into a structured threat profile with a
    composite threat score (0-100) and a human-readable verdict.
    """
    ioc = get_ioc(db, ioc_id, current_user.tenant_id)
    if not ioc:
        raise HTTPException(status_code=404, detail="IOC not found")

    feeds = []
    if ioc.enrichment_data:
        try:
            feeds = json.loads(ioc.enrichment_data)
        except Exception:
            feeds = []

    return {
        "ioc_id":           ioc.id,
        "type":             ioc.type,
        "value":            ioc.value,
        "enrichment_status": ioc.enrichment_status,
        "threat_score":     ioc.threat_score,
        "threat_verdict":   ioc.threat_verdict,
        "malware_family":   ioc.malware_family,
        "first_seen_date":  ioc.first_seen_date.isoformat() if ioc.first_seen_date else None,
        "last_seen_date":   ioc.last_seen_date.isoformat() if ioc.last_seen_date else None,
        "vt_score":         ioc.vt_score,
        "feeds":            feeds,
    }


@router.post("/{ioc_id}/re-enrich", status_code=202)
def re_enrich_ioc(
        ioc_id: int,
        current_user: User = Depends(analyst_required),
        db: Session = Depends(get_db)):
    """Force re-enrichment of a single IOC against all configured threat feeds."""
    from app.models.ioc import IOC as IOCModel
    ioc = db.query(IOCModel).filter(
        IOCModel.id == ioc_id,
        IOCModel.tenant_id == current_user.tenant_id,
    ).first()
    if not ioc:
        raise HTTPException(status_code=404, detail="IOC not found")
    ioc.enrichment_status = "pending"
    db.commit()
    enrich_ioc_background(ioc.id, current_user.tenant_id)
    return {"status": "accepted", "ioc_id": ioc_id}


@router.post("/sync", status_code=202)
def sync_iocs_endpoint(
        current_user: User = Depends(admin_required),
        db: Session = Depends(get_db)):
    """
    Enqueue a background task to enrich all un-enriched IOCs for this tenant.
    Returns 202 immediately; poll GET /tasks/{task_id} to check progress.
    """
    task = sync_iocs_task.delay(current_user.tenant_id)
    return {"status": "accepted", "task_id": task.id, "tenant_id": current_user.tenant_id}


@router.delete(
    "/{ioc_id}",
    status_code=status.HTTP_204_NO_CONTENT
)
def delete_ioc_endpoint(
        ioc_id: int,
        current_user: User = Depends(admin_required),
        db: Session = Depends(get_db)):

    deleted = delete_ioc(db, ioc_id, current_user.tenant_id)

    if not deleted:

        raise HTTPException(
            status_code=404,
            detail="IOC not found"
        )

    return None

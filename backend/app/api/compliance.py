from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import Optional

from app.core.dependencies import get_db, get_current_user
from app.models.user import User
from app.services.compliance_service import (
    get_dashboard,
    update_assessment,
    add_evidence,
    list_evidence,
)
from app.models.compliance_control import ComplianceControl

router = APIRouter(prefix="/compliance", tags=["Compliance"])


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class AssessmentUpdate(BaseModel):
    status: str          # compliant | partial | non_compliant | not_applicable
    notes:  Optional[str] = None


class EvidenceCreate(BaseModel):
    title:         str
    description:   Optional[str] = None
    evidence_type: str = "document"


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@router.get("/dashboard")
def compliance_dashboard(
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
):
    return get_dashboard(db, current_user.tenant_id)


@router.patch("/controls/{control_id}/assessment")
def patch_assessment(
    control_id: int,
    body:         AssessmentUpdate,
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
):
    allowed = {"compliant", "partial", "non_compliant", "not_applicable"}
    if body.status not in allowed:
        raise HTTPException(400, f"status must be one of: {', '.join(sorted(allowed))}")

    ctrl = db.query(ComplianceControl).filter_by(id=control_id).first()
    if not ctrl:
        raise HTTPException(404, "Control not found")

    a = update_assessment(db, current_user.tenant_id, control_id, body.status, body.notes)
    return {
        "control_id": a.control_id,
        "tenant_id":  a.tenant_id,
        "status":     a.status,
        "notes":      a.notes,
        "updated_at": a.updated_at,
    }


@router.post("/controls/{control_id}/evidence")
def create_evidence(
    control_id: int,
    body:         EvidenceCreate,
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
):
    ctrl = db.query(ComplianceControl).filter_by(id=control_id).first()
    if not ctrl:
        raise HTTPException(404, "Control not found")

    ev = add_evidence(
        db,
        current_user.tenant_id,
        control_id,
        body.title,
        body.description,
        body.evidence_type,
        current_user.id,
    )
    return {
        "id":            ev.id,
        "control_id":    ev.control_id,
        "title":         ev.title,
        "description":   ev.description,
        "evidence_type": ev.evidence_type,
        "created_at":    ev.created_at,
    }


@router.get("/controls/{control_id}/evidence")
def get_evidence(
    control_id: int,
    db:           Session = Depends(get_db),
    current_user: User    = Depends(get_current_user),
):
    ctrl = db.query(ComplianceControl).filter_by(id=control_id).first()
    if not ctrl:
        raise HTTPException(404, "Control not found")

    items = list_evidence(db, current_user.tenant_id, control_id)
    return [
        {
            "id":            e.id,
            "title":         e.title,
            "description":   e.description,
            "evidence_type": e.evidence_type,
            "created_at":    e.created_at,
        }
        for e in items
    ]

"""
Sigma rule management and conversion API.

POST /sigma-rules/upload     — store raw Sigma YAML
POST /sigma-rules/{id}/convert — convert stored Sigma rule → detection rule
GET  /sigma-rules/           — list
DELETE /sigma-rules/{id}     — delete
"""
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.permissions import analyst_required, admin_required
from app.database.db import get_db
from app.models.detection_rule import DetectionRule
from app.models.detection_rule_condition import DetectionRuleCondition
from app.models.sigma_rule import SigmaRule
from app.models.user import User
from app.services.audit_service import log_event
from app.services.rule_engine import invalidate_rule_cache
from app.services.sigma_converter import convert_sigma_yaml

router = APIRouter(prefix="/sigma-rules", tags=["Sigma Rules"])


class SigmaUploadPayload(BaseModel):
    yaml_content: str
    enabled:      bool = True


def _to_dict(r: SigmaRule) -> dict:
    return {
        "id": r.id, "title": r.title, "sigma_id": r.sigma_id,
        "status": r.status, "author": r.author,
        "description": r.description,
        "detection_rule_id": r.detection_rule_id,
        "conversion_error": r.conversion_error,
        "enabled": r.enabled, "tenant_id": r.tenant_id,
        "created_at": r.created_at.isoformat() if r.created_at else None,
    }


def _get_or_404(db: Session, rule_id: int, tenant_id: int) -> SigmaRule:
    rule = db.query(SigmaRule).filter(
        SigmaRule.id == rule_id,
        SigmaRule.tenant_id == tenant_id,
    ).first()
    if not rule:
        raise HTTPException(status_code=404, detail="Sigma rule not found")
    return rule


@router.get("/")
def list_sigma_rules(
    current_user: User = Depends(analyst_required),
    db: Session = Depends(get_db),
):
    rules = db.query(SigmaRule).filter(
        SigmaRule.tenant_id == current_user.tenant_id
    ).order_by(SigmaRule.created_at.desc()).all()
    return [_to_dict(r) for r in rules]


@router.post("/upload", status_code=201)
def upload_sigma_rule(
    payload: SigmaUploadPayload,
    current_user: User = Depends(admin_required),
    db: Session = Depends(get_db),
):
    """Store a Sigma rule YAML and attempt automatic conversion."""
    # Try to parse at least the title / id before storing
    try:
        import yaml
        doc = yaml.safe_load(payload.yaml_content)
        title   = doc.get("title", "Untitled Sigma Rule") if isinstance(doc, dict) else "Untitled"
        sigma_id= doc.get("id", "") if isinstance(doc, dict) else ""
        status  = doc.get("status", "") if isinstance(doc, dict) else ""
        author  = doc.get("author", "") if isinstance(doc, dict) else ""
        desc    = doc.get("description", "") if isinstance(doc, dict) else ""
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"YAML parse error: {exc}")

    sigma_rule = SigmaRule(
        title=title,
        sigma_id=sigma_id,
        status=status,
        author=author,
        description=desc,
        yaml_content=payload.yaml_content,
        enabled=payload.enabled,
        tenant_id=current_user.tenant_id,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    db.add(sigma_rule)
    db.flush()

    # Auto-convert on upload
    _attempt_conversion(db, sigma_rule, current_user)

    db.commit()
    db.refresh(sigma_rule)
    log_event(db, current_user.tenant_id, "SIGMA_RULE_UPLOADED",
              user_id=current_user.id, user_name=current_user.name,
              resource_type="sigma_rule", resource_id=sigma_rule.id,
              details=f"Uploaded Sigma rule '{sigma_rule.title}'")
    return _to_dict(sigma_rule)


@router.post("/{rule_id}/convert")
def convert_sigma_rule(
    rule_id: int,
    current_user: User = Depends(admin_required),
    db: Session = Depends(get_db),
):
    """(Re-)convert a stored Sigma rule into a detection rule."""
    sigma_rule = _get_or_404(db, rule_id, current_user.tenant_id)
    _attempt_conversion(db, sigma_rule, current_user)
    db.commit()
    db.refresh(sigma_rule)
    if sigma_rule.conversion_error:
        return {"success": False, "error": sigma_rule.conversion_error}
    return {"success": True, "detection_rule_id": sigma_rule.detection_rule_id}


@router.delete("/{rule_id}", status_code=204)
def delete_sigma_rule(
    rule_id: int,
    current_user: User = Depends(admin_required),
    db: Session = Depends(get_db),
):
    sigma_rule = _get_or_404(db, rule_id, current_user.tenant_id)
    db.delete(sigma_rule)
    db.commit()
    log_event(db, current_user.tenant_id, "SIGMA_RULE_DELETED",
              user_id=current_user.id, user_name=current_user.name,
              resource_type="sigma_rule", resource_id=rule_id,
              details=f"Deleted Sigma rule '{sigma_rule.title}'")


# ── Internal helper ───────────────────────────────────────────────────────────

def _attempt_conversion(db: Session, sigma_rule: SigmaRule, current_user):
    """Convert sigma_rule.yaml_content → detection rule in-place (no commit)."""
    try:
        converted = convert_sigma_yaml(sigma_rule.yaml_content)
    except ValueError as exc:
        sigma_rule.conversion_error = str(exc)
        sigma_rule.updated_at = datetime.utcnow()
        return

    # Delete previously generated detection rule if re-converting
    if sigma_rule.detection_rule_id:
        old = db.query(DetectionRule).filter(
            DetectionRule.id == sigma_rule.detection_rule_id
        ).first()
        if old and not old.is_system:
            db.delete(old)
            db.flush()

    dr = DetectionRule(
        name=converted["name"],
        description=converted.get("description", ""),
        rule_type=converted["rule_type"],
        logic=converted["logic"],
        severity=converted["severity"],
        mitre_tactic=converted.get("mitre_tactic"),
        mitre_technique=converted.get("mitre_technique"),
        enabled=sigma_rule.enabled,
        tenant_id=current_user.tenant_id,
        is_system=False,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    db.add(dr)
    db.flush()
    for i, cond in enumerate(converted["conditions"]):
        db.add(DetectionRuleCondition(
            rule_id=dr.id,
            field=cond["field"],
            operator=cond["operator"],
            value=cond["value"],
            sort_order=i,
        ))
    db.flush()

    sigma_rule.detection_rule_id = dr.id
    sigma_rule.conversion_error  = None
    sigma_rule.updated_at        = datetime.utcnow()
    invalidate_rule_cache(current_user.tenant_id)

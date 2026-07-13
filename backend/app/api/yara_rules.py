"""
CRUD API for YARA rules.  Analysts can list; Admins can create/update/delete.
"""
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.permissions import analyst_required, admin_required
from app.database.db import get_db
from app.models.user import User
from app.models.yara_rule import YaraRule
from app.services.audit_service import log_event
from app.services.yara_service import invalidate_yara_cache, validate_rule_content

router = APIRouter(prefix="/yara-rules", tags=["YARA Rules"])

VALID_SEVERITIES = {"Low", "Medium", "High", "Critical"}


class YaraRulePayload(BaseModel):
    name:            str
    description:     Optional[str] = None
    tags:            Optional[str] = None
    content:         str
    severity:        str = "High"
    mitre_tactic:    Optional[str] = None
    mitre_technique: Optional[str] = None
    enabled:         bool = True


class YaraRuleUpdate(BaseModel):
    name:            Optional[str] = None
    description:     Optional[str] = None
    tags:            Optional[str] = None
    content:         Optional[str] = None
    severity:        Optional[str] = None
    mitre_tactic:    Optional[str] = None
    mitre_technique: Optional[str] = None
    enabled:         Optional[bool] = None


def _to_dict(r: YaraRule) -> dict:
    return {
        "id": r.id, "name": r.name, "description": r.description,
        "tags": r.tags, "severity": r.severity,
        "mitre_tactic": r.mitre_tactic, "mitre_technique": r.mitre_technique,
        "enabled": r.enabled, "is_system": r.is_system,
        "tenant_id": r.tenant_id,
        "created_at": r.created_at.isoformat() if r.created_at else None,
        "updated_at": r.updated_at.isoformat() if r.updated_at else None,
        # Don't send raw YARA content in list view for brevity
    }


def _to_dict_full(r: YaraRule) -> dict:
    d = _to_dict(r)
    d["content"] = r.content
    return d


def _get_or_404(db: Session, rule_id: int, tenant_id: int) -> YaraRule:
    rule = db.query(YaraRule).filter(
        YaraRule.id == rule_id,
        (YaraRule.tenant_id == tenant_id) | (YaraRule.tenant_id.is_(None)),
    ).first()
    if not rule:
        raise HTTPException(status_code=404, detail="YARA rule not found")
    return rule


@router.get("/")
def list_yara_rules(
    current_user: User = Depends(analyst_required),
    db: Session = Depends(get_db),
):
    rules = db.query(YaraRule).filter(
        (YaraRule.tenant_id == current_user.tenant_id) | (YaraRule.tenant_id.is_(None))
    ).order_by(YaraRule.is_system.desc(), YaraRule.created_at.desc()).all()
    return [_to_dict(r) for r in rules]


@router.get("/{rule_id}")
def get_yara_rule(
    rule_id: int,
    current_user: User = Depends(analyst_required),
    db: Session = Depends(get_db),
):
    return _to_dict_full(_get_or_404(db, rule_id, current_user.tenant_id))


@router.post("/", status_code=201)
def create_yara_rule(
    payload: YaraRulePayload,
    current_user: User = Depends(admin_required),
    db: Session = Depends(get_db),
):
    if payload.severity not in VALID_SEVERITIES:
        raise HTTPException(status_code=422, detail="Invalid severity")
    err = validate_rule_content(payload.content)
    if err:
        raise HTTPException(status_code=422, detail=f"Invalid YARA syntax: {err}")

    rule = YaraRule(
        name=payload.name,
        description=payload.description,
        tags=payload.tags,
        content=payload.content,
        severity=payload.severity,
        mitre_tactic=payload.mitre_tactic,
        mitre_technique=payload.mitre_technique,
        enabled=payload.enabled,
        is_system=False,
        tenant_id=current_user.tenant_id,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    db.add(rule)
    db.commit()
    db.refresh(rule)
    invalidate_yara_cache(current_user.tenant_id)
    log_event(db, current_user.tenant_id, "YARA_RULE_CREATED",
              user_id=current_user.id, user_name=current_user.name,
              resource_type="yara_rule", resource_id=rule.id,
              details=f"Created YARA rule '{rule.name}'")
    return _to_dict_full(rule)


@router.put("/{rule_id}")
def update_yara_rule(
    rule_id: int,
    payload: YaraRuleUpdate,
    current_user: User = Depends(admin_required),
    db: Session = Depends(get_db),
):
    rule = _get_or_404(db, rule_id, current_user.tenant_id)
    if rule.is_system:
        if payload.enabled is not None:
            rule.enabled = payload.enabled
            rule.updated_at = datetime.utcnow()
            db.commit()
            invalidate_yara_cache(current_user.tenant_id)
        return _to_dict_full(rule)

    if payload.content is not None:
        err = validate_rule_content(payload.content)
        if err:
            raise HTTPException(status_code=422, detail=f"Invalid YARA syntax: {err}")
    if payload.severity is not None and payload.severity not in VALID_SEVERITIES:
        raise HTTPException(status_code=422, detail="Invalid severity")

    for attr in ("name", "description", "tags", "content", "severity",
                 "mitre_tactic", "mitre_technique", "enabled"):
        v = getattr(payload, attr)
        if v is not None:
            setattr(rule, attr, v)
    rule.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(rule)
    invalidate_yara_cache(current_user.tenant_id)
    log_event(db, current_user.tenant_id, "YARA_RULE_UPDATED",
              user_id=current_user.id, user_name=current_user.name,
              resource_type="yara_rule", resource_id=rule.id,
              details=f"Updated YARA rule '{rule.name}'")
    return _to_dict_full(rule)


@router.delete("/{rule_id}", status_code=204)
def delete_yara_rule(
    rule_id: int,
    current_user: User = Depends(admin_required),
    db: Session = Depends(get_db),
):
    rule = _get_or_404(db, rule_id, current_user.tenant_id)
    if rule.is_system:
        raise HTTPException(status_code=403, detail="System YARA rules cannot be deleted")
    name = rule.name
    db.delete(rule)
    db.commit()
    invalidate_yara_cache(current_user.tenant_id)
    log_event(db, current_user.tenant_id, "YARA_RULE_DELETED",
              user_id=current_user.id, user_name=current_user.name,
              resource_type="yara_rule", resource_id=rule_id,
              details=f"Deleted YARA rule '{name}'")


@router.post("/validate")
def validate_yara(payload: dict, current_user: User = Depends(analyst_required)):
    """Validate YARA rule syntax without saving it."""
    content = payload.get("content", "")
    err = validate_rule_content(content)
    return {"valid": err is None, "error": err}

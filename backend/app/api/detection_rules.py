from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.permissions import analyst_required, admin_required
from app.database.db import get_db
from app.models.detection_rule import DetectionRule
from app.models.user import User

router = APIRouter(prefix="/detection-rules", tags=["Detection Rules"])

VALID_RULE_TYPES = {"process", "network", "file", "persistence"}
VALID_OPERATORS  = {
    "contains", "not_contains", "equals", "not_equals",
    "starts_with", "ends_with", "regex", "in_list",
    "greater_than", "less_than",
}
VALID_SEVERITIES = {"Low", "Medium", "High", "Critical"}

# ── Pydantic schemas ──────────────────────────────────────────────────────────

class RulePayload(BaseModel):
    name:            str
    description:     Optional[str] = None
    rule_type:       str
    field:           str
    operator:        str
    value:           str
    severity:        str = "Medium"
    mitre_tactic:    Optional[str] = None
    mitre_technique: Optional[str] = None
    enabled:         bool = True


class RuleUpdate(BaseModel):
    name:            Optional[str] = None
    description:     Optional[str] = None
    rule_type:       Optional[str] = None
    field:           Optional[str] = None
    operator:        Optional[str] = None
    value:           Optional[str] = None
    severity:        Optional[str] = None
    mitre_tactic:    Optional[str] = None
    mitre_technique: Optional[str] = None
    enabled:         Optional[bool] = None


# ── Helpers ───────────────────────────────────────────────────────────────────

def _rule_to_dict(r: DetectionRule) -> dict:
    return {
        "id":              r.id,
        "name":            r.name,
        "description":     r.description,
        "rule_type":       r.rule_type,
        "field":           r.field,
        "operator":        r.operator,
        "value":           r.value,
        "severity":        r.severity,
        "mitre_tactic":    r.mitre_tactic,
        "mitre_technique": r.mitre_technique,
        "enabled":         r.enabled,
        "is_system":       r.is_system,
        "tenant_id":       r.tenant_id,
        "created_at":      r.created_at.isoformat() if r.created_at else None,
        "updated_at":      r.updated_at.isoformat() if r.updated_at else None,
    }


def _get_rule_or_404(db: Session, rule_id: int, tenant_id: int) -> DetectionRule:
    rule = (
        db.query(DetectionRule)
        .filter(
            DetectionRule.id == rule_id,
            (DetectionRule.tenant_id == tenant_id) | (DetectionRule.tenant_id.is_(None)),
        )
        .first()
    )
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")
    return rule


# ── Routes ────────────────────────────────────────────────────────────────────

@router.get("/")
def list_rules(
    current_user: User = Depends(analyst_required),
    db: Session = Depends(get_db),
):
    """List all detection rules visible to this tenant (own + global system rules)."""
    rules = (
        db.query(DetectionRule)
        .filter(
            (DetectionRule.tenant_id == current_user.tenant_id)
            | (DetectionRule.tenant_id.is_(None))
        )
        .order_by(DetectionRule.is_system.desc(), DetectionRule.created_at.desc())
        .all()
    )
    return [_rule_to_dict(r) for r in rules]


@router.post("/", status_code=201)
def create_rule(
    payload: RulePayload,
    current_user: User = Depends(admin_required),
    db: Session = Depends(get_db),
):
    """Create a new detection rule scoped to the current tenant."""
    if payload.rule_type not in VALID_RULE_TYPES:
        raise HTTPException(status_code=422, detail=f"rule_type must be one of {sorted(VALID_RULE_TYPES)}")
    if payload.operator not in VALID_OPERATORS:
        raise HTTPException(status_code=422, detail=f"operator must be one of {sorted(VALID_OPERATORS)}")
    if payload.severity not in VALID_SEVERITIES:
        raise HTTPException(status_code=422, detail=f"severity must be one of {sorted(VALID_SEVERITIES)}")

    rule = DetectionRule(
        name=payload.name,
        description=payload.description,
        rule_type=payload.rule_type,
        field=payload.field,
        operator=payload.operator,
        value=payload.value,
        severity=payload.severity,
        mitre_tactic=payload.mitre_tactic,
        mitre_technique=payload.mitre_technique,
        enabled=payload.enabled,
        tenant_id=current_user.tenant_id,
        is_system=False,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    db.add(rule)
    db.commit()
    db.refresh(rule)
    return _rule_to_dict(rule)


@router.put("/{rule_id}")
def update_rule(
    rule_id: int,
    payload: RuleUpdate,
    current_user: User = Depends(admin_required),
    db: Session = Depends(get_db),
):
    """Update a detection rule. System rules can only have their enabled state changed."""
    rule = _get_rule_or_404(db, rule_id, current_user.tenant_id)

    if rule.is_system:
        # Allow toggling enabled only; other fields are read-only for system rules
        if payload.enabled is not None:
            rule.enabled = payload.enabled
            rule.updated_at = datetime.utcnow()
            db.commit()
        return _rule_to_dict(rule)

    # Tenant-owned rule — validate and update any provided fields
    if payload.rule_type is not None:
        if payload.rule_type not in VALID_RULE_TYPES:
            raise HTTPException(status_code=422, detail="Invalid rule_type")
        rule.rule_type = payload.rule_type
    if payload.operator is not None:
        if payload.operator not in VALID_OPERATORS:
            raise HTTPException(status_code=422, detail="Invalid operator")
        rule.operator = payload.operator
    if payload.severity is not None:
        if payload.severity not in VALID_SEVERITIES:
            raise HTTPException(status_code=422, detail="Invalid severity")
        rule.severity = payload.severity

    for attr in ("name", "description", "field", "value", "mitre_tactic", "mitre_technique", "enabled"):
        v = getattr(payload, attr)
        if v is not None:
            setattr(rule, attr, v)

    rule.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(rule)
    return _rule_to_dict(rule)


@router.patch("/{rule_id}/toggle")
def toggle_rule(
    rule_id: int,
    current_user: User = Depends(admin_required),
    db: Session = Depends(get_db),
):
    """Flip the enabled state of a detection rule."""
    rule = _get_rule_or_404(db, rule_id, current_user.tenant_id)
    rule.enabled = not rule.enabled
    rule.updated_at = datetime.utcnow()
    db.commit()
    return {"id": rule.id, "enabled": rule.enabled}


@router.delete("/{rule_id}", status_code=204)
def delete_rule(
    rule_id: int,
    current_user: User = Depends(admin_required),
    db: Session = Depends(get_db),
):
    """Delete a detection rule. System rules cannot be deleted."""
    rule = _get_rule_or_404(db, rule_id, current_user.tenant_id)
    if rule.is_system:
        raise HTTPException(status_code=403, detail="System rules cannot be deleted — disable them instead")
    db.delete(rule)
    db.commit()

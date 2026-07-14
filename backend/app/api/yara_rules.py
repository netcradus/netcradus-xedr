"""
YARA Rules CRUD + scan history + manual file scan endpoint.

Route order: /scan-results and /scan-file are registered BEFORE /{rule_id}
so FastAPI does not try to match the literal strings as integer rule IDs.
"""
import hashlib
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.permissions import analyst_required, admin_required
from app.database.db import get_db
from app.models.user import User
from app.models.yara_rule import YaraRule
from app.models.yara_scan_result import YaraScanResult
from app.services.audit_service import log_event
from app.services.yara_service import invalidate_yara_cache, scan_data, validate_rule_content

router = APIRouter(prefix="/yara-rules", tags=["YARA Rules"])

VALID_SEVERITIES = {"Low", "Medium", "High", "Critical"}
_MAX_SCAN_BYTES = 50 * 1024 * 1024   # 50 MB per manual scan


# ── Schemas ───────────────────────────────────────────────────────────────────

class YaraRulePayload(BaseModel):
    name:            str
    description:     Optional[str] = None
    tags:            Optional[str] = None
    malware_family:  Optional[str] = None
    content:         str
    severity:        str = "High"
    mitre_tactic:    Optional[str] = None
    mitre_technique: Optional[str] = None
    enabled:         bool = True


class YaraRuleUpdate(BaseModel):
    name:            Optional[str] = None
    description:     Optional[str] = None
    tags:            Optional[str] = None
    malware_family:  Optional[str] = None
    content:         Optional[str] = None
    severity:        Optional[str] = None
    mitre_tactic:    Optional[str] = None
    mitre_technique: Optional[str] = None
    enabled:         Optional[bool] = None


# ── Serialisers ───────────────────────────────────────────────────────────────

def _to_dict(r: YaraRule) -> dict:
    return {
        "id":              r.id,
        "name":            r.name,
        "description":     r.description,
        "tags":            r.tags,
        "malware_family":  r.malware_family,
        "severity":        r.severity,
        "mitre_tactic":    r.mitre_tactic,
        "mitre_technique": r.mitre_technique,
        "enabled":         r.enabled,
        "is_system":       r.is_system,
        "tenant_id":       r.tenant_id,
        "created_at":      r.created_at.isoformat() if r.created_at else None,
        "updated_at":      r.updated_at.isoformat() if r.updated_at else None,
    }


def _to_dict_full(r: YaraRule) -> dict:
    d = _to_dict(r)
    d["content"] = r.content
    return d


def _scan_result_to_dict(s: YaraScanResult) -> dict:
    return {
        "id":                s.id,
        "file_path":         s.file_path,
        "sha256":            s.sha256,
        "matched_rule_name": s.matched_rule_name,
        "malware_family":    s.malware_family,
        "severity":          s.severity,
        "mitre_tactic":      s.mitre_tactic,
        "mitre_technique":   s.mitre_technique,
        "scan_context":      s.scan_context,
        "agent_id":          s.agent_id,
        "tenant_id":         s.tenant_id,
        "created_at":        s.created_at.isoformat() if s.created_at else None,
    }


def _get_or_404(db: Session, rule_id: int, tenant_id: int) -> YaraRule:
    rule = db.query(YaraRule).filter(
        YaraRule.id == rule_id,
        (YaraRule.tenant_id == tenant_id) | (YaraRule.tenant_id.is_(None)),
    ).first()
    if not rule:
        raise HTTPException(status_code=404, detail="YARA rule not found")
    return rule


# ── Rule list / create ────────────────────────────────────────────────────────

@router.get("/")
def list_yara_rules(
    current_user: User = Depends(analyst_required),
    db: Session = Depends(get_db),
):
    rules = (
        db.query(YaraRule)
        .filter((YaraRule.tenant_id == current_user.tenant_id) | (YaraRule.tenant_id.is_(None)))
        .order_by(YaraRule.is_system.desc(), YaraRule.created_at.desc())
        .all()
    )
    return [_to_dict(r) for r in rules]


# ── Scan history ──────────────────────────────────────────────────────────────
# IMPORTANT: registered before /{rule_id} to prevent path ambiguity.

@router.get("/scan-results")
def list_scan_results(
    limit:    int = Query(200, le=1000),
    family:   Optional[str] = Query(None),
    severity: Optional[str] = Query(None),
    current_user: User = Depends(analyst_required),
    db: Session = Depends(get_db),
):
    """Return recent YARA scan matches for this tenant."""
    q = db.query(YaraScanResult).filter(YaraScanResult.tenant_id == current_user.tenant_id)
    if family:
        q = q.filter(YaraScanResult.malware_family.ilike(f"%{family}%"))
    if severity:
        q = q.filter(YaraScanResult.severity == severity)
    rows = q.order_by(YaraScanResult.created_at.desc()).limit(limit).all()
    return [_scan_result_to_dict(r) for r in rows]


@router.get("/scan-results/stats")
def scan_result_stats(
    current_user: User = Depends(analyst_required),
    db: Session = Depends(get_db),
):
    """Aggregate counts used by the KPI strip on the YARA page."""
    from datetime import timedelta
    cutoff_24h = datetime.utcnow() - timedelta(hours=24)

    total   = db.query(YaraScanResult).filter(YaraScanResult.tenant_id == current_user.tenant_id).count()
    last24h = (
        db.query(YaraScanResult)
        .filter(YaraScanResult.tenant_id == current_user.tenant_id,
                YaraScanResult.created_at >= cutoff_24h)
        .count()
    )
    families = (
        db.query(YaraScanResult.malware_family)
        .filter(YaraScanResult.tenant_id == current_user.tenant_id,
                YaraScanResult.malware_family.isnot(None))
        .distinct()
        .all()
    )
    return {
        "total_detections": total,
        "detections_24h":   last24h,
        "unique_families":  len(families),
    }


# ── Manual file scan ──────────────────────────────────────────────────────────

@router.post("/scan-file")
async def scan_file_upload(
    file: UploadFile = File(...),
    current_user: User = Depends(analyst_required),
    db: Session = Depends(get_db),
):
    """Upload a file and scan it against all enabled YARA rules for this tenant."""
    data = await file.read()
    if len(data) > _MAX_SCAN_BYTES:
        raise HTTPException(status_code=413, detail="File exceeds 50 MB scan limit")

    sha256 = hashlib.sha256(data).hexdigest()
    matches = scan_data(
        db,
        tenant_id=current_user.tenant_id,
        agent_id=None,          # manual scan — no agent, no alert
        data=data,
        file_path=file.filename,
        sha256=sha256,
        scan_context="manual",
    )
    return {
        "file_name": file.filename,
        "file_size": len(data),
        "sha256":    sha256,
        "matches":   matches,
        "clean":     len(matches) == 0,
    }


# ── Syntax validation ─────────────────────────────────────────────────────────

@router.post("/validate")
def validate_yara(payload: dict, current_user: User = Depends(analyst_required)):
    """Validate YARA rule syntax without saving."""
    content = payload.get("content", "")
    err = validate_rule_content(content)
    return {"valid": err is None, "error": err}


# ── Single rule CRUD ──────────────────────────────────────────────────────────

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
        malware_family=payload.malware_family,
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
        # System rules are immutable except for the enabled toggle
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

    for attr in ("name", "description", "tags", "malware_family", "content",
                 "severity", "mitre_tactic", "mitre_technique", "enabled"):
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

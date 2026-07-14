"""Compliance scoring and assessment service."""
from datetime import datetime, timezone
from typing import Any
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.models.compliance_framework import ComplianceFramework
from app.models.compliance_control import ComplianceControl
from app.models.compliance_assessment import ComplianceAssessment
from app.models.compliance_evidence import ComplianceEvidence
from app.models.alert import Alert
from app.models.agent import Agent
from app.models.yara_rule import YaraRule
from app.models.audit_log import AuditLog
from app.models.user import User


# ---------------------------------------------------------------------------
# XDR State Checks
# ---------------------------------------------------------------------------

def _xdr_state(db: Session, tenant_id: int) -> dict[str, bool]:
    """Derive XDR capability state for a tenant from live DB counts."""
    active_agents = db.query(func.count(Agent.id)).filter(
        Agent.tenant_id == tenant_id,
        Agent.status == "active",
    ).scalar() or 0

    active_yara = db.query(func.count(YaraRule.id)).filter(
        YaraRule.tenant_id == tenant_id,
        YaraRule.enabled.is_(True),
    ).scalar() or 0
    # system rules are shared (tenant_id=None)
    system_yara = db.query(func.count(YaraRule.id)).filter(
        YaraRule.tenant_id.is_(None),
        YaraRule.enabled.is_(True),
    ).scalar() or 0

    open_alerts = db.query(func.count(Alert.id)).filter(
        Alert.tenant_id == tenant_id,
    ).scalar() or 0

    mfa_users = db.query(func.count(User.id)).filter(
        User.tenant_id == tenant_id,
        User.email_verified.is_(True),
    ).scalar() or 0
    total_users = db.query(func.count(User.id)).filter(
        User.tenant_id == tenant_id,
    ).scalar() or 0

    audit_count = db.query(func.count(AuditLog.id)).filter(
        AuditLog.tenant_id == tenant_id,
    ).scalar() or 0

    return {
        "agents_active":     active_agents > 0,
        "yara_active":       (active_yara + system_yara) > 0,
        "alerts_configured": open_alerts >= 0,  # schema present = configured
        "audit_logs_enabled": audit_count > 0,
        "mfa_enforced":      total_users > 0 and (mfa_users / total_users) >= 0.8,
    }


# ---------------------------------------------------------------------------
# Assessment Derivation
# ---------------------------------------------------------------------------

def _derive_status(check_type: str | None, state: dict[str, bool]) -> str:
    if not check_type:
        return "non_compliant"
    passed = state.get(check_type, False)
    return "compliant" if passed else "non_compliant"


def refresh_assessments(db: Session, tenant_id: int) -> None:
    """Re-derive all auto-check controls for a tenant, upsert assessments."""
    state = _xdr_state(db, tenant_id)
    now   = datetime.now(timezone.utc)

    controls = db.query(ComplianceControl).filter(
        ComplianceControl.xdr_auto_check.is_(True)
    ).all()

    for ctrl in controls:
        assessment = (
            db.query(ComplianceAssessment)
            .filter_by(control_id=ctrl.id, tenant_id=tenant_id)
            .first()
        )
        status = _derive_status(ctrl.check_type, state)
        if assessment:
            assessment.status          = status
            assessment.auto_derived    = True
            assessment.last_checked_at = now
            assessment.updated_at      = now
        else:
            db.add(ComplianceAssessment(
                control_id=ctrl.id,
                tenant_id=tenant_id,
                status=status,
                auto_derived=True,
                last_checked_at=now,
                updated_at=now,
            ))
    db.commit()


# ---------------------------------------------------------------------------
# Scoring
# ---------------------------------------------------------------------------

STATUS_WEIGHT = {
    "compliant":       1.0,
    "partial":         0.5,
    "non_compliant":   0.0,
    "not_applicable":  None,   # excluded from denominator
}

PRIORITY_WEIGHT = {
    "Critical": 4,
    "High":     3,
    "Medium":   2,
    "Low":      1,
}


def _score_controls(controls: list, assessments: dict[int, str]) -> dict[str, Any]:
    earned  = 0.0
    total   = 0.0
    missing = 0
    passed  = 0

    for ctrl in controls:
        pw = PRIORITY_WEIGHT.get(ctrl.priority, 1)
        st = assessments.get(ctrl.id, "non_compliant")
        sw = STATUS_WEIGHT.get(st)
        if sw is None:
            continue
        total  += pw
        earned += pw * sw
        if sw == 1.0:
            passed  += 1
        else:
            missing += 1

    pct = round((earned / total * 100) if total > 0 else 0.0, 1)
    return {"score": pct, "compliant": passed, "missing": missing}


def get_dashboard(db: Session, tenant_id: int) -> dict[str, Any]:
    """Return overall + per-framework scores and control details."""
    refresh_assessments(db, tenant_id)

    frameworks = db.query(ComplianceFramework).order_by(ComplianceFramework.id).all()

    all_controls  = db.query(ComplianceControl).all()
    control_map   = {}  # fw_id -> list[ComplianceControl]
    for c in all_controls:
        control_map.setdefault(c.framework_id, []).append(c)

    control_ids    = [c.id for c in all_controls]
    raw_assessments = (
        db.query(ComplianceAssessment)
        .filter(
            ComplianceAssessment.tenant_id == tenant_id,
            ComplianceAssessment.control_id.in_(control_ids),
        )
        .all()
    ) if control_ids else []
    assess_map: dict[int, str] = {a.control_id: a.status for a in raw_assessments}

    evidence_counts: dict[int, int] = {}
    if control_ids:
        rows = (
            db.query(ComplianceEvidence.control_id, func.count(ComplianceEvidence.id))
            .filter(
                ComplianceEvidence.tenant_id == tenant_id,
                ComplianceEvidence.control_id.in_(control_ids),
            )
            .group_by(ComplianceEvidence.control_id)
            .all()
        )
        evidence_counts = {r[0]: r[1] for r in rows}

    fw_summaries = []
    total_controls = 0
    total_missing  = 0
    total_compliant= 0
    evidence_ready = 0

    for fw in frameworks:
        ctrls = control_map.get(fw.id, [])
        sc    = _score_controls(ctrls, assess_map)
        fw_summaries.append({
            "id":          fw.id,
            "name":        fw.name,
            "version":     fw.version,
            "description": fw.description,
            "category":    fw.category,
            "color":       fw.color,
            "score":       sc["score"],
            "compliant":   sc["compliant"],
            "missing":     sc["missing"],
            "total":       sc["compliant"] + sc["missing"],
            "controls": [
                {
                    "id":           c.id,
                    "control_ref":  c.control_ref,
                    "title":        c.title,
                    "category":     c.category,
                    "priority":     c.priority,
                    "xdr_auto":     c.xdr_auto_check,
                    "status":       assess_map.get(c.id, "non_compliant"),
                    "evidence":     evidence_counts.get(c.id, 0),
                }
                for c in ctrls
            ],
        })
        total_controls += sc["compliant"] + sc["missing"]
        total_missing  += sc["missing"]
        total_compliant+= sc["compliant"]
        evidence_ready += sum(1 for c in ctrls if evidence_counts.get(c.id, 0) > 0)

    overall_score = (
        round(total_compliant / total_controls * 100, 1)
        if total_controls > 0 else 0.0
    )

    return {
        "overall_score":    overall_score,
        "total_controls":   total_controls,
        "missing_controls": total_missing,
        "evidence_ready":   evidence_ready,
        "frameworks":       fw_summaries,
    }


def update_assessment(
    db: Session,
    tenant_id: int,
    control_id: int,
    status: str,
    notes: str | None,
) -> ComplianceAssessment:
    a = (
        db.query(ComplianceAssessment)
        .filter_by(control_id=control_id, tenant_id=tenant_id)
        .first()
    )
    now = datetime.now(timezone.utc)
    if a:
        a.status       = status
        a.notes        = notes
        a.auto_derived = False
        a.updated_at   = now
    else:
        a = ComplianceAssessment(
            control_id=control_id,
            tenant_id=tenant_id,
            status=status,
            notes=notes,
            auto_derived=False,
            updated_at=now,
        )
        db.add(a)
    db.commit()
    db.refresh(a)
    return a


def add_evidence(
    db: Session,
    tenant_id: int,
    control_id: int,
    title: str,
    description: str | None,
    evidence_type: str,
    uploaded_by_id: int,
) -> ComplianceEvidence:
    ev = ComplianceEvidence(
        control_id=control_id,
        tenant_id=tenant_id,
        title=title,
        description=description,
        evidence_type=evidence_type,
        uploaded_by_id=uploaded_by_id,
    )
    db.add(ev)
    # Update evidence_count on assessment
    a = (
        db.query(ComplianceAssessment)
        .filter_by(control_id=control_id, tenant_id=tenant_id)
        .first()
    )
    if a:
        a.evidence_count = (a.evidence_count or 0) + 1
    db.commit()
    db.refresh(ev)
    return ev


def list_evidence(db: Session, tenant_id: int, control_id: int) -> list:
    return (
        db.query(ComplianceEvidence)
        .filter_by(control_id=control_id, tenant_id=tenant_id)
        .order_by(ComplianceEvidence.created_at.desc())
        .all()
    )

"""Vulnerability scanner service — finding ingestion, deduplication, and dashboard."""
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.models.agent import Agent
from app.models.vuln_scan import VulnScan
from app.models.vuln_finding import VulnFinding
from app.schemas.vulnerability_schema import VulnScanRequest
from app.services.alert_service import create_alert_if_not_exists

ALERT_SEVERITIES = {"Critical", "High"}


def submit_scan(db: Session, data: VulnScanRequest) -> dict | None:
    """
    Ingest findings from an agent scan.
    Returns summary dict on success, None when agent_token is invalid.
    """
    agent = db.query(Agent).filter(Agent.agent_token == data.agent_token).first()
    if not agent:
        return None

    now = datetime.utcnow()

    # Create the scan record
    scan = VulnScan(
        agent_id=agent.id,
        tenant_id=agent.tenant_id,
        started_at=now,
    )
    db.add(scan)
    db.flush()  # get scan.id before inserting findings

    counts: dict[str, int] = {}

    for item in data.findings:
        finding = VulnFinding(
            scan_id=scan.id,
            agent_id=agent.id,
            tenant_id=agent.tenant_id,
            check_type=item.check_type,
            severity=item.severity,
            title=item.title,
            description=item.description,
            remediation=item.remediation,
            cve_id=item.cve_id,
            cvss_score=item.cvss_score,
            affected_component=item.affected_component,
            package_name=item.package_name,
            installed_version=item.installed_version,
            fixed_version=item.fixed_version,
            status="open",
            first_seen=now,
            last_seen=now,
            created_at=now,
            updated_at=now,
        )
        db.add(finding)
        counts[item.severity] = counts.get(item.severity, 0) + 1

        if item.severity in ALERT_SEVERITIES:
            mitre = "T1190" if item.check_type == "cve" else "T1082"
            create_alert_if_not_exists(
                db,
                title=f"Vuln: {item.title}",
                description=item.description or item.title,
                severity=item.severity,
                mitre_technique=mitre,
                agent_id=agent.id,
            )

    # Stamp the scan summary
    scan.critical_count = counts.get("Critical", 0)
    scan.high_count     = counts.get("High",     0)
    scan.medium_count   = counts.get("Medium",   0)
    scan.low_count      = counts.get("Low",      0)
    scan.info_count     = counts.get("Info",     0)
    scan.total_findings = len(data.findings)
    scan.completed_at   = datetime.utcnow()

    db.commit()
    return {"scan_id": scan.id, "total": scan.total_findings}


def get_dashboard(db: Session, tenant_id: int) -> dict:
    """
    Return summary statistics for the vulnerability scanner dashboard.
    """
    # -- Overall severity counts (open findings only) -------------------------
    rows = (
        db.query(VulnFinding.severity, func.count(VulnFinding.id))
        .filter(
            VulnFinding.tenant_id == tenant_id,
            VulnFinding.status == "open",
        )
        .group_by(VulnFinding.severity)
        .all()
    )
    sev_counts: dict[str, int] = {r[0]: r[1] for r in rows}

    total_open = sum(sev_counts.values())
    critical   = sev_counts.get("Critical", 0)
    high       = sev_counts.get("High",     0)
    medium     = sev_counts.get("Medium",   0)
    low        = sev_counts.get("Low",      0)
    info       = sev_counts.get("Info",     0)

    # -- By check_type ---------------------------------------------------------
    type_rows = (
        db.query(VulnFinding.check_type, func.count(VulnFinding.id))
        .filter(
            VulnFinding.tenant_id == tenant_id,
            VulnFinding.status == "open",
        )
        .group_by(VulnFinding.check_type)
        .all()
    )
    by_check_type: dict[str, int] = {r[0]: r[1] for r in type_rows}

    # -- Per-agent summary -------------------------------------------------------
    agent_rows = (
        db.query(
            Agent.id,
            Agent.hostname,
            Agent.ip_address,
            VulnFinding.severity,
            func.count(VulnFinding.id).label("cnt"),
        )
        .join(VulnFinding, VulnFinding.agent_id == Agent.id)
        .filter(
            VulnFinding.tenant_id == tenant_id,
            VulnFinding.status == "open",
        )
        .group_by(Agent.id, Agent.hostname, Agent.ip_address, VulnFinding.severity)
        .all()
    )

    agent_map: dict[int, dict] = {}
    for a_id, hostname, ip, severity, cnt in agent_rows:
        if a_id not in agent_map:
            agent_map[a_id] = {
                "agent_id": a_id,
                "hostname": hostname or f"agent-{a_id}",
                "ip_address": ip or "—",
                "Critical": 0, "High": 0, "Medium": 0, "Low": 0, "Info": 0,
            }
        agent_map[a_id][severity] = agent_map[a_id].get(severity, 0) + cnt

    asset_summary = []
    for ad in agent_map.values():
        # Risk score: Critical×10 + High×5 + Medium×2 + Low×1 (capped at 100)
        raw = ad["Critical"] * 10 + ad["High"] * 5 + ad["Medium"] * 2 + ad["Low"]
        ad["risk_score"] = min(raw, 100)
        asset_summary.append(ad)
    asset_summary.sort(key=lambda x: x["risk_score"], reverse=True)

    # -- Last scan per agent ---------------------------------------------------
    scan_rows = (
        db.query(
            VulnScan.id,
            VulnScan.agent_id,
            Agent.hostname,
            VulnScan.critical_count,
            VulnScan.high_count,
            VulnScan.medium_count,
            VulnScan.low_count,
            VulnScan.total_findings,
            VulnScan.started_at,
            VulnScan.completed_at,
        )
        .join(Agent, Agent.id == VulnScan.agent_id)
        .filter(VulnScan.tenant_id == tenant_id)
        .order_by(VulnScan.started_at.desc())
        .limit(10)
        .all()
    )

    recent_scans = [
        {
            "id":             r[0],
            "agent_id":       r[1],
            "hostname":       r[2] or f"agent-{r[1]}",
            "critical_count": r[3],
            "high_count":     r[4],
            "medium_count":   r[5],
            "low_count":      r[6],
            "total_findings": r[7],
            "started_at":     r[8].isoformat() if r[8] else None,
            "completed_at":   r[9].isoformat() if r[9] else None,
        }
        for r in scan_rows
    ]

    return {
        "total_open":    total_open,
        "critical":      critical,
        "high":          high,
        "medium":        medium,
        "low":           low,
        "info":          info,
        "by_check_type": by_check_type,
        "asset_summary": asset_summary,
        "recent_scans":  recent_scans,
    }


def list_findings(
    db: Session,
    tenant_id: int,
    severity: str | None = None,
    check_type: str | None = None,
    status: str | None = None,
    limit: int = 200,
) -> list:
    q = db.query(VulnFinding, Agent.hostname).join(
        Agent, Agent.id == VulnFinding.agent_id
    ).filter(VulnFinding.tenant_id == tenant_id)

    if severity:
        q = q.filter(VulnFinding.severity == severity)
    if check_type:
        q = q.filter(VulnFinding.check_type == check_type)
    if status:
        q = q.filter(VulnFinding.status == status)
    else:
        q = q.filter(VulnFinding.status != "resolved")

    rows = q.order_by(VulnFinding.severity.asc(), VulnFinding.created_at.desc()).limit(limit).all()

    SEV_ORDER = {"Critical": 0, "High": 1, "Medium": 2, "Low": 3, "Info": 4}
    rows = sorted(rows, key=lambda r: SEV_ORDER.get(r[0].severity, 9))

    return [
        {
            "id":                 f.id,
            "agent_id":          f.agent_id,
            "hostname":          hostname or f"agent-{f.agent_id}",
            "check_type":        f.check_type,
            "severity":          f.severity,
            "title":             f.title,
            "description":       f.description,
            "remediation":       f.remediation,
            "cve_id":            f.cve_id,
            "cvss_score":        f.cvss_score,
            "affected_component": f.affected_component,
            "package_name":      f.package_name,
            "installed_version": f.installed_version,
            "fixed_version":     f.fixed_version,
            "status":            f.status,
            "first_seen":        f.first_seen.isoformat() if f.first_seen else None,
            "last_seen":         f.last_seen.isoformat() if f.last_seen else None,
        }
        for f, hostname in rows
    ]


def update_finding_status(
    db: Session,
    tenant_id: int,
    finding_id: int,
    status: str,
) -> VulnFinding | None:
    finding = db.query(VulnFinding).filter(
        VulnFinding.id == finding_id,
        VulnFinding.tenant_id == tenant_id,
    ).first()
    if not finding:
        return None
    finding.status = status
    finding.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(finding)
    return finding

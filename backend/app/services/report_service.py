"""Report computation extracted so both the API handler and the Celery task can call it."""
from datetime import datetime, timedelta
from sqlalchemy.orm import Session

from app.models.alert import Alert
from app.models.agent import Agent
from app.models.incident import Incident
from app.models.command import Command


def compute_summary(db: Session, tenant_id: int) -> dict:
    # ── Alert stats ───────────────────────────────────────────────────────────
    alerts = (
        db.query(Alert)
        .join(Agent, Alert.agent_id == Agent.id)
        .filter(Agent.tenant_id == tenant_id)
        .all()
    )
    sev_counts = {"Critical": 0, "High": 0, "Medium": 0, "Low": 0, "Informational": 0}
    for a in alerts:
        sev_counts[a.severity] = sev_counts.get(a.severity, 0) + 1

    # ── Incident stats + MTTR ─────────────────────────────────────────────────
    incidents = db.query(Incident).filter(Incident.tenant_id == tenant_id).all()
    resolved_incidents = [
        i for i in incidents
        if i.status == "Resolved" and i.resolved_at and i.created_at
    ]
    mttr_hours = None
    if resolved_incidents:
        avg_seconds = sum(
            (i.resolved_at - i.created_at).total_seconds()
            for i in resolved_incidents
        ) / len(resolved_incidents)
        mttr_hours = round(avg_seconds / 3600, 1)

    # ── Agent stats ───────────────────────────────────────────────────────────
    agents = db.query(Agent).filter(Agent.tenant_id == tenant_id).all()

    # ── 30-day alert trend ────────────────────────────────────────────────────
    now    = datetime.utcnow()
    cutoff = now - timedelta(days=29)
    trend: dict[str, int] = {}
    for i in range(30):
        trend[(cutoff + timedelta(days=i)).strftime("%Y-%m-%d")] = 0
    for a in alerts:
        if a.timestamp and a.timestamp >= cutoff:
            day = a.timestamp.strftime("%Y-%m-%d")
            if day in trend:
                trend[day] += 1

    # ── Top MITRE ─────────────────────────────────────────────────────────────
    mitre_counts: dict[str, int] = {}
    for a in alerts:
        t = (a.mitre_technique or "").strip()
        if t:
            mitre_counts[t] = mitre_counts.get(t, 0) + 1
    top_mitre = sorted(mitre_counts.items(), key=lambda x: x[1], reverse=True)[:10]

    # ── SOAR command stats ────────────────────────────────────────────────────
    commands = (
        db.query(Command)
        .join(Agent, Command.agent_id == Agent.id)
        .filter(Agent.tenant_id == tenant_id)
        .all()
    )

    return {
        "alerts": {
            "total":       len(alerts),
            "open":        sum(1 for a in alerts if a.status == "Open"),
            "resolved":    sum(1 for a in alerts if a.status == "Resolved"),
            "by_severity": sev_counts,
        },
        "incidents": {
            "total":    len(incidents),
            "open":     sum(1 for i in incidents if i.status == "Open"),
            "resolved": len(resolved_incidents),
            "mttr_hours": mttr_hours,
        },
        "agents": {
            "total":  len(agents),
            "online": sum(1 for a in agents if a.status == "Online"),
        },
        "commands": {
            "total":     len(commands),
            "completed": sum(1 for c in commands if c.status == "Completed"),
        },
        "trend_30d": [{"date": d, "count": c} for d, c in sorted(trend.items())],
        "top_mitre":  [{"technique": t, "count": c} for t, c in top_mitre],
    }

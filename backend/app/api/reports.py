from datetime import datetime, timedelta
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.database.db import get_db
from app.core.permissions import analyst_required
from app.models.user import User
from app.models.alert import Alert
from app.models.incident import Incident
from app.models.agent import Agent
from app.models.command import Command

router = APIRouter(prefix="/reports", tags=["Reports"])


@router.get("/summary")
def get_summary(
    current_user: User = Depends(analyst_required),
    db: Session = Depends(get_db),
):
    tid = current_user.tenant_id

    # ── Alert stats ───────────────────────────────────────────────────────────
    alerts = (
        db.query(Alert)
        .join(Agent, Alert.agent_id == Agent.id)
        .filter(Agent.tenant_id == tid)
        .all()
    )
    total_alerts    = len(alerts)
    open_alerts     = sum(1 for a in alerts if a.status == "Open")
    resolved_alerts = sum(1 for a in alerts if a.status == "Resolved")
    sev_counts = {"Critical": 0, "High": 0, "Medium": 0, "Low": 0, "Informational": 0}
    for a in alerts:
        sev_counts[a.severity] = sev_counts.get(a.severity, 0) + 1

    # ── Incident stats + MTTR ─────────────────────────────────────────────────
    incidents       = db.query(Incident).filter(Incident.tenant_id == tid).all()
    total_incidents = len(incidents)
    open_incidents  = sum(1 for i in incidents if i.status == "Open")
    resolved_incidents = [
        i for i in incidents
        if i.status == "Resolved" and i.resolved_at and i.created_at
    ]
    if resolved_incidents:
        mttr_seconds = sum(
            (i.resolved_at - i.created_at).total_seconds()
            for i in resolved_incidents
        ) / len(resolved_incidents)
        mttr_hours = round(mttr_seconds / 3600, 1)
    else:
        mttr_hours = None

    # ── Agent stats ───────────────────────────────────────────────────────────
    agents       = db.query(Agent).filter(Agent.tenant_id == tid).all()
    total_agents  = len(agents)
    online_agents = sum(1 for a in agents if a.status == "Online")

    # ── 30-day alert trend (daily buckets) ────────────────────────────────────
    now    = datetime.utcnow()
    cutoff = now - timedelta(days=29)
    trend  = {}
    for i in range(30):
        day = (cutoff + timedelta(days=i)).strftime("%Y-%m-%d")
        trend[day] = 0
    for a in alerts:
        if a.timestamp and a.timestamp >= cutoff:
            day = a.timestamp.strftime("%Y-%m-%d")
            if day in trend:
                trend[day] += 1
    trend_list = [{"date": d, "count": c} for d, c in sorted(trend.items())]

    # ── Top MITRE techniques ──────────────────────────────────────────────────
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
        .filter(Agent.tenant_id == tid)
        .all()
    )
    total_commands     = len(commands)
    completed_commands = sum(1 for c in commands if c.status == "Completed")

    return {
        "alerts": {
            "total":    total_alerts,
            "open":     open_alerts,
            "resolved": resolved_alerts,
            "by_severity": sev_counts,
        },
        "incidents": {
            "total":    total_incidents,
            "open":     open_incidents,
            "resolved": len(resolved_incidents),
            "mttr_hours": mttr_hours,
        },
        "agents": {
            "total":  total_agents,
            "online": online_agents,
        },
        "commands": {
            "total":     total_commands,
            "completed": completed_commands,
        },
        "trend_30d": trend_list,
        "top_mitre": [{"technique": t, "count": c} for t, c in top_mitre],
    }

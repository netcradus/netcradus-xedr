"""Report summary computation — all aggregation done in SQL, not Python."""
from datetime import datetime, timedelta

from sqlalchemy import cast, Date, func
from sqlalchemy.orm import Session

from app.models.alert import Alert
from app.models.agent import Agent
from app.models.incident import Incident
from app.models.command import Command


def compute_summary(db: Session, tenant_id: int) -> dict:
    # ── Alert base query (reused) ──────────────────────────────────────────────
    alert_q = (
        db.query(Alert)
        .join(Agent, Alert.agent_id == Agent.id)
        .filter(Agent.tenant_id == tenant_id)
    )

    # Total + status counts — two COUNT queries instead of loading all rows
    total_alerts    = alert_q.count()
    open_alerts     = alert_q.filter(Alert.status == "Open").count()
    resolved_alerts = total_alerts - open_alerts

    # Severity breakdown — one GROUP BY query
    sev_counts: dict[str, int] = {"Critical": 0, "High": 0, "Medium": 0, "Low": 0, "Informational": 0}
    for sev, cnt in (
        alert_q
        .with_entities(Alert.severity, func.count(Alert.id))
        .group_by(Alert.severity)
        .all()
    ):
        if sev in sev_counts:
            sev_counts[sev] = int(cnt)

    # 30-day daily trend — one GROUP BY + date-cast query
    cutoff = datetime.utcnow() - timedelta(days=29)
    trend: dict[str, int] = {
        (cutoff + timedelta(days=i)).strftime("%Y-%m-%d"): 0
        for i in range(30)
    }
    for day, cnt in (
        alert_q
        .filter(Alert.timestamp >= cutoff)
        .with_entities(cast(Alert.timestamp, Date), func.count(Alert.id))
        .group_by(cast(Alert.timestamp, Date))
        .all()
    ):
        key = str(day)   # "YYYY-MM-DD"
        if key in trend:
            trend[key] = int(cnt)

    # Top MITRE techniques — one GROUP BY + ORDER BY + LIMIT query
    mitre_rows = (
        alert_q
        .filter(Alert.mitre_technique.isnot(None), Alert.mitre_technique != "")
        .with_entities(Alert.mitre_technique, func.count(Alert.id).label("cnt"))
        .group_by(Alert.mitre_technique)
        .order_by(func.count(Alert.id).desc())
        .limit(10)
        .all()
    )

    # ── Incident stats ────────────────────────────────────────────────────────
    inc_q = db.query(Incident).filter(Incident.tenant_id == tenant_id)
    total_incidents    = inc_q.count()
    open_incidents     = inc_q.filter(Incident.status == "Open").count()
    resolved_incidents = inc_q.filter(Incident.status == "Resolved").count()

    # MTTR — one AVG(EXTRACT(EPOCH ...)) query, PostgreSQL
    mttr_seconds = (
        inc_q
        .filter(
            Incident.status == "Resolved",
            Incident.resolved_at.isnot(None),
            Incident.created_at.isnot(None),
        )
        .with_entities(
            func.avg(
                func.extract("epoch", Incident.resolved_at - Incident.created_at)
            )
        )
        .scalar()
    )
    mttr_hours = round(float(mttr_seconds) / 3600, 1) if mttr_seconds else None

    # ── Agent stats ───────────────────────────────────────────────────────────
    agent_q     = db.query(Agent).filter(Agent.tenant_id == tenant_id)
    total_agents  = agent_q.count()
    online_agents = agent_q.filter(Agent.status == "Online").count()

    # ── SOAR command stats ────────────────────────────────────────────────────
    cmd_q = (
        db.query(Command)
        .join(Agent, Command.agent_id == Agent.id)
        .filter(Agent.tenant_id == tenant_id)
    )
    total_commands     = cmd_q.count()
    completed_commands = cmd_q.filter(Command.status == "Completed").count()

    return {
        "alerts": {
            "total":       total_alerts,
            "open":        open_alerts,
            "resolved":    resolved_alerts,
            "by_severity": sev_counts,
        },
        "incidents": {
            "total":      total_incidents,
            "open":       open_incidents,
            "resolved":   resolved_incidents,
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
        "trend_30d": [{"date": d, "count": c} for d, c in sorted(trend.items())],
        "top_mitre":  [{"technique": t, "count": int(c)} for t, c in mitre_rows],
    }

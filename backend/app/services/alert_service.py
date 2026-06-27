from datetime import datetime, timedelta
from app.models.alert import Alert

ALERT_COOLDOWN_HOURS = 1  # suppress re-creation of same alert within this window


def create_alert_if_not_exists(
        db,
        title,
        description,
        severity,
        mitre_technique,
        agent_id):

    cutoff = datetime.utcnow() - timedelta(hours=ALERT_COOLDOWN_HOURS)

    existing = db.query(Alert).filter(
        Alert.title == title,
        Alert.agent_id == agent_id,
        Alert.timestamp >= cutoff,
    ).first()

    if existing:
        if existing.status == "Open":
            existing.occurrence_count = (existing.occurrence_count or 0) + 1
            db.commit()
        return existing

    alert = Alert(
        title=title,
        description=description,
        severity=severity,
        mitre_technique=mitre_technique,
        status="Open",
        agent_id=agent_id
    )

    db.add(alert)
    db.commit()
    db.refresh(alert)

    # Correlate into an incident
    try:
        from app.services.incident_service import correlate_alert
        correlate_alert(db, alert)
    except Exception:
        pass

    # Fire notifications for Critical / High alerts
    try:
        from app.models.agent import Agent
        from app.services.notification_service import notify_new_alert
        agent = db.query(Agent).filter(Agent.id == agent_id).first()
        hostname = agent.hostname if agent else f"agent-{agent_id}"
        # Attach tenant_id temporarily so notify_new_alert can look it up
        alert.tenant_id = agent.tenant_id if agent else None
        notify_new_alert(db, alert, hostname)
    except Exception:
        pass

    return alert

from app.models.alert import Alert


def create_alert_if_not_exists(
        db,
        title,
        description,
        severity,
        mitre_technique,
        agent_id):

    existing = db.query(Alert).filter(

        Alert.title == title,

        Alert.agent_id == agent_id,

        Alert.status == "Open"

    ).first()

    if existing:

        existing.occurrence_count = (
            existing.occurrence_count or 0
        ) + 1

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

    return alert

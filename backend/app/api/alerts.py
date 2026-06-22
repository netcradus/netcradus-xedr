from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database.db import get_db
from app.models.alert import Alert

router = APIRouter(
    prefix="/alerts",
    tags=["Alerts"]
)


@router.get("/")
def get_alerts(
        db: Session = Depends(get_db)):

    alerts = db.query(Alert).all()

    return alerts

@router.get("/open")
def get_open_alerts(
        db: Session = Depends(get_db)):

    alerts = db.query(Alert).filter(
        Alert.status == "Open"
    ).all()

    return alerts


@router.get("/{alert_id}")
def get_alert(
        alert_id: int,
        db: Session = Depends(get_db)):

    alert = db.query(Alert).filter(
        Alert.id == alert_id
    ).first()

    if not alert:

        raise HTTPException(
            status_code=404,
            detail="Alert not found"
        )

    return alert


@router.put("/{alert_id}/resolve")
def resolve_alert(
        alert_id: int,
        db: Session = Depends(get_db)):

    alert = db.query(Alert).filter(
        Alert.id == alert_id
    ).first()

    if not alert:

        raise HTTPException(
            status_code=404,
            detail="Alert not found"
        )

    alert.status = "Resolved"

    db.commit()

    return {
        "message": "Alert resolved"
    }
from datetime import datetime, timedelta
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.core.permissions import analyst_required
from app.database.db import get_db
from app.models.agent import Agent
from app.models.alert import Alert
from app.models.incident import Incident
from app.models.user import User
from app.services import incident_service
from app.services.ai_service import (
    generate_incident_summary,
    generate_playbook_recommendation,
    parse_nl_query,
)

router = APIRouter(prefix="/ai", tags=["AI"])


# ── Schemas ───────────────────────────────────────────────────────────────────

class IncidentSummaryRequest(BaseModel):
    incident_id: int


class NLQueryRequest(BaseModel):
    query: str


class PlaybookRecommendationRequest(BaseModel):
    mitre_techniques: List[str] = []
    context: str = ""


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/incident-summary")
def ai_incident_summary(
        request: IncidentSummaryRequest,
        current_user: User = Depends(analyst_required),
        db: Session = Depends(get_db)):

    incident = incident_service.get_incident(db, request.incident_id, current_user.tenant_id)
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")

    raw_alerts = incident_service.get_incident_alerts(db, request.incident_id)

    incident_dict = {
        "title": incident.title,
        "description": incident.description,
        "severity": incident.severity,
        "status": incident.status,
        "mitre_tactics": incident.mitre_tactics,
        "alert_count": incident.alert_count,
        "affected_endpoints": incident.affected_endpoints,
        "created_at": str(incident.created_at),
    }

    try:
        return generate_incident_summary(incident_dict, raw_alerts)
    except ValueError as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"AI service error: {exc}")


@router.post("/nl-query")
def ai_nl_query(
        request: NLQueryRequest,
        current_user: User = Depends(analyst_required),
        db: Session = Depends(get_db)):

    try:
        parsed = parse_nl_query(request.query)
    except ValueError as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"AI parse error: {exc}")

    resource = parsed.get("resource", "alerts")
    filters = parsed.get("filters", {}) or {}
    explanation = parsed.get("explanation", "")

    hours_back = filters.get("hours_back")
    cutoff = None
    if hours_back:
        try:
            cutoff = datetime.utcnow() - timedelta(hours=int(hours_back))
        except (TypeError, ValueError):
            pass

    results = []

    if resource == "incidents":
        q = db.query(Incident).filter(Incident.tenant_id == current_user.tenant_id)
        if filters.get("severity"):
            q = q.filter(Incident.severity == filters["severity"])
        if filters.get("status"):
            q = q.filter(Incident.status == filters["status"])
        if cutoff is not None:
            q = q.filter(Incident.created_at >= cutoff)
        if filters.get("search"):
            like = f"%{filters['search']}%"
            q = q.filter(Incident.title.ilike(like))
        rows = q.order_by(Incident.created_at.desc()).limit(50).all()
        results = [
            {
                "id": r.id,
                "title": r.title,
                "severity": r.severity,
                "status": r.status,
                "alert_count": r.alert_count,
                "created_at": str(r.created_at),
                "mitre_tactics": r.mitre_tactics,
            }
            for r in rows
        ]
    else:
        q = (
            db.query(Alert, Agent.hostname, Agent.os_type)
            .join(Agent, Alert.agent_id == Agent.id)
            .filter(Agent.tenant_id == current_user.tenant_id)
        )
        if filters.get("severity"):
            q = q.filter(Alert.severity == filters["severity"])
        if filters.get("status"):
            q = q.filter(Alert.status == filters["status"])
        if cutoff is not None:
            q = q.filter(Alert.timestamp >= cutoff)
        if filters.get("agent_os"):
            q = q.filter(Agent.os_type.ilike(f"%{filters['agent_os']}%"))
        if filters.get("mitre_technique"):
            q = q.filter(Alert.mitre_technique.ilike(f"%{filters['mitre_technique']}%"))
        if filters.get("search"):
            like = f"%{filters['search']}%"
            q = q.filter(or_(Alert.title.ilike(like), Alert.description.ilike(like)))
        rows = q.order_by(Alert.timestamp.desc()).limit(50).all()
        results = [
            {
                "id": alert.id,
                "title": alert.title,
                "severity": alert.severity,
                "status": alert.status,
                "agent_hostname": hostname,
                "agent_os": os_type,
                "mitre_technique": alert.mitre_technique,
                "timestamp": str(alert.timestamp),
                "occurrence_count": alert.occurrence_count,
            }
            for alert, hostname, os_type in rows
        ]

    return {
        "resource": resource,
        "explanation": explanation,
        "filters_applied": filters,
        "total": len(results),
        "results": results,
    }


@router.post("/playbook-recommendation")
def ai_playbook_recommendation(
        request: PlaybookRecommendationRequest,
        current_user: User = Depends(analyst_required),
        db: Session = Depends(get_db)):

    try:
        return generate_playbook_recommendation(request.mitre_techniques, request.context)
    except ValueError as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"AI service error: {exc}")

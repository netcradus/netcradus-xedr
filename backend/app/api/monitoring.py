from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.permissions import platform_admin_required
from app.database.db import get_db
from app.models.user import User
from app.services.monitoring_service import (
    api_latency_stats,
    db_performance,
    get_monitoring_snapshot,
    heartbeat_summary,
    queue_health,
    worker_status,
)

router = APIRouter(prefix="/monitoring", tags=["Monitoring"])


@router.get("/snapshot")
def monitoring_snapshot(
    current_user: User = Depends(platform_admin_required),
    db: Session = Depends(get_db),
):
    """Full monitoring snapshot — all five dimensions in one call."""
    return get_monitoring_snapshot(db)


@router.get("/latency")
def latency(current_user: User = Depends(platform_admin_required)):
    """Per-route API latency percentiles (rolling last 1 000 samples per route)."""
    return {"routes": api_latency_stats()}


@router.get("/heartbeats")
def heartbeats(
    current_user: User = Depends(platform_admin_required),
    db: Session = Depends(get_db),
):
    """Agent heartbeat health: online / offline / stale counts."""
    return heartbeat_summary(db)


@router.get("/queues")
def queues(current_user: User = Depends(platform_admin_required)):
    """Celery queue depths from Redis."""
    return queue_health()


@router.get("/database")
def database(
    current_user: User = Depends(platform_admin_required),
    db: Session = Depends(get_db),
):
    """SQLAlchemy connection-pool stats and SELECT 1 ping latency."""
    return db_performance(db)


@router.get("/workers")
def workers(current_user: User = Depends(platform_admin_required)):
    """Live Celery worker status and active task counts."""
    return worker_status()

"""
Internal SaaS monitoring service.

Gathers five health dimensions:
  1. api_latency       — per-route latency percentiles from the in-process store
  2. heartbeat_summary — agents that haven't checked in recently
  3. queue_health      — Celery queue depths via Redis LLEN
  4. db_performance    — SQLAlchemy connection-pool stats
  5. worker_status     — live Celery worker inspection
"""
from __future__ import annotations

import time
from datetime import datetime, timedelta

from sqlalchemy.orm import Session

from app.core import latency_store
from app.models.agent import Agent


# ── 1. API latency ────────────────────────────────────────────────────────────

def api_latency_stats() -> list[dict]:
    return latency_store.get_stats()


# ── 2. Heartbeat failures ─────────────────────────────────────────────────────

_STALE_THRESHOLD_SECONDS = 120   # agent missed 2+ consecutive heartbeats


def heartbeat_summary(db: Session) -> dict:
    now       = datetime.utcnow()
    threshold = now - timedelta(seconds=_STALE_THRESHOLD_SECONDS)

    total    = db.query(Agent).count()
    online   = db.query(Agent).filter(Agent.status == "Online").count()
    offline  = db.query(Agent).filter(Agent.status == "Offline").count()

    # Online agents that haven't heartbeated recently (stale)
    stale_agents = (
        db.query(Agent)
        .filter(Agent.status == "Online", Agent.last_seen < threshold)
        .all()
    )
    stale = [
        {
            "id":        a.id,
            "hostname":  a.hostname,
            "tenant_id": a.tenant_id,
            "last_seen": a.last_seen.isoformat() if a.last_seen else None,
            "seconds_since_heartbeat": (
                round((now - a.last_seen).total_seconds()) if a.last_seen else None
            ),
        }
        for a in stale_agents
    ]

    return {
        "total_agents":  total,
        "online":        online,
        "offline":       offline,
        "stale":         len(stale),
        "stale_agents":  stale,
    }


# ── 3. Queue health ───────────────────────────────────────────────────────────

_CELERY_QUEUES = ["celery"]   # add "celery.priority.high" etc. if you configure more


def queue_health() -> dict:
    try:
        from app.core.config import settings
        import redis as redis_client

        r = redis_client.from_url(settings.redis_url, socket_connect_timeout=2)
        r.ping()

        queues = {}
        for q in _CELERY_QUEUES:
            queues[q] = r.llen(q)

        # Celery result backend key count (approximation)
        result_keys = len(r.keys("celery-task-meta-*"))

        return {
            "status":      "ok",
            "queues":      queues,
            "result_keys": result_keys,
        }
    except Exception as exc:
        return {"status": "error", "error": str(exc)}


# ── 4. Database performance ───────────────────────────────────────────────────

def db_performance(db: Session) -> dict:
    try:
        from app.database.db import engine

        pool = engine.pool

        # Time a simple SELECT 1
        start = time.perf_counter()
        db.execute(__import__("sqlalchemy").text("SELECT 1"))
        ping_ms = round((time.perf_counter() - start) * 1000, 1)

        return {
            "status":       "ok",
            "ping_ms":      ping_ms,
            "pool_size":    pool.size(),
            "checked_in":   pool.checkedin(),    # idle connections
            "checked_out":  pool.checkedout(),   # active connections
            "overflow":     pool.overflow(),     # beyond pool_size
        }
    except Exception as exc:
        return {"status": "error", "error": str(exc)}


# ── 5. Worker status ──────────────────────────────────────────────────────────

def worker_status() -> dict:
    try:
        from app.core.celery_app import celery_app

        inspector = celery_app.control.inspect(timeout=2)

        ping    = inspector.ping()     or {}
        active  = inspector.active()   or {}
        reserved = inspector.reserved() or {}

        workers = []
        for name in set(list(ping) + list(active)):
            task_count      = len(active.get(name, []))
            queued_count    = len(reserved.get(name, []))
            workers.append({
                "name":       name,
                "status":     "online" if name in ping else "unknown",
                "active_tasks":   task_count,
                "reserved_tasks": queued_count,
            })

        return {
            "status":       "ok" if workers else "no_workers",
            "worker_count": len(workers),
            "workers":      workers,
        }
    except Exception as exc:
        return {"status": "error", "error": str(exc)}


# ── Unified snapshot ──────────────────────────────────────────────────────────

def get_monitoring_snapshot(db: Session) -> dict:
    return {
        "captured_at":       datetime.utcnow().isoformat() + "Z",
        "api_latency":       api_latency_stats(),
        "heartbeat_summary": heartbeat_summary(db),
        "queue_health":      queue_health(),
        "db_performance":    db_performance(db),
        "worker_status":     worker_status(),
    }

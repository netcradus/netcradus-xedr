import time
from fastapi import APIRouter
from app.database.db import SessionLocal

router = APIRouter(tags=["Health"])

_start_time = time.time()


@router.get("/health")
def health_check():
    db_status = "ok"
    try:
        db = SessionLocal()
        db.execute(__import__("sqlalchemy").text("SELECT 1"))
        db.close()
    except Exception:
        db_status = "error"

    redis_status = "not configured"
    try:
        from app.core.config import settings
        if settings.redis_url:
            import redis as redis_client
            r = redis_client.from_url(settings.redis_url, socket_connect_timeout=2)
            r.ping()
            redis_status = "ok"
    except Exception:
        redis_status = "error"

    overall = "ok" if db_status == "ok" else "degraded"

    return {
        "status": overall,
        "db": db_status,
        "redis": redis_status,
        "version": "1.0.0",
        "uptime_seconds": round(time.time() - _start_time),
    }

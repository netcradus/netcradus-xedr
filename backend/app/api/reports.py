import json

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database.db import get_db
from app.core.permissions import analyst_required, admin_required
from app.core.redis_client import get_redis
from app.models.user import User
from app.services.report_service import compute_summary
from app.tasks.reports import generate_report_cache_task, REPORT_CACHE_KEY

router = APIRouter(prefix="/reports", tags=["Reports"])


@router.get("/summary")
def get_summary(
    current_user: User = Depends(analyst_required),
    db: Session = Depends(get_db),
):
    """
    Return the report summary for the tenant.

    Serves from the Redis cache when available (stale-while-revalidate).
    On a cache miss the computation runs synchronously so the first request
    is still responsive, then the result is stored for subsequent calls.
    A background refresh is also enqueued to keep the cache warm.
    """
    tid   = current_user.tenant_id
    key   = REPORT_CACHE_KEY.format(tenant_id=tid)
    redis = get_redis()

    if redis:
        cached = redis.get(key)
        if cached:
            # Kick off a background refresh if the TTL is under 5 minutes
            ttl = redis.ttl(key)
            if ttl < 300:
                generate_report_cache_task.delay(tid)
            return json.loads(cached)

    # Cache miss — compute synchronously and cache the result
    data = compute_summary(db, tid)
    if redis:
        redis.setex(key, 1800, json.dumps(data, default=str))
    # Also enqueue a background task so future calls hit the cache
    try:
        generate_report_cache_task.delay(tid)
    except Exception:
        pass
    return data


@router.post("/generate", status_code=202)
def trigger_report_generation(
    current_user: User = Depends(admin_required),
):
    """
    Enqueue a background task to (re)generate and cache the report summary.
    Returns immediately with 202 Accepted.
    """
    generate_report_cache_task.delay(current_user.tenant_id)
    return {"status": "accepted", "tenant_id": current_user.tenant_id}

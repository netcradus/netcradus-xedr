import json

from app.core.celery_app import celery_app
from celery import shared_task

REPORT_CACHE_KEY = "sxdr:report:{tenant_id}"
REPORT_CACHE_TTL = 1800  # 30 minutes


@celery_app.task(bind=True, max_retries=2, default_retry_delay=30)
def generate_report_cache_task(self, tenant_id: int):
    """
    Compute the report summary for a tenant and store the result in Redis.
    Called by POST /reports/generate or automatically when the cache is cold.
    """
    from app.database.db import SessionLocal
    from app.core.redis_client import get_redis
    from app.services.report_service import compute_summary

    db = SessionLocal()
    try:
        data = compute_summary(db, tenant_id)
        redis = get_redis()
        if redis:
            redis.setex(
                REPORT_CACHE_KEY.format(tenant_id=tenant_id),
                REPORT_CACHE_TTL,
                json.dumps(data, default=str),
            )
        return {"tenant_id": tenant_id, "cached": redis is not None}
    except Exception as exc:
        raise self.retry(exc=exc)
    finally:
        db.close()


@celery_app.task
def sweep_report_cache_task():
    """
    Periodic task (run by celery beat every 30 min).
    Finds all active tenants and dispatches a generate_report_cache_task for each.
    """
    from app.database.db import SessionLocal
    from app.models.tenant import Tenant

    db = SessionLocal()
    try:
        tenant_ids = [
            t.id for t in db.query(Tenant).filter(Tenant.is_active == True).all()
        ]
    finally:
        db.close()

    for tid in tenant_ids:
        generate_report_cache_task.delay(tid)

    return {"dispatched": len(tenant_ids)}

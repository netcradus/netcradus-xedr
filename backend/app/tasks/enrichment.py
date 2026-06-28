from app.core.celery_app import celery_app


@celery_app.task(bind=True, max_retries=3, default_retry_delay=30)
def enrich_ioc_task(self, ioc_id: int, tenant_id: int):
    """Async Celery task for IOC enrichment (replaces threading)."""
    from app.database.db import SessionLocal
    from app.services.enrichment_service import _enrich_worker
    try:
        _enrich_worker(ioc_id, tenant_id)
    except Exception as exc:
        raise self.retry(exc=exc)

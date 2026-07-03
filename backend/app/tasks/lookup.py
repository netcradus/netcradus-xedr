from app.core.celery_app import celery_app


@celery_app.task(bind=True, max_retries=2, default_retry_delay=30)
def lookup_ioc_task(self, tenant_id: int, ioc_type: str, value: str):
    """Async IOC lookup across all configured threat feeds (VT, AbuseIPDB, OTX)."""
    from app.database.db import SessionLocal
    from app.services.enrichment_service import lookup_ioc

    db = SessionLocal()
    try:
        return lookup_ioc(db, tenant_id, ioc_type, value)
    except Exception as exc:
        raise self.retry(exc=exc)
    finally:
        db.close()

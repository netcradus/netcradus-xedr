from app.core.celery_app import celery_app


@celery_app.task(bind=True, max_retries=3, default_retry_delay=30)
def enrich_ioc_task(self, ioc_id: int, tenant_id: int):
    """Enrich a single IOC via all configured threat feeds."""
    from app.services.enrichment_service import _enrich_worker
    try:
        _enrich_worker(ioc_id, tenant_id)
    except Exception as exc:
        raise self.retry(exc=exc)


@celery_app.task(bind=True, max_retries=2, default_retry_delay=60)
def sync_iocs_task(self, tenant_id: int):
    """
    Batch-enrich all IOCs that have not been enriched yet.
    Uses the given tenant's API keys (virustotal, abuseipdb, otx).
    Dispatches one enrich_ioc_task per IOC so they run in parallel
    and each can retry independently.
    """
    from app.database.db import SessionLocal
    from app.models.ioc import IOC

    db = SessionLocal()
    try:
        pending = (
            db.query(IOC)
            .filter(IOC.enrichment_status.notin_(["done"]))
            .all()
        )
        queued = 0
        for ioc in pending:
            ioc.enrichment_status = "pending"
            enrich_ioc_task.delay(ioc.id, tenant_id)
            queued += 1
        db.commit()
        return {"queued": queued, "tenant_id": tenant_id}
    except Exception as exc:
        db.rollback()
        raise self.retry(exc=exc)
    finally:
        db.close()

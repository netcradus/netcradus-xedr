from app.core.celery_app import celery_app


@celery_app.task(bind=True, max_retries=2, default_retry_delay=60)
def send_email_task(self, to: str, subject: str, html: str):
    """Async Celery task for sending platform emails (replaces threading)."""
    from app.services.email_service import _send
    try:
        _send(to, subject, html)
    except Exception as exc:
        raise self.retry(exc=exc)

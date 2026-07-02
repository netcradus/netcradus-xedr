from celery import Celery
from app.core.config import settings

celery_app = Celery(
    "sentryxdr",
    broker=settings.redis_url,
    backend=settings.redis_url,
    include=[
        "app.tasks.enrichment",
        "app.tasks.notifications",
        "app.tasks.reports",
    ],
)

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="UTC",
    enable_utc=True,
    task_acks_late=True,
    worker_prefetch_multiplier=1,
    # Periodic task schedule (requires celery beat worker)
    beat_schedule={
        # Refresh report cache for every tenant every 30 minutes.
        # This task dispatches per-tenant generate_report_cache_task jobs.
        "report-cache-sweep-30m": {
            "task": "app.tasks.reports.sweep_report_cache_task",
            "schedule": 1800,
        },
    },
)

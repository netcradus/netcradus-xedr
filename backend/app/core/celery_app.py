from celery import Celery
from celery.schedules import crontab
from app.core.config import settings

celery_app = Celery(
    "netcradxdr",
    broker=settings.redis_url,
    backend=settings.redis_url,
    include=[
        "app.tasks.enrichment",
        "app.tasks.notifications",
        "app.tasks.reports",
        "app.tasks.report_schedule",
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
        # Refresh report summary cache for every tenant every 30 minutes
        "report-cache-sweep-30m": {
            "task": "app.tasks.reports.sweep_report_cache_task",
            "schedule": 1800,
        },
        # Daily SOC report — 06:00 UTC every day
        "scheduled-daily-soc": {
            "task": "app.tasks.report_schedule.run_daily_soc_reports",
            "schedule": crontab(hour=6, minute=0),
        },
        # Weekly executive report — 06:00 UTC every Monday
        "scheduled-weekly-exec": {
            "task": "app.tasks.report_schedule.run_weekly_exec_reports",
            "schedule": crontab(hour=6, minute=0, day_of_week=1),
        },
        # Monthly compliance report — 06:00 UTC on the 1st of each month
        "scheduled-monthly-compliance": {
            "task": "app.tasks.report_schedule.run_monthly_compliance_reports",
            "schedule": crontab(hour=6, minute=0, day_of_month=1),
        },
    },
)

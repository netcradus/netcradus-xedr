from celery import Celery
from celery.schedules import crontab
from app.core.config import settings

celery_app = Celery(
    "netcradxdr",
    broker=settings.redis_url,
    backend=settings.redis_url,
    include=[
        "app.tasks.agents",
        "app.tasks.enrichment",
        "app.tasks.lookup",
        "app.tasks.notifications",
        "app.tasks.reports",
        "app.tasks.report_schedule",
    ],
)

celery_app.conf.update(
    # Serialization
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="UTC",
    enable_utc=True,

    # Reliability
    task_acks_late=True,           # re-queue task if worker crashes mid-execution
    worker_prefetch_multiplier=1,  # one task at a time per worker slot (fair dispatch)

    # Result expiry — prevents Redis filling up with stale task results
    result_expires=3600,           # 1 hour

    # Time limits — prevents a hung HTTP/SMTP call blocking a worker forever
    task_soft_time_limit=120,      # sends SoftTimeLimitExceeded so task can clean up
    task_time_limit=180,           # hard kill after 3 min if soft limit is ignored

    # Memory hygiene — recycle each worker after N tasks to prevent leaks
    worker_max_tasks_per_child=200,

    # Task routing — three queues by priority/weight
    # Default launch:  celery -A app.core.celery_app worker -Q notifications,default,enrichment
    # For isolation:   run a dedicated worker per queue
    task_routes={
        # Fast, user-visible — highest priority
        "app.tasks.notifications.*": {"queue": "notifications"},
        "app.tasks.agents.*":        {"queue": "notifications"},

        # Heavy network I/O (VT / AbuseIPDB / OTX) — isolated so enrichment
        # backlogs don't delay alert/incident notifications
        "app.tasks.enrichment.*":    {"queue": "enrichment"},
        "app.tasks.lookup.*":        {"queue": "enrichment"},

        # Everything else (reports, scheduled work)
        "app.tasks.reports.*":         {"queue": "default"},
        "app.tasks.report_schedule.*": {"queue": "default"},
    },
    task_default_queue="default",

    # Periodic task schedule (requires: celery -A app.core.celery_app beat)
    beat_schedule={
        # ── Agent health (every 60 s) ──────────────────────────────────────
        # Replaces the raw threading.Thread in main.py — safe under multi-worker
        # deploys because beat fires exactly one instance regardless of worker count.
        "agent-offline-check-60s": {
            "task": "app.tasks.agents.check_offline_agents_task",
            "schedule": 60,
        },

        # ── Report cache (every 30 min) ────────────────────────────────────
        "report-cache-sweep-30m": {
            "task": "app.tasks.reports.sweep_report_cache_task",
            "schedule": 1800,
        },

        # ── Scheduled email reports ────────────────────────────────────────
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

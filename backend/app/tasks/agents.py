from app.core.celery_app import celery_app


@celery_app.task(bind=True, max_retries=2, default_retry_delay=30, queue="default")
def check_offline_agents_task(self):
    """
    Periodic task (every 60 s via beat): mark stale agents Offline and fire
    per-tenant notifications for agents that just went offline.
    Replaces the raw threading.Thread in main.py — safe under multi-worker deploys
    because Celery beat fires exactly one task instance regardless of worker count.
    """
    from app.database.db import SessionLocal
    from app.services.agent_service import update_offline_agents

    db = SessionLocal()
    try:
        newly_offline = update_offline_agents(db)
        if newly_offline:
            _notify_offline(newly_offline)
        return {"marked_offline": len(newly_offline)}
    except Exception as exc:
        raise self.retry(exc=exc)
    finally:
        db.close()


def _notify_offline(agents: list) -> None:
    """Dispatch one notification task per tenant that lost an agent."""
    from app.tasks.notifications import notify_agent_offline_task

    by_tenant: dict[int, list] = {}
    for a in agents:
        by_tenant.setdefault(a.tenant_id, []).append(a.hostname)

    for tenant_id, hostnames in by_tenant.items():
        notify_agent_offline_task.delay(tenant_id, hostnames)

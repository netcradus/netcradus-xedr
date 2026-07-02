import json
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Path, Query
from fastapi.responses import Response
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database.db import get_db
from app.core.permissions import analyst_required, admin_required
from app.core.redis_client import get_redis
from app.models.user import User
from app.models.scheduled_report import ScheduledReportConfig
from app.models.generated_report import GeneratedReport
from app.services.report_service import compute_summary
from app.tasks.reports import generate_report_cache_task, REPORT_CACHE_KEY

router = APIRouter(prefix="/reports", tags=["Reports"])

_REPORT_TYPES = {"daily_soc", "weekly_exec", "monthly_compliance"}


# ── GET /reports/summary ───────────────────────────────────────────────────────

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
            if redis.ttl(key) < 300:
                generate_report_cache_task.delay(tid)
            return json.loads(cached)

    data = compute_summary(db, tid)
    if redis:
        redis.setex(key, 1800, json.dumps(data, default=str))
    try:
        generate_report_cache_task.delay(tid)
    except Exception:
        pass
    return data


# ── POST /reports/generate ─────────────────────────────────────────────────────

@router.post("/generate", status_code=202)
def trigger_report_generation(
    current_user: User = Depends(admin_required),
):
    """Enqueue a background task to (re)generate and cache the report summary."""
    generate_report_cache_task.delay(current_user.tenant_id)
    return {"status": "accepted", "tenant_id": current_user.tenant_id}


# ── GET /reports/scheduled ─────────────────────────────────────────────────────

@router.get("/scheduled")
def list_scheduled_configs(
    current_user: User = Depends(admin_required),
    db: Session = Depends(get_db),
):
    """Return the scheduled report configuration for this tenant (one row per type)."""
    tid   = current_user.tenant_id
    cfgs  = db.query(ScheduledReportConfig).filter_by(tenant_id=tid).all()
    by_type = {c.report_type: c for c in cfgs}

    result = []
    for rt in sorted(_REPORT_TYPES):
        c = by_type.get(rt)
        result.append({
            "report_type":  rt,
            "enabled":      c.enabled     if c else False,
            "recipients":   c.recipients  if c else None,
            "last_run_at":  c.last_run_at.isoformat() if (c and c.last_run_at) else None,
            "updated_at":   c.updated_at.isoformat()  if (c and c.updated_at)  else None,
        })
    return result


# ── PUT /reports/scheduled/{report_type} ──────────────────────────────────────

class ScheduledConfigUpdate(BaseModel):
    enabled:    bool
    recipients: Optional[str] = None   # comma-separated emails


@router.put("/scheduled/{report_type}")
def update_scheduled_config(
    report_type: str = Path(...),
    body: ScheduledConfigUpdate = ...,
    current_user: User = Depends(admin_required),
    db: Session = Depends(get_db),
):
    """Enable/disable a scheduled report and set its email recipients."""
    if report_type not in _REPORT_TYPES:
        raise HTTPException(400, f"Unknown report type. Valid: {sorted(_REPORT_TYPES)}")

    tid = current_user.tenant_id
    cfg = db.query(ScheduledReportConfig).filter_by(tenant_id=tid, report_type=report_type).first()
    if not cfg:
        cfg = ScheduledReportConfig(tenant_id=tid, report_type=report_type)
        db.add(cfg)

    cfg.enabled    = body.enabled
    cfg.recipients = body.recipients
    db.commit()
    db.refresh(cfg)

    return {
        "report_type": cfg.report_type,
        "enabled":     cfg.enabled,
        "recipients":  cfg.recipients,
        "updated_at":  cfg.updated_at.isoformat() if cfg.updated_at else None,
    }


# ── POST /reports/trigger/{report_type} ───────────────────────────────────────

@router.post("/trigger/{report_type}", status_code=202)
def trigger_scheduled_report(
    report_type: str = Path(...),
    current_user: User = Depends(admin_required),
):
    """Manually trigger generation of a specific report type. Returns 202 immediately."""
    if report_type not in _REPORT_TYPES:
        raise HTTPException(400, f"Unknown report type. Valid: {sorted(_REPORT_TYPES)}")

    from app.tasks.report_schedule import generate_scheduled_report_task

    now   = datetime.utcnow()
    days  = {"daily_soc": 1, "weekly_exec": 7, "monthly_compliance": 30}[report_type]
    start = now.replace(hour=0, minute=0, second=0, microsecond=0) - timedelta(days=days)
    end   = now

    generate_scheduled_report_task.delay(
        current_user.tenant_id, report_type,
        start.isoformat(), end.isoformat(),
        "manual",
    )
    return {"status": "accepted", "report_type": report_type, "tenant_id": current_user.tenant_id}


# ── GET /reports/history ───────────────────────────────────────────────────────

@router.get("/history")
def list_report_history(
    report_type: Optional[str] = Query(default=None),
    status:      Optional[str] = Query(default=None),
    limit:       int           = Query(default=20, ge=1, le=100),
    offset:      int           = Query(default=0,  ge=0),
    current_user: User         = Depends(analyst_required),
    db: Session                = Depends(get_db),
):
    """Return a paginated list of generated reports for this tenant (no PDF data)."""
    tid = current_user.tenant_id
    q   = db.query(GeneratedReport).filter_by(tenant_id=tid)

    if report_type:
        q = q.filter(GeneratedReport.report_type == report_type)
    if status:
        q = q.filter(GeneratedReport.status == status)

    total = q.count()
    rows  = q.order_by(GeneratedReport.generated_at.desc()).offset(offset).limit(limit).all()

    items = [
        {
            "id":           r.id,
            "report_type":  r.report_type,
            "period_start": r.period_start.isoformat(),
            "period_end":   r.period_end.isoformat(),
            "file_size":    r.file_size,
            "generated_at": r.generated_at.isoformat(),
            "triggered_by": r.triggered_by,
            "status":       r.status,
            "error":        r.error,
        }
        for r in rows
    ]
    return {"total": total, "offset": offset, "limit": limit, "items": items}


# ── GET /reports/history/{id}/download ────────────────────────────────────────

@router.get("/history/{report_id}/download")
def download_report(
    report_id: int = Path(...),
    current_user: User = Depends(analyst_required),
    db: Session = Depends(get_db),
):
    """Stream a generated PDF. Returns 404 if not found or PDF not yet available."""
    r = db.query(GeneratedReport).filter_by(id=report_id, tenant_id=current_user.tenant_id).first()
    if not r:
        raise HTTPException(404, "Report not found")
    if r.status != "done" or not r.pdf_data:
        raise HTTPException(404, "PDF not yet available — status: " + r.status)

    filename = f"{r.report_type}_{r.period_start.strftime('%Y%m%d')}.pdf"
    return Response(
        content=r.pdf_data,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )

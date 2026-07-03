"""
Scheduled PDF report tasks.

Three periodic tasks (driven by celery beat):
  run_daily_soc_reports          — 06:00 UTC daily
  run_weekly_exec_reports        — 06:00 UTC every Monday
  run_monthly_compliance_reports — 06:00 UTC on the 1st of each month

Each sweep iterates active tenants and dispatches a per-tenant
generate_scheduled_report_task that:
  1. Generates a PDF via report_generator
  2. Persists it in generated_reports (LargeBinary)
  3. Emails PDF to configured recipients (if any)
  4. Updates ScheduledReportConfig.last_run_at
"""
from __future__ import annotations

import json
from datetime import datetime, timedelta

from app.core.celery_app import celery_app


# ── Sweep tasks (one per period) ──────────────────────────────────────────────

@celery_app.task
def run_daily_soc_reports():
    """Dispatch daily SOC report generation for every active tenant."""
    from app.database.db import SessionLocal
    from app.models.tenant import Tenant

    now   = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    start = now - timedelta(days=1)
    end   = now

    db = SessionLocal()
    try:
        tenant_ids = [r[0] for r in db.query(Tenant.id).filter(Tenant.is_active == True).all()]
    finally:
        db.close()

    for tid in tenant_ids:
        generate_scheduled_report_task.delay(
            tid, "daily_soc",
            start.isoformat(), end.isoformat(),
            "schedule",
        )
    return {"dispatched": len(tenant_ids), "report_type": "daily_soc"}


@celery_app.task
def run_weekly_exec_reports():
    """Dispatch weekly executive report generation for every active tenant."""
    from app.database.db import SessionLocal
    from app.models.tenant import Tenant

    now   = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    start = now - timedelta(days=7)
    end   = now

    db = SessionLocal()
    try:
        tenant_ids = [r[0] for r in db.query(Tenant.id).filter(Tenant.is_active == True).all()]
    finally:
        db.close()

    for tid in tenant_ids:
        generate_scheduled_report_task.delay(
            tid, "weekly_exec",
            start.isoformat(), end.isoformat(),
            "schedule",
        )
    return {"dispatched": len(tenant_ids), "report_type": "weekly_exec"}


@celery_app.task
def run_monthly_compliance_reports():
    """Dispatch monthly compliance report generation for every active tenant."""
    from app.database.db import SessionLocal
    from app.models.tenant import Tenant

    today = datetime.utcnow().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    # First day of previous month
    if today.month == 1:
        start = today.replace(year=today.year - 1, month=12)
    else:
        start = today.replace(month=today.month - 1)
    end = today  # midnight of the 1st = exclusive end of previous month

    db = SessionLocal()
    try:
        tenant_ids = [r[0] for r in db.query(Tenant.id).filter(Tenant.is_active == True).all()]
    finally:
        db.close()

    for tid in tenant_ids:
        generate_scheduled_report_task.delay(
            tid, "monthly_compliance",
            start.isoformat(), end.isoformat(),
            "schedule",
        )
    return {"dispatched": len(tenant_ids), "report_type": "monthly_compliance"}


# ── Per-tenant generation task ─────────────────────────────────────────────────

@celery_app.task(bind=True, max_retries=2, default_retry_delay=120)
def generate_scheduled_report_task(
    self,
    tenant_id: int,
    report_type: str,
    period_start_iso: str,
    period_end_iso: str,
    triggered_by: str = "schedule",
):
    """
    Generate a PDF for one tenant, persist it, email if recipients configured.

    Imported lazily so this module can be safely imported without a DB connection.
    """
    from app.database.db import SessionLocal
    from app.models.generated_report import GeneratedReport
    from app.models.scheduled_report import ScheduledReportConfig
    from app.services.report_generator import generate_report
    from app.services.notification_service import _send_email

    period_start = datetime.fromisoformat(period_start_iso)
    period_end   = datetime.fromisoformat(period_end_iso)

    db = SessionLocal()
    # Create a placeholder row so we can track failure too
    record = GeneratedReport(
        tenant_id=tenant_id,
        report_type=report_type,
        period_start=period_start,
        period_end=period_end,
        triggered_by=triggered_by,
        status="pending",
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    record_id = record.id

    try:
        pdf_bytes = generate_report(db, tenant_id, report_type, period_start, period_end)

        record.pdf_data     = pdf_bytes
        record.file_size    = len(pdf_bytes)
        record.status       = "done"
        db.commit()

        # Update last_run_at on the config row (if it exists)
        cfg = (db.query(ScheduledReportConfig)
               .filter_by(tenant_id=tenant_id, report_type=report_type)
               .first())
        if cfg:
            cfg.last_run_at = datetime.utcnow()
            cfg.enabled     = cfg.enabled  # keep value, just trigger update
            db.commit()

        # Email if enabled and recipients configured
        if cfg and cfg.enabled and cfg.recipients:
            _email_report(cfg.recipients, report_type, period_start, period_end, pdf_bytes)

        return {"status": "done", "record_id": record_id, "file_size": len(pdf_bytes)}

    except Exception as exc:
        try:
            record.status = "failed"
            record.error  = str(exc)[:500]
            db.commit()
        except Exception:
            db.rollback()
        raise self.retry(exc=exc)
    finally:
        db.close()


def _email_report(
    recipients_csv: str,
    report_type: str,
    period_start: datetime,
    period_end: datetime,
    pdf_bytes: bytes,
) -> None:
    """Send PDF as email attachment to each recipient."""
    import smtplib
    import email as email_lib
    from email.mime.multipart import MIMEMultipart
    from email.mime.text import MIMEText
    from email.mime.application import MIMEApplication
    from app.core.config import settings

    if not getattr(settings, "smtp_host", None):
        return  # SMTP not configured

    label_map = {
        "daily_soc":          "Daily SOC Operations Report",
        "weekly_exec":        "Weekly Executive Security Report",
        "monthly_compliance": "Monthly Compliance Report",
    }
    label    = label_map.get(report_type, report_type)
    filename = f"{report_type}_{period_start.strftime('%Y%m%d')}.pdf"
    subject  = f"[NetcradXDR] {label} — {period_start.strftime('%Y-%m-%d')}"

    for addr in [r.strip() for r in recipients_csv.split(",") if r.strip()]:
        try:
            msg = MIMEMultipart()
            msg["From"]    = getattr(settings, "smtp_from", "noreply@netcradxdr.io")
            msg["To"]      = addr
            msg["Subject"] = subject
            msg.attach(MIMEText(
                f"Please find attached the {label} for "
                f"{period_start.strftime('%Y-%m-%d')} to {period_end.strftime('%Y-%m-%d')}.",
                "plain",
            ))
            part = MIMEApplication(pdf_bytes, _subtype="pdf")
            part.add_header("Content-Disposition", "attachment", filename=filename)
            msg.attach(part)

            with smtplib.SMTP(settings.smtp_host, getattr(settings, "smtp_port", 587)) as srv:
                srv.ehlo()
                if getattr(settings, "smtp_tls", True):
                    srv.starttls()
                if getattr(settings, "smtp_user", None):
                    srv.login(settings.smtp_user, settings.smtp_pass)
                srv.sendmail(msg["From"], [addr], msg.as_string())
        except Exception:
            pass  # Best-effort — don't let one bad address fail others

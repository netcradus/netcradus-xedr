"""
Audit service — fire-and-forget event logging.
Every call is wrapped in try/except so it never breaks the calling endpoint.
"""

from sqlalchemy.orm import Session
from app.models.audit_log import AuditLog


def log_event(
    db: Session,
    tenant_id: int,
    action: str,
    user_id: int | None = None,
    user_name: str | None = None,
    resource_type: str | None = None,
    resource_id: int | None = None,
    details: str | None = None,
) -> None:
    try:
        db.add(AuditLog(
            tenant_id=tenant_id,
            user_id=user_id,
            user_name=user_name,
            action=action,
            resource_type=resource_type,
            resource_id=resource_id,
            details=details,
        ))
        db.commit()
    except Exception as e:
        db.rollback()
        print(f"[audit] log_event failed: {e}")

from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database.db import get_db
from app.core.permissions import admin_required
from app.models.audit_log import AuditLog
from app.models.user import User

router = APIRouter(prefix="/audit-logs", tags=["Audit"])


@router.get("/")
def list_audit_logs(
    action: Optional[str] = Query(None),
    resource_type: Optional[str] = Query(None),
    limit: int = Query(200, le=1000),
    current_user: User = Depends(admin_required),
    db: Session = Depends(get_db),
):
    q = (
        db.query(AuditLog)
        .filter(AuditLog.tenant_id == current_user.tenant_id)
    )
    if action:
        q = q.filter(AuditLog.action == action)
    if resource_type:
        q = q.filter(AuditLog.resource_type == resource_type)

    logs = q.order_by(AuditLog.timestamp.desc()).limit(limit).all()

    return [
        {
            "id":            log.id,
            "user_name":     log.user_name,
            "action":        log.action,
            "resource_type": log.resource_type,
            "resource_id":   log.resource_id,
            "details":       log.details,
            "timestamp":     log.timestamp.isoformat() if log.timestamp else None,
        }
        for log in logs
    ]

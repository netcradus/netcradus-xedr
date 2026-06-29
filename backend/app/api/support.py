from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.database.db import get_db
from app.models.support_ticket import SupportTicket
from app.models.user import User

router = APIRouter(prefix="/support", tags=["Support"])

VALID_PRIORITIES = {"Low", "Medium", "High", "Critical"}


class CreateTicketRequest(BaseModel):
    subject:  str = Field(..., min_length=3, max_length=200)
    message:  str = Field(..., min_length=10)
    priority: str = "Medium"


def _fmt(ticket: SupportTicket) -> dict:
    return {
        "id":          ticket.id,
        "subject":     ticket.subject,
        "message":     ticket.message,
        "priority":    ticket.priority,
        "status":      ticket.status,
        "admin_note":  ticket.admin_note,
        "user_name":   ticket.user_name,
        "user_email":  ticket.user_email,
        "tenant_name": ticket.tenant_name,
        "created_at":  ticket.created_at.isoformat() if ticket.created_at else None,
        "updated_at":  ticket.updated_at.isoformat() if ticket.updated_at else None,
    }


@router.post("/tickets", status_code=201)
def create_ticket(
    body: CreateTicketRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if body.priority not in VALID_PRIORITIES:
        raise HTTPException(status_code=422, detail="Invalid priority")

    tenant_name = None
    if current_user.tenant_id:
        from app.models.tenant import Tenant
        t = db.query(Tenant).filter(Tenant.id == current_user.tenant_id).first()
        if t:
            tenant_name = t.name

    ticket = SupportTicket(
        tenant_id   = current_user.tenant_id,
        user_id     = current_user.id,
        user_name   = current_user.name,
        user_email  = current_user.email,
        tenant_name = tenant_name,
        subject     = body.subject.strip(),
        message     = body.message.strip(),
        priority    = body.priority,
        status      = "Open",
        created_at  = datetime.utcnow(),
        updated_at  = datetime.utcnow(),
    )
    db.add(ticket)
    db.commit()
    db.refresh(ticket)
    return _fmt(ticket)


@router.get("/tickets")
def list_my_tickets(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return all tickets for the current user's tenant."""
    tickets = (
        db.query(SupportTicket)
        .filter(SupportTicket.tenant_id == current_user.tenant_id)
        .order_by(SupportTicket.created_at.desc())
        .all()
    )
    return [_fmt(t) for t in tickets]

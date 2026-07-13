"""
Live response shell API.

Provides an interactive command-execution channel over HTTP polling:
  POST /live-response/sessions              — open a new session
  GET  /live-response/sessions/{id}         — session details + full transcript
  POST /live-response/sessions/{id}/input   — analyst sends a command
  POST /live-response/sessions/{id}/output  — agent uploads command output
  GET  /live-response/sessions/{id}/poll    — agent polls for pending input
  POST /live-response/sessions/{id}/close   — close the session
  GET  /live-response/sessions/             — list open sessions for tenant

Security:
  - Opening/closing/sending input → admin_required
  - Uploading output + polling → authenticated by agent_token (no user auth)
"""
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Header
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.permissions import admin_required, analyst_required
from app.database.db import get_db
from app.models.agent import Agent
from app.models.live_session import LiveSession, LiveSessionEntry
from app.models.user import User
from app.services.audit_service import log_event

router = APIRouter(prefix="/live-response", tags=["Live Response"])

SESSION_TIMEOUT_MINUTES = 60


# ── Schemas ───────────────────────────────────────────────────────────────────

class OpenSessionPayload(BaseModel):
    agent_id:   int
    shell_type: str = "cmd"   # cmd | powershell | bash


class InputPayload(BaseModel):
    command: str


class OutputPayload(BaseModel):
    agent_token: str
    content:     str


# ── Helpers ───────────────────────────────────────────────────────────────────

def _session_to_dict(s: LiveSession, include_entries: bool = False) -> dict:
    d = {
        "id": s.id, "agent_id": s.agent_id,
        "initiator_id": s.initiator_id,
        "status": s.status, "shell_type": s.shell_type,
        "opened_at": s.opened_at.isoformat() if s.opened_at else None,
        "closed_at": s.closed_at.isoformat() if s.closed_at else None,
    }
    if include_entries:
        d["entries"] = [
            {
                "id": e.id, "direction": e.direction,
                "content": e.content,
                "timestamp": e.timestamp.isoformat() if e.timestamp else None,
            }
            for e in s.entries
        ]
    return d


def _get_session(db: Session, session_id: int, tenant_id: int) -> LiveSession:
    s = db.query(LiveSession).filter(
        LiveSession.id == session_id,
        LiveSession.tenant_id == tenant_id,
    ).first()
    if not s:
        raise HTTPException(status_code=404, detail="Session not found")
    return s


def _resolve_agent_by_token(db: Session, token: str) -> Agent:
    agent = db.query(Agent).filter(Agent.agent_token == token).first()
    if not agent:
        raise HTTPException(status_code=401, detail="Invalid agent token")
    return agent


def _expire_timed_out_sessions(db: Session) -> None:
    cutoff = datetime.utcnow() - timedelta(minutes=SESSION_TIMEOUT_MINUTES)
    db.query(LiveSession).filter(
        LiveSession.status == "open",
        LiveSession.opened_at < cutoff,
    ).update({"status": "timed_out", "closed_at": datetime.utcnow()})
    db.commit()


# ── Routes ────────────────────────────────────────────────────────────────────

@router.get("/sessions/")
def list_sessions(
    current_user: User = Depends(analyst_required),
    db: Session = Depends(get_db),
):
    _expire_timed_out_sessions(db)
    sessions = db.query(LiveSession).filter(
        LiveSession.tenant_id == current_user.tenant_id,
        LiveSession.status == "open",
    ).order_by(LiveSession.opened_at.desc()).all()
    return [_session_to_dict(s) for s in sessions]


@router.post("/sessions/", status_code=201)
def open_session(
    payload: OpenSessionPayload,
    current_user: User = Depends(admin_required),
    db: Session = Depends(get_db),
):
    agent = db.query(Agent).filter(
        Agent.id == payload.agent_id,
        Agent.tenant_id == current_user.tenant_id,
    ).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    if payload.shell_type not in ("cmd", "powershell", "bash"):
        raise HTTPException(status_code=422, detail="shell_type must be cmd, powershell, or bash")

    session = LiveSession(
        agent_id=payload.agent_id,
        initiator_id=current_user.id,
        tenant_id=current_user.tenant_id,
        shell_type=payload.shell_type,
        status="open",
        opened_at=datetime.utcnow(),
    )
    db.add(session)
    db.commit()
    db.refresh(session)

    log_event(db, current_user.tenant_id, "LIVE_SESSION_OPENED",
              user_id=current_user.id, user_name=current_user.name,
              resource_type="live_session", resource_id=session.id,
              details=f"Opened {payload.shell_type} session on agent {agent.hostname}")

    return _session_to_dict(session)


@router.get("/sessions/{session_id}")
def get_session(
    session_id: int,
    current_user: User = Depends(analyst_required),
    db: Session = Depends(get_db),
):
    session = _get_session(db, session_id, current_user.tenant_id)
    return _session_to_dict(session, include_entries=True)


@router.post("/sessions/{session_id}/input")
def send_input(
    session_id: int,
    payload: InputPayload,
    current_user: User = Depends(admin_required),
    db: Session = Depends(get_db),
):
    """Analyst sends a command to be executed on the remote agent."""
    session = _get_session(db, session_id, current_user.tenant_id)
    if session.status != "open":
        raise HTTPException(status_code=409, detail="Session is not open")

    entry = LiveSessionEntry(
        session_id=session.id,
        direction="input",
        content=payload.command,
        timestamp=datetime.utcnow(),
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)

    log_event(db, current_user.tenant_id, "LIVE_SESSION_INPUT",
              user_id=current_user.id, user_name=current_user.name,
              resource_type="live_session", resource_id=session.id,
              details=f"Command: {payload.command[:200]}")

    return {"id": entry.id, "timestamp": entry.timestamp.isoformat()}


@router.post("/sessions/{session_id}/output")
def upload_output(
    session_id: int,
    payload: OutputPayload,
    db: Session = Depends(get_db),
):
    """Agent uploads command output (authenticated via agent_token, not user JWT)."""
    agent = _resolve_agent_by_token(db, payload.agent_token)
    session = db.query(LiveSession).filter(
        LiveSession.id == session_id,
        LiveSession.agent_id == agent.id,
    ).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    if session.status != "open":
        raise HTTPException(status_code=409, detail="Session is not open")

    entry = LiveSessionEntry(
        session_id=session.id,
        direction="output",
        content=payload.content,
        timestamp=datetime.utcnow(),
    )
    db.add(entry)
    db.commit()
    return {"status": "ok"}


@router.get("/sessions/{session_id}/poll")
def poll_for_input(
    session_id: int,
    agent_token: str,
    db: Session = Depends(get_db),
):
    """Agent polls for pending (unresponded) commands. Returns the oldest unanswered input."""
    agent = _resolve_agent_by_token(db, agent_token)
    session = db.query(LiveSession).filter(
        LiveSession.id == session_id,
        LiveSession.agent_id == agent.id,
    ).first()
    if not session or session.status != "open":
        return {"pending": False}

    # Find the latest input entry
    last_input = (
        db.query(LiveSessionEntry)
        .filter(LiveSessionEntry.session_id == session_id,
                LiveSessionEntry.direction == "input")
        .order_by(LiveSessionEntry.timestamp.desc())
        .first()
    )
    if not last_input:
        return {"pending": False}

    # Check if there's already an output after this input
    output_after = (
        db.query(LiveSessionEntry)
        .filter(
            LiveSessionEntry.session_id == session_id,
            LiveSessionEntry.direction == "output",
            LiveSessionEntry.timestamp > last_input.timestamp,
        )
        .first()
    )
    if output_after:
        return {"pending": False}

    return {
        "pending": True,
        "entry_id": last_input.id,
        "command": last_input.content,
        "shell_type": session.shell_type,
    }


@router.post("/sessions/{session_id}/close", status_code=200)
def close_session(
    session_id: int,
    current_user: User = Depends(admin_required),
    db: Session = Depends(get_db),
):
    session = _get_session(db, session_id, current_user.tenant_id)
    session.status = "closed"
    session.closed_at = datetime.utcnow()
    db.commit()

    log_event(db, current_user.tenant_id, "LIVE_SESSION_CLOSED",
              user_id=current_user.id, user_name=current_user.name,
              resource_type="live_session", resource_id=session.id,
              details=f"Closed session {session_id}")

    return {"status": "closed"}

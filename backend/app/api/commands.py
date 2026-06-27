from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database.db import get_db
from app.core.permissions import admin_required, analyst_required
from app.models.agent import Agent
from app.models.command import Command
from app.models.user import User

from app.schemas.command_schema import *
from app.schemas.restorehost_schema import RestoreHostCommand

from app.services.command_service import (
    create_command
)

router = APIRouter(
    prefix="/commands",
    tags=["SOAR"]
)


@router.get("/")
def list_commands(
        agent_id: Optional[int] = Query(None),
        status: Optional[str] = Query(None),
        command_type: Optional[str] = Query(None),
        limit: int = Query(100, le=500),
        current_user: User = Depends(analyst_required),
        db: Session = Depends(get_db)):

    q = (
        db.query(Command, Agent.hostname)
        .join(Agent, Command.agent_id == Agent.id)
        .filter(Agent.tenant_id == current_user.tenant_id)
    )
    if agent_id:
        q = q.filter(Command.agent_id == agent_id)
    if status:
        q = q.filter(Command.status == status)
    if command_type:
        q = q.filter(Command.command_type == command_type)

    rows = q.order_by(Command.timestamp.desc()).limit(limit).all()

    return [
        {
            "id": cmd.id,
            "command_type": cmd.command_type,
            "argument": cmd.argument,
            "status": cmd.status,
            "result": cmd.result,
            "error": cmd.error,
            "timestamp": cmd.timestamp.isoformat() if cmd.timestamp else None,
            "completed_at": cmd.completed_at.isoformat() if cmd.completed_at else None,
            "agent_id": cmd.agent_id,
            "agent_hostname": hostname,
        }
        for cmd, hostname in rows
    ]


def validate_agent_access(
        db: Session,
        agent_id: int,
        current_user: User):

    agent = db.query(Agent).filter(
        Agent.id == agent_id,
        Agent.tenant_id == current_user.tenant_id
    ).first()

    if not agent:

        raise HTTPException(
            status_code=404,
            detail="Agent not found"
        )

    return agent


@router.post("/kill-process")
def kill_process(
        request: KillProcessCommand,
        current_user: User = Depends(admin_required),
        db: Session = Depends(get_db)):

    validate_agent_access(
        db,
        request.agent_id,
        current_user
    )

    command = create_command(

        db,

        "kill_process",

        str(request.pid),

        request.agent_id

    )

    try:
        from app.services.audit_service import log_event
        log_event(db, tenant_id=current_user.tenant_id, action="EXECUTE_COMMAND",
                  user_id=current_user.id, user_name=current_user.name,
                  resource_type="Command", resource_id=command.id,
                  details=f"kill_process PID={request.pid} on agent {request.agent_id}")
    except Exception:
        pass
    return command

@router.post("/isolate-host")
def isolate_host(
        request: IsolateHostCommand,
        current_user: User = Depends(admin_required),
        db: Session = Depends(get_db)):

    validate_agent_access(
        db,
        request.agent_id,
        current_user
    )

    command = create_command(db, "isolate_host", "", request.agent_id)

    try:
        from app.services.audit_service import log_event
        log_event(db, tenant_id=current_user.tenant_id, action="EXECUTE_COMMAND",
                  user_id=current_user.id, user_name=current_user.name,
                  resource_type="Command", resource_id=command.id,
                  details=f"isolate_host on agent {request.agent_id}")
    except Exception:
        pass
    return command

@router.post("/block-ip")
def block_ip(
        request: BlockIPCommand,
        current_user: User = Depends(admin_required),
        db: Session = Depends(get_db)):

    validate_agent_access(
        db,
        request.agent_id,
        current_user
    )

    command = create_command(

        db,

        "block_ip",

        request.ip_address,

        request.agent_id

    )

    return command

@router.post("/quarantine-file")
def quarantine_file(
        request: QuarantineFileCommand,
        current_user: User = Depends(admin_required),
        db: Session = Depends(get_db)):

    validate_agent_access(
        db,
        request.agent_id,
        current_user
    )

    command = create_command(

        db,

        "quarantine_file",

        request.file_path,

        request.agent_id

    )

    return command

@router.post("/restore-host")
def restore_host(
        request: RestoreHostCommand,
        current_user: User = Depends(admin_required),
        db: Session = Depends(get_db)):

    validate_agent_access(
        db,
        request.agent_id,
        current_user
    )

    command = create_command(

        db,

        "restore_host",

        "",

        request.agent_id

    )

    return command

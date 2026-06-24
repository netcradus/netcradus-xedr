from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database.db import get_db
from app.core.permissions import admin_required
from app.models.agent import Agent
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

    command = create_command(

        db,

        "isolate_host",

        "",

        request.agent_id

    )

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

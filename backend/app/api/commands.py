from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database.db import get_db

from app.schemas.command_schema import *

from app.services.command_service import (
    create_command
)

router = APIRouter(
    prefix="/commands",
    tags=["SOAR"]
)

@router.post("/kill-process")
def kill_process(
        request: KillProcessCommand,
        db: Session = Depends(get_db)):

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
        db: Session = Depends(get_db)):

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
        db: Session = Depends(get_db)):

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
        db: Session = Depends(get_db)):

    command = create_command(

        db,

        "quarantine_file",

        request.file_path,

        request.agent_id

    )

    return command
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database.db import get_db
from app.core.permissions import analyst_required

from app.schemas.agent_schema import AgentRegister
from app.schemas.command_schema import CommandCompleteRequest

from app.services.agent_service import register_agent
from app.models.command import Command
from app.models.agent import Agent
from app.models.user import User

from app.schemas.heartbeat_schema import (
    HeartbeatRequest
)

from app.services.agent_service import (
    update_heartbeat
)


router = APIRouter(

    prefix="/agents",

    tags=["Agents"]

)


@router.post("/register")
def create_agent(

        agent: AgentRegister,

        db: Session = Depends(
            get_db
        )):

    db_agent = register_agent(
        db,
        agent
    )

    return {

        "agent_id": db_agent.id,

        "agent_token": db_agent.agent_token

    }


@router.put("/commands/{command_id}/complete")
def complete_agent_command(
        command_id: int,
        request: CommandCompleteRequest,
        db: Session = Depends(get_db)):

    agent = db.query(Agent).filter(
        Agent.agent_token == request.agent_token
    ).first()

    if not agent:

        raise HTTPException(
            status_code=401,
            detail="Invalid agent token"
        )

    command = db.query(Command).filter(
        Command.id == command_id,
        Command.agent_id == agent.id
    ).first()

    if not command:

        raise HTTPException(
            status_code=404,
            detail="Command not found"
        )

    command.status = request.status
    command.result = request.result
    command.error = request.error
    command.completed_at = datetime.utcnow()

    db.commit()

    return {
        "status": command.status
    }


@router.get("/{agent_token}/commands")
def get_agent_commands(
        agent_token: str,
        db: Session = Depends(get_db)):

    agent = db.query(Agent).filter(
        Agent.agent_token == agent_token
    ).first()

    if not agent:
        return []

    commands = db.query(Command).filter(
        Command.agent_id == agent.id,
        Command.status == "Pending"
    ).all()

    return commands

@router.post("/heartbeat")
def heartbeat(
        request: HeartbeatRequest,
        db: Session = Depends(get_db)):

    success = update_heartbeat(
        db,
        request
    )

    if not success:

        return {
            "status":"invalid agent"
        }

    return {
        "status":"online"
    }

@router.get("/")
def get_agents(
        current_user: User = Depends(analyst_required),
        db: Session = Depends(get_db)):

    return db.query(
        Agent
    ).filter(
        Agent.tenant_id == current_user.tenant_id
    ).all()


@router.get("/online")
def get_online_agents(
        current_user: User = Depends(analyst_required),
        db: Session = Depends(get_db)):

    return db.query(
        Agent
    ).filter(
        Agent.tenant_id == current_user.tenant_id,
        Agent.status == "Online"
    ).all()

@router.get("/offline")
def get_offline_agents(
        current_user: User = Depends(analyst_required),
        db: Session = Depends(get_db)):

    return db.query(
        Agent
    ).filter(
        Agent.tenant_id == current_user.tenant_id,
        Agent.status == "Offline"
    ).all()

@router.get("/{agent_id}")
def get_agent(
        agent_id: int,
        current_user: User = Depends(analyst_required),
        db: Session = Depends(get_db)):

    agent = db.query(
        Agent
    ).filter(
        Agent.id == agent_id,
        Agent.tenant_id == current_user.tenant_id
    ).first()

    if not agent:

        raise HTTPException(
            status_code=404,
            detail="Agent not found"
        )

    return agent

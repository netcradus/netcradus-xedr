from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database.db import get_db

from app.schemas.agent_schema import AgentRegister

from app.services.agent_service import register_agent
from app.models.command import Command
from app.models.agent import Agent

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
        db: Session = Depends(get_db)):

    return db.query(
        Agent
    ).all()


@router.get("/online")
def get_online_agents(
        db: Session = Depends(get_db)):

    return db.query(
        Agent
    ).filter(
        Agent.status == "Online"
    ).all()

@router.get("/offline")
def get_offline_agents(
        db: Session = Depends(get_db)):

    return db.query(
        Agent
    ).filter(
        Agent.status == "Offline"
    ).all()

@router.get("/{agent_id}")
def get_agent(
        agent_id: int,
        db: Session = Depends(get_db)):

    return db.query(
        Agent
    ).filter(
        Agent.id == agent_id
    ).first()
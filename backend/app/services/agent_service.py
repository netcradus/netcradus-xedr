import secrets

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.agent import Agent
from app.models.tenant import Tenant

from app.schemas.agent_schema import AgentRegister
from datetime import datetime, timedelta

def register_agent(
        db: Session,
        agent: AgentRegister):

    if (
        settings.agent_registration_token
        and agent.registration_token != settings.agent_registration_token
    ):

        raise HTTPException(
            status_code=401,
            detail="Invalid agent registration token"
        )

    tenant = db.query(
        Tenant
    ).filter(
        Tenant.name == "Default"
    ).first()

    db_agent = Agent(

        hostname=agent.hostname,

        ip_address=agent.ip_address,

        os_type=agent.os_type,

        agent_version=agent.agent_version,

        agent_token=secrets.token_hex(32),

        tenant_id=tenant.id

    )

    db.add(db_agent)

    db.commit()

    db.refresh(db_agent)

    return db_agent

from datetime import datetime


def update_heartbeat(
        db,
        request):

    agent = db.query(
        Agent
    ).filter(
        Agent.agent_token ==
        request.agent_token
    ).first()

    if not agent:
        return False

    agent.hostname = request.hostname

    agent.os_type = request.os_type

    agent.ip_address = request.ip_address

    agent.last_seen = datetime.utcnow()

    agent.status = "Online"

    db.commit()

    return True


def update_offline_agents(db):

    threshold = datetime.utcnow() - timedelta(seconds=30)

    agents = db.query(Agent).all()

    for agent in agents:

        if (
            agent.last_seen and
            agent.last_seen < threshold
        ):

            agent.status = "Offline"

    db.commit()

import secrets

from sqlalchemy.orm import Session

from app.models.agent import Agent
from app.models.tenant import Tenant

from app.schemas.agent_schema import AgentRegister


def register_agent(
        db: Session,
        agent: AgentRegister):

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
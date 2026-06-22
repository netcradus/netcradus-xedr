import secrets

from sqlalchemy.orm import Session

from app.models.tenant import Tenant


def create_default_tenant(db: Session):

    tenant = db.query(Tenant).filter(
        Tenant.name == "Default"
    ).first()

    if tenant:
        return tenant

    tenant = Tenant(

        name="Default",

        api_key=secrets.token_hex(32)

    )

    db.add(tenant)

    db.commit()

    db.refresh(tenant)

    return tenant
from sqlalchemy.orm import Session
from app.models.user import User
from app.schemas.user_schema import UserCreate
from app.core.security import hash_password
from app.core.security import verify_password
from app.models.role import Role
from app.models.tenant import Tenant


def create_user(db: Session, user: UserCreate):

    existing_user = db.query(User).filter(
        User.email == user.email
    ).first()

    if existing_user:
        return None
    
    default_role = db.query(Role).filter(
        Role.name == "Viewer"
    ).first()

    if not default_role:
        raise Exception(
            "Viewer role does not exist. Seed roles first."
        )
    
    default_tenant = db.query(
        Tenant
    ).filter(
        Tenant.name == "Default"
    ).first()

    db_user = User(

        name=user.name,

        email=user.email,

        password=hash_password(
            user.password
        ),

        role_id=default_role.id,

        tenant_id=default_tenant.id

    )


    db.add(db_user)
    db.commit()
    db.refresh(db_user)

    return db_user

def authenticate_user(
        db: Session,
        email: str,
        password: str):

    user = db.query(User).filter(
        User.email == email
    ).first()

    if not user:
        return None

    if not verify_password(
            password,
            user.password):
        return None

    return user
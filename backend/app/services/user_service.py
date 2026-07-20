from sqlalchemy.orm import Session
from app.models.user import User
from app.schemas.user_schema import UserCreate
from app.core.security import hash_password
from app.core.security import verify_password
from app.models.role import Role
from app.models.tenant import Tenant
from app.core.config import settings

# Precomputed bcrypt hash of a random, unused value — verified against on every
# login for an email that doesn't exist so that "no such user" and "wrong
# password" take the same amount of time (bcrypt dominates the timing signal;
# skipping it when the email is unknown lets an attacker enumerate valid
# accounts by measuring response latency against /auth/login).
_DUMMY_HASH = hash_password("netcradxdr-timing-guard-" + "x" * 32)


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

    # Auto-verify when SMTP is not configured (dev / no-email environments) —
    # keeps this legacy path consistent with /auth/register.
    smtp_enabled = bool(settings.smtp_host and settings.smtp_host.strip())

    db_user = User(

        name=user.name,

        email=user.email,

        password=hash_password(
            user.password
        ),

        role_id=default_role.id,

        tenant_id=default_tenant.id,

        email_verified=not smtp_enabled

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
        # Burn the same bcrypt-verify time as a real login so response
        # latency can't be used to enumerate registered emails.
        verify_password(password, _DUMMY_HASH)
        return None

    if not verify_password(
            password,
            user.password):
        return None

    return user
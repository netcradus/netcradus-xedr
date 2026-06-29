import os
from sqlalchemy.orm import Session
from app.models.user import User
from app.models.role import Role
from app.core.security import hash_password


def seed_platform_admin(db: Session) -> None:
    """Create the platform admin account from env vars if it doesn't exist yet."""
    email = os.getenv("PLATFORM_ADMIN_EMAIL", "").strip().lower()
    password = os.getenv("PLATFORM_ADMIN_PASSWORD", "").strip()

    if not email or not password:
        return

    if db.query(User).filter(User.email == email).first():
        return

    role = db.query(Role).filter(Role.name == "PlatformAdmin").first()
    if not role:
        return

    admin = User(
        name="Platform Admin",
        email=email,
        password=hash_password(password),
        role_id=role.id,
        tenant_id=None,
        email_verified=True,
        is_active=True,
    )
    db.add(admin)
    db.commit()
    print(f"[startup] Platform admin created: {email}")

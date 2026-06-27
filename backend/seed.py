import secrets
from app.database.db import SessionLocal
from app.models.user import User
from app.models.role import Role
from app.models.tenant import Tenant
from app.core.security import hash_password

db = SessionLocal()

try:
    # 1. Seed roles
    for role_name in ["SuperAdmin", "Admin", "Analyst", "Viewer"]:
        if not db.query(Role).filter(Role.name == role_name).first():
            db.add(Role(name=role_name))
    db.flush()

    # 2. Ensure Default tenant exists
    tenant = db.query(Tenant).filter(Tenant.name == "Default").first()
    if not tenant:
        print("Creating 'Default' tenant...")
        tenant = Tenant(name="Default", api_key=secrets.token_hex(32))
        db.add(tenant)
        db.flush()
    else:
        print("Found existing 'Default' tenant.")

    # 3. Ensure SuperAdmin user exists
    superadmin_role = db.query(Role).filter(Role.name == "SuperAdmin").first()
    admin = db.query(User).filter(User.email == "admin@netcradus.com").first()

    if not admin:
        print("Creating SuperAdmin user...")
        db.add(User(
            name="Super Admin",
            email="admin@netcradus.com",
            password=hash_password("Admin@1234"),
            role_id=superadmin_role.id,
            tenant_id=tenant.id,
            is_active=True,
        ))
        db.commit()
        print("Done — login: admin@netcradus.com / Admin@1234")
    else:
        print("SuperAdmin already exists.")
        db.commit()

finally:
    db.close()

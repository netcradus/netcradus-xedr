from sqlalchemy.orm import Session
from app.models.role import Role


def seed_roles(db: Session):

    roles = [
        "SuperAdmin",
        "Admin",
        "Analyst",
        "Viewer"
    ]

    for role_name in roles:

        exists = db.query(Role).filter(
            Role.name == role_name
        ).first()

        if not exists:

            role = Role(
                name=role_name
            )

            db.add(role)

    db.commit()
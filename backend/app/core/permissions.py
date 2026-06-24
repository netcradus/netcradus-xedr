from fastapi import Depends, HTTPException

from app.models.user import User
from app.core.dependencies import get_current_user


def superadmin_required(
        current_user: User = Depends(
            get_current_user
        )):

    if current_user.role.name != "SuperAdmin":

        raise HTTPException(
            status_code=403,
            detail="SuperAdmin privileges required"
        )

    return current_user


def admin_required(
        current_user: User = Depends(
            get_current_user
        )):

    allowed_roles = [
        "SuperAdmin",
        "Admin"
    ]

    if current_user.role.name not in allowed_roles:

        raise HTTPException(
            status_code=403,
            detail="Admin privileges required"
        )

    return current_user


def analyst_required(
        current_user: User = Depends(
            get_current_user
        )):

    allowed_roles = [
        "SuperAdmin",
        "Admin",
        "Analyst"
    ]

    if current_user.role.name not in allowed_roles:

        raise HTTPException(
            status_code=403,
            detail="Analyst privileges required"
        )

    return current_user
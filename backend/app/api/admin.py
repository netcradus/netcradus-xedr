from fastapi import APIRouter, Depends

from app.models.user import User
from app.core.permissions import admin_required

router = APIRouter(
    prefix="/admin",
    tags=["Admin"]
)


@router.get("/dashboard")
def admin_dashboard(

        current_user: User = Depends(
            admin_required
        )):

    return {

        "message":
        f"Welcome {current_user.name}",

        "role":
        current_user.role.name

    }
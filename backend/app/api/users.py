from fastapi import APIRouter, Depends

from app.models.user import User
from app.core.dependencies import get_current_user

router = APIRouter(
    prefix="/users",
    tags=["Users"]
)


@router.get("/me")
def get_me(
    current_user: User = Depends(get_current_user)
):

    return {
        "id": current_user.id,
        "name": current_user.name,
        "email": current_user.email,
        "is_active": current_user.is_active,
        "role": {
            "id": current_user.role_id,
            "name": current_user.role.name if current_user.role else "Viewer",
        },
        "tenant": {
            "id": current_user.tenant_id,
            "name": current_user.tenant.name if current_user.tenant else "",
            "is_active": current_user.tenant.is_active if current_user.tenant else True,
        },
    }
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

    "role": current_user.role.name,

    "tenant": current_user.tenant.name,

    "is_active": current_user.is_active

}
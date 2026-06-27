from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.database.db import get_db
from app.schemas.user_schema import UserCreate
from app.services.user_service import create_user
# Note: UserLogin is no longer needed for the login route, but you can keep it if used elsewhere.
from app.services.user_service import authenticate_user
from app.core.security import create_access_token

router = APIRouter(
    prefix="/auth",
    tags=["Authentication"]
)

@router.post("/signup")
def signup(
    user: UserCreate,
    db: Session = Depends(get_db)
):
    db_user = create_user(db, user)

    if db_user is None:
        raise HTTPException(
            status_code=400,
            detail="Email already registered"
        )

    return {
        "message": "User created successfully"
    }

@router.post("/login")
def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db)
):
    # OAuth2PasswordRequestForm maps the credentials to form_data.username and form_data.password
    db_user = authenticate_user(
        db,
        form_data.username,  # This will contain the email entered in Swagger
        form_data.password
    )

    if not db_user:
        raise HTTPException(
            status_code=401,
            detail="Invalid credentials"
        )

    token = create_access_token({"sub": db_user.email})

    try:
        from app.services.audit_service import log_event
        log_event(db, tenant_id=db_user.tenant_id, action="LOGIN",
                  user_id=db_user.id, user_name=db_user.name,
                  resource_type="User", resource_id=db_user.id,
                  details=f"Successful login")
    except Exception:
        pass

    return {"access_token": token, "token_type": "bearer"}
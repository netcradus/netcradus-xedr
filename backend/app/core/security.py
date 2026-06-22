from datetime import datetime, timedelta, timezone
from jose import jwt
from pwdlib import PasswordHash
from pwdlib.hashers.bcrypt import BcryptHasher
from fastapi.security import OAuth2PasswordBearer

# This tells FastAPI that the token should be fetched from the "/auth/login" endpoint
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login")

# Updated: Using pwdlib explicitly configured with BcryptHasher
pwd_context = PasswordHash([BcryptHasher()])

SECRET_KEY = "your-super-secret-key"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60


def hash_password(password: str) -> str:
    """Hashes a plain-text password using Bcrypt."""
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verifies a plain-text password against its stored hash."""
    return pwd_context.verify(plain_password, hashed_password)


def create_access_token(data: dict) -> str:
    """Generates a secure JWT access token."""
    to_encode = data.copy()

    # Updated: Replaced deprecated datetime.utcnow() with zone-aware UTC time
    expire = datetime.now(timezone.utc) + timedelta(
        minutes=ACCESS_TOKEN_EXPIRE_MINUTES
    )

    to_encode.update({"exp": expire})

    return jwt.encode(
        to_encode,
        SECRET_KEY,
        algorithm=ALGORITHM
    )
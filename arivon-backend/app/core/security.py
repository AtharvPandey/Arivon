"""
Two jobs here:
1. Hash passwords (never store plain-text passwords, ever)
2. Create and verify JWT tokens (how the API knows who's logged in on
   every request, without checking the database every single time)
"""

from datetime import datetime, timedelta
from jose import jwt, JWTError
from passlib.context import CryptContext
from app.core.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def create_access_token(data: dict, expires_delta: timedelta | None = None) -> str:
    """
    Packs data (e.g. {"user_id": 1, "school_id": 3, "role": "teacher"})
    into a signed token. The frontend stores this token and sends it
    back on every request in the Authorization header.

    expires_delta is optional and defaults to the normal login lifetime
    — only School Impersonation passes a shorter one explicitly; every
    existing call site is unaffected.
    """
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=settings.access_token_expire_minutes))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.secret_key, algorithm=settings.algorithm)


def decode_access_token(token: str) -> dict | None:
    try:
        return jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
    except JWTError:
        return None

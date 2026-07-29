"""
Shared FastAPI dependencies. The important one is get_current_user:
add it to any endpoint and FastAPI will automatically reject requests
that don't have a valid login token, and hand you the logged-in User
object if they do.
"""

from fastapi import Depends, HTTPException, status, Header
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.database import get_db
from app.core.security import decode_access_token
from app import models

# This tells FastAPI/Swagger where the login endpoint is, so the
# "Authorize" button in the docs UI knows where to send credentials.
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login")


def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> models.User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    payload = decode_access_token(token)
    if payload is None:
        raise credentials_exception

    user_id = payload.get("user_id")
    if user_id is None:
        raise credentials_exception

    user = db.query(models.User).filter(models.User.id == user_id).first()
    if user is None or not user.is_active:
        raise credentials_exception

    # This check runs on EVERY request, not just at login — so suspending
    # a school takes effect immediately for anyone already logged in,
    # rather than only blocking future login attempts.
    if not user.school.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This school's account has been suspended. Contact Arivon support.",
        )

    return user


def require_roles(*allowed_roles: str):
    """
    Dependency factory: restricts an endpoint to specific roles.

    Usage:
        @router.get("/something", dependencies=[Depends(require_roles("principal", "administrator"))])

    This is the mechanism that makes "Finance logs in and only sees fee
    stuff" or "only Principal sees the school-wide dashboard" actually
    enforced by the backend — not just hidden in the frontend (which a
    determined user could bypass by calling the API directly).
    """
    def checker(current_user: models.User = Depends(get_current_user)) -> models.User:
        if current_user.role.name not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"This action requires one of these roles: {', '.join(allowed_roles)}",
            )
        return current_user
    return checker


platform_oauth2_scheme = OAuth2PasswordBearer(tokenUrl="platform/auth/login")


def get_current_platform_admin(
    token: str = Depends(platform_oauth2_scheme),
    db: Session = Depends(get_db),
) -> models.PlatformAdmin:
    """
    Completely separate identity check from get_current_user. A regular
    school-user token will NOT satisfy this — it has no
    "platform_admin_id" claim — and a platform admin token will not
    satisfy get_current_user either. The two identity systems don't
    overlap, by design.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate platform admin credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    payload = decode_access_token(token)
    if payload is None:
        raise credentials_exception

    platform_admin_id = payload.get("platform_admin_id")
    if platform_admin_id is None:
        raise credentials_exception

    admin = db.query(models.PlatformAdmin).filter(
        models.PlatformAdmin.id == platform_admin_id
    ).first()
    if admin is None or not admin.is_active:
        raise credentials_exception

    return admin


def get_document_downloader(
    authorization: str | None = Header(None),
    db: Session = Depends(get_db),
):
    """
    Fix for a real gap found during the Register School production
    readiness review: the document download endpoint previously had NO
    authentication at all — any document_id could be downloaded by
    anyone, including compliance certificates, PANs, and affiliation
    documents. This accepts EITHER a school-user token or a Platform
    Admin token (both are legitimate downloaders of a document, unlike
    every other endpoint which is exclusively one or the other), and
    returns which kind of actor it is so the caller can still enforce
    school-scoped access for school users.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Not authenticated",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if not authorization or not authorization.lower().startswith("bearer "):
        raise credentials_exception

    token = authorization.split(" ", 1)[1]
    payload = decode_access_token(token)
    if payload is None:
        raise credentials_exception

    if "platform_admin_id" in payload:
        admin = db.query(models.PlatformAdmin).filter(
            models.PlatformAdmin.id == payload["platform_admin_id"]
        ).first()
        if admin is None or not admin.is_active:
            raise credentials_exception
        return ("platform_admin", admin)

    if "user_id" in payload:
        user = db.query(models.User).filter(models.User.id == payload["user_id"]).first()
        if user is None or not user.is_active:
            raise credentials_exception
        return ("user", user)

    raise credentials_exception

"""
Platform admin login. Deliberately NO public registration endpoint here —
"only we have this access" means platform admin accounts are created via
a one-time bootstrap script (see scripts/create_platform_admin.py), not
through any API a person could stumble onto or brute-force their way into.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.database import get_db
from app import models, schemas
from app.core.security import verify_password, create_access_token
from app.core.deps import get_current_platform_admin

router = APIRouter(prefix="/platform/auth", tags=["platform-auth"])


@router.post("/login", response_model=schemas.Token)
def platform_login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    admin = db.query(models.PlatformAdmin).filter(
        models.PlatformAdmin.email == form_data.username
    ).first()

    if not admin or not verify_password(form_data.password, admin.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )

    # Note: NO "role" or "school_id" claim — this token is structurally
    # different from a school-user token, on purpose.
    token = create_access_token(data={"platform_admin_id": admin.id})
    return schemas.Token(access_token=token)


@router.get("/me", response_model=schemas.PlatformAdminOut)
def read_current_platform_admin(current_admin: models.PlatformAdmin = Depends(get_current_platform_admin)):
    return current_admin

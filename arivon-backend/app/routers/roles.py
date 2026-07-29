"""
Read-only view of the roles that exist on the platform. This powers the
"Roles & Permissions" screen — which for now is informational (showing
what each role can do, based on the same role names our RBAC dependencies
already check everywhere), not a role editor. Building a true custom-
permission editor is a bigger future piece; today, permissions are
defined in code (see require_roles() calls throughout the routers),
which is safer than an admin accidentally editing their way into a
broken permission set.
"""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app import models, schemas
from app.core.deps import get_current_user

router = APIRouter(prefix="/roles", tags=["roles"])


@router.get("/", response_model=list[schemas.RoleOut])
def list_roles(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    return db.query(models.Role).all()

"""
/auth/register  -> School Admin creates a staff account for their OWN
                    school. This is the entire "who can create whom"
                    architecture in one place: Arivon (the platform)
                    creates the school and its one School Admin account
                    (see platform.py / school_registration.py) — nothing
                    else ever creates a School Admin. From there, that
                    School Admin is the sole authority who creates every
                    other account (Principal, Teacher, Accountant, etc.)
                    for their own school. This endpoint used to be
                    completely open with no authentication at all,
                    letting anyone create a user for any school with any
                    role — that's fixed here.
/auth/login     -> exchange email+password for a JWT token
/auth/me        -> "who am I" — proves the token round-trip works
"""

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.database import get_db
from app import models, schemas
from app.core.security import hash_password, verify_password, create_access_token
from app.core.deps import get_current_user, require_roles

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post(
    "/register", response_model=schemas.UserOut, status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_roles("school_admin"))],
)
def register(payload: schemas.UserRegister, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    # school_id is deliberately NOT taken from the request body — it's
    # the current School Admin's own school, always. Otherwise a School
    # Admin could create accounts inside a DIFFERENT school just by
    # passing a different school_id, which would be a real cross-tenant
    # security hole.
    school = db.query(models.School).filter(models.School.id == current_user.school_id).first()
    if not school:
        raise HTTPException(status_code=404, detail="School not found")

    if payload.role_name == "school_admin":
        raise HTTPException(
            status_code=400,
            detail="A school has exactly one School Admin, created by Arivon at registration — it can't be created here.",
        )

    # 2. Make sure the email isn't already taken
    existing = db.query(models.User).filter(models.User.email == payload.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    # 3. Look up the role by name (e.g. "teacher")
    role = db.query(models.Role).filter(models.Role.name == payload.role_name).first()
    if not role:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown role '{payload.role_name}'. Valid roles must be seeded first.",
        )

    # 4. Create the user with a HASHED password (never store plain text)
    user = models.User(
        school_id=current_user.school_id,
        role_id=role.id,
        full_name=payload.full_name,
        email=payload.email,
        hashed_password=hash_password(payload.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.post("/login", response_model=schemas.Token)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    # OAuth2PasswordRequestForm expects fields named "username" and "password"
    # (that's a FastAPI/OAuth2 convention) — we treat "username" as the email.
    user = db.query(models.User).filter(models.User.email == form_data.username).first()

    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )

    # Lifecycle-aware gate — replaces the old is_active-only check.
    # is_active is still kept in sync as a derived convenience field, but
    # lifecycle_status is the actual source of truth (see
    # SchoolLifecycleService), and each blocked state gets a message that
    # tells the person what's actually happening, not just "forbidden".
    lifecycle_status = user.school.lifecycle_status or "draft"
    LOGIN_BLOCKED_MESSAGES = {
        "draft": "This school's registration hasn't been completed yet.",
        "pending_verification": "This school is awaiting verification by the Arivon team. You'll be notified once it's approved.",
        "rejected": "This school's verification was not approved. Contact Arivon support for details.",
        "suspended": "This school's account has been suspended. Contact Arivon support.",
        "closed": "This school's account has been closed.",
    }
    if lifecycle_status in LOGIN_BLOCKED_MESSAGES:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=LOGIN_BLOCKED_MESSAGES[lifecycle_status],
        )

    # This check was missing entirely — the block above only covers the
    # whole SCHOOL being suspended/closed, never an individual staff
    # member's own account being revoked. Without this, deactivating one
    # person's access here had literally no effect on their ability to
    # log in.
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="ACCOUNT_DEACTIVATED: Your account access has been revoked. Please contact your School Admin.",
        )

    token = create_access_token(
        data={"user_id": user.id, "school_id": user.school_id, "role": user.role.name}
    )
    return schemas.Token(access_token=token)


@router.get("/me", response_model=schemas.UserOut)
def read_current_user(current_user: models.User = Depends(get_current_user)):
    return current_user

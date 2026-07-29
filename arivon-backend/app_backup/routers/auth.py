"""
/auth/register  -> create a new staff user under a school
/auth/login     -> exchange email+password for a JWT token
/auth/me        -> "who am I" — proves the token round-trip works
"""

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.database import get_db
from app import models, schemas
from app.core.security import hash_password, verify_password, create_access_token
from app.core.deps import get_current_user

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=schemas.UserOut, status_code=status.HTTP_201_CREATED)
def register(payload: schemas.UserRegister, db: Session = Depends(get_db)):
    # 1. Make sure the school actually exists
    school = db.query(models.School).filter(models.School.id == payload.school_id).first()
    if not school:
        raise HTTPException(status_code=404, detail="School not found")

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
        school_id=payload.school_id,
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

    token = create_access_token(
        data={"user_id": user.id, "school_id": user.school_id, "role": user.role.name}
    )
    return schemas.Token(access_token=token)


@router.get("/me", response_model=schemas.UserOut)
def read_current_user(current_user: models.User = Depends(get_current_user)):
    return current_user

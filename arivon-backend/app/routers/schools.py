"""
School lookups and profile management. Creation happens exclusively
through the Platform Super Admin (POST /platform/schools). This router
handles read-only lookups plus letting a School Admin edit their own
school's profile — identity, government recognition, contact details,
academic configuration, and branding.
"""

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
import os
import uuid

from app.database import get_db
from app import models, schemas
from app.core.deps import require_roles

SCHOOL_PROFILE_ROLES = ("school_admin", "administrator", "super_admin")

router = APIRouter(prefix="/schools", tags=["schools"])


@router.get("/", response_model=list[schemas.SchoolOut])
def list_schools(db: Session = Depends(get_db)):
    return db.query(models.School).all()


@router.get("/{school_id}", response_model=schemas.SchoolOut)
def get_school(school_id: int, db: Session = Depends(get_db)):
    return db.query(models.School).filter(models.School.id == school_id).first()


@router.patch(
    "/{school_id}",
    response_model=schemas.SchoolOut,
    dependencies=[Depends(require_roles(*SCHOOL_PROFILE_ROLES))],
)
def update_school_profile(
    school_id: int,
    payload: schemas.SchoolUpdate,
    db: Session = Depends(get_db),
):
    school = db.query(models.School).filter(models.School.id == school_id).first()
    if not school:
        raise HTTPException(status_code=404, detail="School not found")

    updates = payload.model_dump(exclude_unset=True)
    for field, value in updates.items():
        setattr(school, field, value)

    db.commit()
    db.refresh(school)
    return school


@router.post(
    "/{school_id}/logo",
    response_model=schemas.SchoolOut,
    dependencies=[Depends(require_roles(*SCHOOL_PROFILE_ROLES))],
)
async def upload_school_logo(school_id: int, file: UploadFile = File(...), db: Session = Depends(get_db)):
    """Same unauthenticated-static-serving pattern as student/staff
    photos — a school logo needs to render in plain <img> tags across
    the Topbar and every printed document, not just this profile page."""
    ALLOWED_IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".svg"}
    MAX_LOGO_SIZE_BYTES = 3 * 1024 * 1024

    school = db.query(models.School).filter(models.School.id == school_id).first()
    if not school:
        raise HTTPException(status_code=404, detail="School not found")

    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in ALLOWED_IMAGE_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Logo must be a JPG, PNG, or SVG file")

    contents = await file.read()
    if len(contents) > MAX_LOGO_SIZE_BYTES:
        raise HTTPException(status_code=400, detail=f"Logo is too large ({len(contents) / 1024 / 1024:.1f}MB). Maximum size is 3MB.")

    logo_dir = "uploads/photos"
    os.makedirs(logo_dir, exist_ok=True)
    stored_filename = f"{uuid.uuid4().hex}{ext}"
    with open(os.path.join(logo_dir, stored_filename), "wb") as f:
        f.write(contents)

    school.logo_url = f"/uploads/photos/{stored_filename}"
    db.commit()
    db.refresh(school)
    return school


@router.get("/by-slug/{slug}", response_model=schemas.SchoolPublicOut)
def get_school_by_slug(slug: str, db: Session = Depends(get_db)):
    """
    Deliberately NO auth on this one — it powers the branded login page
    at /{slug}/login, which a visitor hits before they've logged in at
    all. Returns only what a login screen needs to show (name, logo,
    board type), nothing a stranger shouldn't see about the school.
    """
    school = db.query(models.School).filter(models.School.slug == slug).first()
    if not school:
        raise HTTPException(status_code=404, detail="No school found with this URL. Check the link and try again.")
    return school

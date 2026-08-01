from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
import os
import uuid

from app.database import get_db
from app import models, schemas
from app.core.deps import get_current_user, require_roles
from app.core.security import hash_password
from app.core.temp_password_utils import generate_temp_password, temp_password_expiry

router = APIRouter(prefix="/staff", tags=["staff"])

HR_ROLES = ("school_admin", "principal", "vice_principal", "administrator", "super_admin")


@router.post("/profile", response_model=schemas.StaffProfileOut, status_code=201)
def create_staff_profile(payload: schemas.StaffProfileCreate, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.id == payload.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    existing = db.query(models.StaffProfile).filter(
        models.StaffProfile.user_id == payload.user_id
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Staff profile already exists for this user")

    profile = models.StaffProfile(**payload.model_dump())
    db.add(profile)
    db.commit()
    db.refresh(profile)
    return profile


@router.get("/profile/{user_id}", response_model=schemas.StaffProfileOut)
def get_staff_profile(user_id: int, db: Session = Depends(get_db)):
    profile = db.query(models.StaffProfile).filter(
        models.StaffProfile.user_id == user_id
    ).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Staff profile not found")
    return profile


@router.patch(
    "/profile/{user_id}", response_model=schemas.StaffProfileOut,
    dependencies=[Depends(require_roles(*HR_ROLES))],
)
def update_staff_profile(user_id: int, payload: schemas.StaffProfileUpdate, db: Session = Depends(get_db)):
    """Genuinely partial — same pattern as StudentUpdate. This endpoint
    didn't exist at all before; there was no way to edit a staff
    member's HR details (designation, department, bank info, emergency
    contact) once their profile was first created."""
    profile = db.query(models.StaffProfile).filter(models.StaffProfile.user_id == user_id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Staff profile not found")

    updates = payload.model_dump(exclude_unset=True)
    for field, value in updates.items():
        setattr(profile, field, value)

    db.commit()
    db.refresh(profile)
    return profile


@router.get(
    "/profile/{user_id}/bank-details", response_model=schemas.StaffBankDetails,
    dependencies=[Depends(require_roles("accountant", "school_admin"))],
)
def get_staff_bank_details(user_id: int, db: Session = Depends(get_db)):
    """Finance-only, same pattern as students' bank details endpoint —
    Aadhaar/PAN/bank account numbers never appear in the general staff
    profile view regardless of who's looking."""
    profile = db.query(models.StaffProfile).filter(models.StaffProfile.user_id == user_id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Staff profile not found")
    return profile


@router.post(
    "/profile/{user_id}/photo", response_model=schemas.StaffProfileOut,
    dependencies=[Depends(require_roles(*HR_ROLES))],
)
async def upload_staff_photo(user_id: int, file: UploadFile = File(...), db: Session = Depends(get_db)):
    """Same dedicated, simple, unauthenticated-static-serving pattern as
    student photos — a staff photo needs plain <img src> compatibility
    across the Directory and profile pages."""
    ALLOWED_IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png"}
    MAX_PHOTO_SIZE_BYTES = 3 * 1024 * 1024

    profile = db.query(models.StaffProfile).filter(models.StaffProfile.user_id == user_id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Staff profile not found")

    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in ALLOWED_IMAGE_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Photo must be a JPG or PNG file")

    contents = await file.read()
    if len(contents) > MAX_PHOTO_SIZE_BYTES:
        raise HTTPException(status_code=400, detail=f"Photo is too large ({len(contents) / 1024 / 1024:.1f}MB). Maximum size is 3MB.")

    photo_dir = "uploads/photos"
    os.makedirs(photo_dir, exist_ok=True)
    stored_filename = f"{uuid.uuid4().hex}{ext}"
    with open(os.path.join(photo_dir, stored_filename), "wb") as f:
        f.write(contents)

    profile.photo_url = f"/uploads/photos/{stored_filename}"
    db.commit()
    db.refresh(profile)
    return profile


@router.get("/{user_id}/teaching-load", response_model=list[schemas.TeachingLoadItem])
def get_teaching_load(user_id: int, db: Session = Depends(get_db)):
    """
    Subjects and classes/sections a teacher actually teaches — derived
    from the Timetable (TimetableSlot.teacher_id), which already carries
    this information; this just aggregates it into a "my teaching load"
    view instead of leaving it buried inside the raw weekly schedule.
    """
    slots = db.query(models.TimetableSlot).filter(models.TimetableSlot.teacher_id == user_id).all()

    load: dict[tuple, int] = {}
    section_cache, class_cache, subject_cache = {}, {}, {}
    for slot in slots:
        section = section_cache.get(slot.section_id) or db.query(models.Section).filter(
            models.Section.id == slot.section_id
        ).first()
        section_cache[slot.section_id] = section
        school_class = class_cache.get(section.school_class_id) or db.query(models.SchoolClass).filter(
            models.SchoolClass.id == section.school_class_id
        ).first()
        class_cache[section.school_class_id] = school_class
        subject = subject_cache.get(slot.subject_id) or db.query(models.Subject).filter(
            models.Subject.id == slot.subject_id
        ).first()
        subject_cache[slot.subject_id] = subject

        key = (subject.name, school_class.name, section.name)
        load[key] = load.get(key, 0) + 1

    return [
        schemas.TeachingLoadItem(subject_name=k[0], class_name=k[1], section_name=k[2], periods_per_week=v)
        for k, v in load.items()
    ]


@router.get("/", response_model=list[schemas.StaffMemberOut])
def list_staff(school_id: int, role_name: str | None = None, db: Session = Depends(get_db)):
    """
    Powers both "Teachers" (role_name=teacher) and "Staff" (no filter,
    everyone) in the People section — same underlying data, different
    filter, so we don't need two separate endpoints for what's really
    one query with an optional WHERE clause.
    """
    query = db.query(models.User).join(models.Role).filter(models.User.school_id == school_id)
    if role_name:
        query = query.filter(models.Role.name == role_name)
    users = query.all()

    results = []
    for user in users:
        profile = db.query(models.StaffProfile).filter(
            models.StaffProfile.user_id == user.id
        ).first()
        results.append(schemas.StaffMemberOut(
            id=user.id,
            full_name=user.full_name,
            email=user.email,
            role_name=user.role_name,
            is_active=user.is_active,
            employee_id=profile.employee_id if profile else None,
            designation=profile.designation if profile else None,
            department=profile.department if profile else None,
            photo_url=profile.photo_url if profile else None,
        ))
    return results


@router.patch(
    "/{user_id}/access", response_model=schemas.StaffMemberOut,
    dependencies=[Depends(require_roles("school_admin"))],
)
def set_staff_access(user_id: int, is_active: bool, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    """
    Revoke or restore a staff member's login access. Restricted to
    School Admin only — not the broader HR_ROLES tuple — matching the
    architecture where School Admin is the sole authority who manages
    every other account. A revoked account can no longer log in at all
    (see the is_active check added to /auth/login); their existing
    records (attendance marked, fees collected, etc.) are untouched.
    """
    target = db.query(models.User).filter(models.User.id == user_id, models.User.school_id == current_user.school_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="Staff member not found")
    if target.role_name == "school_admin":
        raise HTTPException(status_code=400, detail="The School Admin account cannot be deactivated.")
    if target.id == current_user.id:
        raise HTTPException(status_code=400, detail="You cannot change your own access.")

    target.is_active = is_active
    db.commit()
    db.refresh(target)

    profile = db.query(models.StaffProfile).filter(models.StaffProfile.user_id == target.id).first()
    return schemas.StaffMemberOut(
        id=target.id, full_name=target.full_name, email=target.email, role_name=target.role_name,
        is_active=target.is_active, employee_id=profile.employee_id if profile else None,
        designation=profile.designation if profile else None, department=profile.department if profile else None,
        photo_url=profile.photo_url if profile else None,
    )


@router.post(
    "/{user_id}/reset-password", response_model=schemas.UserCreatedOut,
    dependencies=[Depends(require_roles("school_admin"))],
)
def reset_staff_password(user_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    """
    Covers the case where a staff member's temporary password expired
    (3 days, unchanged) before they ever logged in and changed it —
    without this, that account would be permanently locked out with no
    way back in. School Admin issues a fresh temporary password here,
    resetting the 3-day clock; also works as a general "I forgot my
    password" reset at any time, not just after expiry.
    """
    target = db.query(models.User).filter(models.User.id == user_id, models.User.school_id == current_user.school_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="Staff member not found")
    if target.role_name == "school_admin":
        raise HTTPException(status_code=400, detail="The School Admin account's password can't be reset here.")

    temp_password = generate_temp_password()
    expires_at = temp_password_expiry()
    target.hashed_password = hash_password(temp_password)
    target.must_change_password = True
    target.temp_password_expires_at = expires_at
    db.commit()
    db.refresh(target)

    school = db.query(models.School).filter(models.School.id == current_user.school_id).first()
    login_path = f"/{school.slug}/login" if school and school.slug else "/login"
    return schemas.UserCreatedOut(
        user=target,
        temporary_password=temp_password,
        temp_password_expires_at=expires_at,
        login_url_path=login_path,
    )

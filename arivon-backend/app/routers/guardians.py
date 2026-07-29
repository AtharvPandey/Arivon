"""
Guardian/Parent management. Reading guardian info is open to any logged-in
staff member (a teacher legitimately needs a parent's phone number).
Creating/editing guardian records is restricted to Admissions — they're
the ones onboarding new families and are accountable for that data being
accurate.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app import models, schemas
from app.core.deps import require_roles

ADMISSIONS_ROLES = ("admissions_officer", "school_admin", "administrator", "principal", "super_admin")

router = APIRouter(prefix="/guardians", tags=["guardians"])


@router.post(
    "/",
    response_model=schemas.GuardianOut,
    status_code=201,
    dependencies=[Depends(require_roles(*ADMISSIONS_ROLES))],
)
def create_guardian(payload: schemas.GuardianCreate, db: Session = Depends(get_db)):
    guardian = models.Guardian(**payload.model_dump())
    db.add(guardian)
    db.commit()
    db.refresh(guardian)
    return guardian


@router.get("/", response_model=list[schemas.GuardianOut])
def list_guardians(school_id: int, search: str | None = None, db: Session = Depends(get_db)):
    query = db.query(models.Guardian).filter(models.Guardian.school_id == school_id)
    if search:
        query = query.filter(models.Guardian.full_name.ilike(f"%{search}%"))
    return query.all()


@router.get("/{guardian_id}/students", response_model=list[schemas.StudentOut])
def get_guardian_students(guardian_id: int, db: Session = Depends(get_db)):
    """All children linked to one guardian — the sibling-lookup feature
    that a flat text field on Student could never support."""
    guardian = db.query(models.Guardian).filter(models.Guardian.id == guardian_id).first()
    if not guardian:
        raise HTTPException(status_code=404, detail="Guardian not found")
    return db.query(models.Student).filter(models.Student.guardian_id == guardian_id).all()

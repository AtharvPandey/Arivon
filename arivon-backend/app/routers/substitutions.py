"""
Substitute teacher assignment — records that a substitute covers a
specific timetable slot on a specific date. See models.Substitution.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app import models, schemas
from app.core.deps import get_current_user, require_roles

WORKBENCH_ROLES = ("school_admin", "principal", "vice_principal", "administrator", "super_admin")

router = APIRouter(prefix="/substitutions", tags=["substitutions"])


@router.post("/", response_model=schemas.SubstitutionOut, status_code=201,
             dependencies=[Depends(require_roles(*WORKBENCH_ROLES))])
def assign_substitute(
    payload: schemas.SubstitutionCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    existing = db.query(models.Substitution).filter(
        models.Substitution.timetable_slot_id == payload.timetable_slot_id,
        models.Substitution.date == payload.date,
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="A substitute is already assigned for this slot and date")

    slot = db.query(models.TimetableSlot).filter(models.TimetableSlot.id == payload.timetable_slot_id).first()
    if not slot:
        raise HTTPException(status_code=404, detail="Timetable slot not found")
    if slot.teacher_id != payload.original_teacher_id:
        # Caught here at write time now, not just silently mismatched and
        # only surfacing as an odd count later in the Morning Briefing.
        raise HTTPException(
            status_code=400,
            detail="This timetable slot is not assigned to the teacher named as absent",
        )

    substitute_teacher = db.query(models.User).filter(models.User.id == payload.substitute_teacher_id).first()
    if not substitute_teacher:
        raise HTTPException(status_code=404, detail="Substitute teacher not found")

    substitution = models.Substitution(**payload.model_dump(), assigned_by_user_id=current_user.id)
    db.add(substitution)
    db.commit()
    db.refresh(substitution)

    return schemas.SubstitutionOut(
        id=substitution.id, date=substitution.date, timetable_slot_id=substitution.timetable_slot_id,
        original_teacher_id=substitution.original_teacher_id, substitute_teacher_id=substitution.substitute_teacher_id,
        substitute_teacher_name=substitute_teacher.full_name,
    )

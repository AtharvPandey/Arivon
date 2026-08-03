"""
Holidays — auto-provisioned with defaults for a school's first academic
year, editable/extensible afterward. Reading is open to everyone at the
school (a holiday list only helps if the whole school can see it);
creating and deleting is admin-tier only, matching the same
read/write split used for Events and Announcements.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app import models, schemas
from app.core.deps import get_current_user, require_roles

router = APIRouter(prefix="/holidays", tags=["holidays"])

HOLIDAY_MANAGER_ROLES = ("school_admin", "administrator", "principal", "vice_principal", "super_admin")


@router.get("/", response_model=list[schemas.HolidayOut])
def list_holidays(school_id: int, academic_year_id: int | None = None, db: Session = Depends(get_db)):
    query = db.query(models.Holiday).filter(models.Holiday.school_id == school_id)
    if academic_year_id:
        query = query.filter(models.Holiday.academic_year_id == academic_year_id)
    return query.order_by(models.Holiday.date).all()


@router.post(
    "/",
    response_model=schemas.HolidayOut,
    status_code=201,
    dependencies=[Depends(require_roles(*HOLIDAY_MANAGER_ROLES))],
)
def create_holiday(payload: schemas.HolidayCreate, db: Session = Depends(get_db)):
    existing = db.query(models.Holiday).filter(
        models.Holiday.school_id == payload.school_id,
        models.Holiday.academic_year_id == payload.academic_year_id,
        models.Holiday.date == payload.date,
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="A holiday is already recorded on this date.")

    holiday = models.Holiday(**payload.model_dump())
    db.add(holiday)
    db.commit()
    db.refresh(holiday)
    return holiday


@router.delete("/{holiday_id}", status_code=204, dependencies=[Depends(require_roles(*HOLIDAY_MANAGER_ROLES))])
def delete_holiday(holiday_id: int, db: Session = Depends(get_db)):
    holiday = db.query(models.Holiday).filter(models.Holiday.id == holiday_id).first()
    if holiday:
        db.delete(holiday)
        db.commit()

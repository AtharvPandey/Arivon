"""
School events — assemblies, meetings, exhibitions. Powers the Dashboard's
"Today's Schedule" widget. Creating an event is restricted to
admin-tier roles; reading is open to everyone since a schedule only
helps if the whole school can see it.
"""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app import models, schemas
from app.core.deps import get_current_user, require_roles

router = APIRouter(prefix="/events", tags=["events"])

EVENT_MANAGER_ROLES = ("school_admin", "administrator", "principal", "vice_principal", "super_admin")


@router.post(
    "/",
    response_model=schemas.SchoolEventOut,
    status_code=201,
    dependencies=[Depends(require_roles(*EVENT_MANAGER_ROLES))],
)
def create_event(
    payload: schemas.SchoolEventCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    event = models.SchoolEvent(
        school_id=payload.school_id,
        title=payload.title,
        event_date=payload.event_date,
        event_time=payload.event_time,
        created_by_user_id=current_user.id,
    )
    db.add(event)
    db.commit()
    db.refresh(event)
    return event


@router.get("/", response_model=list[schemas.SchoolEventOut])
def list_events(school_id: int, date: str, db: Session = Depends(get_db)):
    return db.query(models.SchoolEvent).filter(
        models.SchoolEvent.school_id == school_id,
        models.SchoolEvent.event_date == date,
    ).order_by(models.SchoolEvent.event_time).all()

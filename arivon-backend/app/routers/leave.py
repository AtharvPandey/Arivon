"""
Leave Management — application, approval/rejection, and balance
tracking for CL (Casual Leave), EL (Earned Leave), and ML (Medical
Leave), the three standard categories in Indian schools.

Balance is always computed live from approved LeaveApplication rows,
never stored — see the note on LeaveApplication in models.py for why.
"""

from datetime import date as date_type, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app import models, schemas
from app.core.deps import get_current_user, require_roles

HR_ROLES = ("school_admin", "principal", "vice_principal", "administrator", "super_admin")

# Standard annual quotas for a typical Indian school — a school-specific
# override system (different quotas per role or per school) is real
# future work, but every school needs a sane default on day one, and
# this is the conventional one.
LEAVE_TYPE_ANNUAL_QUOTA = {"CL": 12, "EL": 15, "ML": 10}

router = APIRouter(prefix="/leave", tags=["leave"])


def _leave_days(start: date_type, end: date_type) -> int:
    return (end - start).days + 1


@router.post("/apply", response_model=schemas.LeaveApplicationOut, status_code=201)
def apply_for_leave(
    payload: schemas.LeaveApplicationCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if payload.leave_type not in LEAVE_TYPE_ANNUAL_QUOTA:
        raise HTTPException(status_code=400, detail=f"leave_type must be one of {list(LEAVE_TYPE_ANNUAL_QUOTA)}")
    if payload.end_date < payload.start_date:
        raise HTTPException(status_code=400, detail="end_date cannot be before start_date")

    application = models.LeaveApplication(
        school_id=current_user.school_id, user_id=current_user.id,
        leave_type=payload.leave_type, start_date=payload.start_date,
        end_date=payload.end_date, reason=payload.reason,
    )
    db.add(application)
    db.commit()
    db.refresh(application)
    return _to_out(application, current_user.full_name)


@router.get("/applications", response_model=list[schemas.LeaveApplicationOut])
def list_leave_applications(
    school_id: int,
    status: str | None = None,
    user_id: int | None = None,
    db: Session = Depends(get_db),
):
    """
    No role restriction on reading — a teacher needs to see their own
    applications, and an Admin needs to see everyone's. The
    approve/reject actions below are what's actually gated.
    """
    query = db.query(models.LeaveApplication).filter(models.LeaveApplication.school_id == school_id)
    if status:
        query = query.filter(models.LeaveApplication.status == status)
    if user_id:
        query = query.filter(models.LeaveApplication.user_id == user_id)
    applications = query.order_by(models.LeaveApplication.applied_at.desc()).all()

    results = []
    for app in applications:
        user = db.query(models.User).filter(models.User.id == app.user_id).first()
        results.append(_to_out(app, user.full_name if user else "Unknown"))
    return results


@router.patch(
    "/applications/{application_id}/approve", response_model=schemas.LeaveApplicationOut,
    dependencies=[Depends(require_roles(*HR_ROLES))],
)
def approve_leave(
    application_id: int,
    payload: schemas.LeaveReviewRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    application = db.query(models.LeaveApplication).filter(models.LeaveApplication.id == application_id).first()
    if not application:
        raise HTTPException(status_code=404, detail="Leave application not found")
    if application.status != "pending":
        raise HTTPException(status_code=400, detail=f"This application is already {application.status}")

    application.status = "approved"
    application.reviewed_by_user_id = current_user.id
    application.reviewed_at = datetime.utcnow()
    application.review_notes = payload.review_notes
    db.commit()
    db.refresh(application)

    user = db.query(models.User).filter(models.User.id == application.user_id).first()
    return _to_out(application, user.full_name if user else "Unknown")


@router.patch(
    "/applications/{application_id}/reject", response_model=schemas.LeaveApplicationOut,
    dependencies=[Depends(require_roles(*HR_ROLES))],
)
def reject_leave(
    application_id: int,
    payload: schemas.LeaveReviewRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    application = db.query(models.LeaveApplication).filter(models.LeaveApplication.id == application_id).first()
    if not application:
        raise HTTPException(status_code=404, detail="Leave application not found")
    if application.status != "pending":
        raise HTTPException(status_code=400, detail=f"This application is already {application.status}")

    application.status = "rejected"
    application.reviewed_by_user_id = current_user.id
    application.reviewed_at = datetime.utcnow()
    application.review_notes = payload.review_notes
    db.commit()
    db.refresh(application)

    user = db.query(models.User).filter(models.User.id == application.user_id).first()
    return _to_out(application, user.full_name if user else "Unknown")


@router.get("/balance/{user_id}", response_model=schemas.LeaveBalanceOut)
def get_leave_balance(user_id: int, db: Session = Depends(get_db)):
    """
    Computed live, per calendar year — this year's approved/pending
    days against each type's annual quota. Nothing here is stored;
    re-derived fresh every time so it can never drift from the
    underlying applications.
    """
    year_start = date_type(date_type.today().year, 1, 1)
    year_end = date_type(date_type.today().year, 12, 31)

    applications = db.query(models.LeaveApplication).filter(
        models.LeaveApplication.user_id == user_id,
        models.LeaveApplication.start_date >= year_start,
        models.LeaveApplication.start_date <= year_end,
        models.LeaveApplication.status != "rejected",
    ).all()

    balances = []
    for leave_type, quota in LEAVE_TYPE_ANNUAL_QUOTA.items():
        type_apps = [a for a in applications if a.leave_type == leave_type]
        used = sum(_leave_days(a.start_date, a.end_date) for a in type_apps if a.status == "approved")
        pending = sum(_leave_days(a.start_date, a.end_date) for a in type_apps if a.status == "pending")
        balances.append(schemas.LeaveTypeBalance(
            leave_type=leave_type, annual_quota=quota, used=used,
            pending=pending, remaining=max(quota - used - pending, 0),
        ))

    return schemas.LeaveBalanceOut(user_id=user_id, balances=balances)


@router.get("/applications/{application_id}/affected-slots")
def get_affected_timetable_slots(application_id: int, db: Session = Depends(get_db)):
    """
    Which timetable slots fall within this leave's date range and still
    need a substitute — feeds directly into the EXISTING /substitutions/
    endpoint (built for the Morning Briefing) rather than inventing a
    parallel substitute-assignment mechanism for leave specifically.
    """
    application = db.query(models.LeaveApplication).filter(models.LeaveApplication.id == application_id).first()
    if not application:
        raise HTTPException(status_code=404, detail="Leave application not found")

    slots = db.query(models.TimetableSlot).filter(models.TimetableSlot.teacher_id == application.user_id).all()

    result = []
    current = application.start_date
    while current <= application.end_date:
        day_of_week = current.weekday()
        for slot in slots:
            if slot.day_of_week == day_of_week:
                already_covered = db.query(models.Substitution).filter(
                    models.Substitution.timetable_slot_id == slot.id, models.Substitution.date == current,
                ).first()
                if not already_covered:
                    result.append({
                        "date": current.isoformat(), "timetable_slot_id": slot.id,
                        "period_number": slot.period_number, "section_id": slot.section_id,
                    })
        current += timedelta(days=1)

    return result


def _to_out(app: models.LeaveApplication, staff_name: str) -> schemas.LeaveApplicationOut:
    return schemas.LeaveApplicationOut(
        id=app.id, school_id=app.school_id, user_id=app.user_id, staff_name=staff_name,
        leave_type=app.leave_type, start_date=app.start_date, end_date=app.end_date,
        days=_leave_days(app.start_date, app.end_date), reason=app.reason, status=app.status,
        applied_at=app.applied_at, reviewed_by_user_id=app.reviewed_by_user_id,
        reviewed_at=app.reviewed_at, review_notes=app.review_notes,
    )

"""
Teacher Portal — endpoints that exist purely to answer "what does MY
day look like" for a teacher, properly scoped to only the sections
they're actually assigned to teach (see app/core/teacher_scope.py).
Every existing endpoint in this app (attendance, homework, etc.) was
built admin-first and takes a school_id/section_id the caller chooses
freely; these endpoints instead derive everything from who's logged in.
"""

from datetime import date as date_type

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app import models, schemas
from app.core.deps import get_current_user
from app.core.teacher_scope import get_teacher_section_ids

router = APIRouter(prefix="/teacher-portal", tags=["teacher-portal"])


@router.get("/today", response_model=list[schemas.TeacherTodayPeriod])
def get_today_schedule(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Every period the logged-in teacher teaches today, in order, each
    flagged with whether attendance has already been marked for it —
    the single most-repeated glance-and-tap a teacher makes on their
    phone between classes."""
    today_weekday = date_type.today().weekday()  # 0=Monday .. 6=Sunday, matches TimetableSlot

    slots = (
        db.query(models.TimetableSlot)
        .filter(
            models.TimetableSlot.teacher_id == current_user.id,
            models.TimetableSlot.day_of_week == today_weekday,
        )
        .order_by(models.TimetableSlot.period_number)
        .all()
    )

    today_str = date_type.today().isoformat()
    result = []
    for slot in slots:
        section = db.query(models.Section).filter(models.Section.id == slot.section_id).first()
        subject = db.query(models.Subject).filter(models.Subject.id == slot.subject_id).first()
        school_class = db.query(models.SchoolClass).filter(models.SchoolClass.id == section.school_class_id).first() if section else None

        already_marked = (
            db.query(models.AttendanceRecord)
            .filter(
                models.AttendanceRecord.date == today_str,
                models.AttendanceRecord.period_number == slot.period_number,
                models.AttendanceRecord.student_id.in_(
                    db.query(models.Student.id).filter(models.Student.section_id == slot.section_id)
                ),
            )
            .first()
            is not None
        )

        result.append(schemas.TeacherTodayPeriod(
            slot_id=slot.id,
            period_number=slot.period_number,
            start_time=slot.start_time,
            end_time=slot.end_time,
            section_id=slot.section_id,
            class_name=school_class.name if school_class else "",
            section_name=section.name if section else "",
            subject_name=subject.name if subject else "",
            attendance_marked=already_marked,
        ))
    return result


@router.get("/classes", response_model=list[schemas.TeacherClassSummary])
def get_my_classes(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Every section this teacher is assigned to, whether by teaching a
    subject in it or being its class (homeroom) teacher — the full
    "My Classes" list, not just what's on today's timetable."""
    section_ids = get_teacher_section_ids(db, current_user.id)
    if not section_ids:
        return []

    result = []
    for section in db.query(models.Section).filter(models.Section.id.in_(section_ids)).all():
        school_class = db.query(models.SchoolClass).filter(models.SchoolClass.id == section.school_class_id).first()
        student_count = db.query(models.Student).filter(
            models.Student.section_id == section.id, models.Student.is_active == True
        ).count()

        subjects_taught = [
            row[0] for row in
            db.query(models.Subject.name)
            .join(models.TimetableSlot, models.TimetableSlot.subject_id == models.Subject.id)
            .filter(models.TimetableSlot.section_id == section.id, models.TimetableSlot.teacher_id == current_user.id)
            .distinct()
            .all()
        ]

        result.append(schemas.TeacherClassSummary(
            section_id=section.id,
            class_name=school_class.name if school_class else "",
            section_name=section.name,
            student_count=student_count,
            is_class_teacher=(section.class_teacher_id == current_user.id),
            subjects_taught=subjects_taught,
        ))
    return sorted(result, key=lambda c: (c.class_name, c.section_name))

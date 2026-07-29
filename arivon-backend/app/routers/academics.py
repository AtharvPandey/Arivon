"""
Academic Department — Subjects and Timetable. Writes (creating subjects,
mapping them to classes, building the timetable) are restricted to the
Academic Coordinator/Administrator/Principal. Reads are open to any
logged-in staff, since teachers obviously need to see the timetable
they're on, even though they can't edit it.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app import models, schemas
from app.core.deps import require_roles, get_current_user

ACADEMIC_ROLES = ("academic_coordinator", "school_admin", "administrator", "principal", "super_admin")

router = APIRouter(tags=["academics"])


# ---------- Subjects ----------

@router.post(
    "/subjects",
    response_model=schemas.SubjectOut,
    status_code=201,
    dependencies=[Depends(require_roles(*ACADEMIC_ROLES))],
)
def create_subject(payload: schemas.SubjectCreate, db: Session = Depends(get_db)):
    subject = models.Subject(**payload.model_dump())
    db.add(subject)
    db.commit()
    db.refresh(subject)
    return subject


@router.get("/subjects", response_model=list[schemas.SubjectOut])
def list_subjects(school_id: int, include_inactive: bool = False, db: Session = Depends(get_db)):
    """
    Filters to is_active=True by default — fixed here, since this
    previously returned every subject regardless of status, meaning a
    "deleted" (deactivated) subject would still show up everywhere.
    """
    query = db.query(models.Subject).filter(models.Subject.school_id == school_id)
    if not include_inactive:
        query = query.filter(models.Subject.is_active == True)  # noqa: E712
    return query.all()


# ---------- School Day Schedule (bell schedule) ----------

@router.post(
    "/day-schedule", response_model=schemas.DayScheduleBlockOut, status_code=201,
    dependencies=[Depends(require_roles(*ACADEMIC_ROLES))],
)
def create_day_schedule_block(
    payload: schemas.DayScheduleBlockCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    block = models.SchoolDayScheduleBlock(school_id=current_user.school_id, **payload.model_dump())
    db.add(block)
    db.commit()
    db.refresh(block)
    return block


@router.get("/day-schedule", response_model=list[schemas.DayScheduleBlockOut])
def list_day_schedule(school_id: int, db: Session = Depends(get_db)):
    return db.query(models.SchoolDayScheduleBlock).filter(
        models.SchoolDayScheduleBlock.school_id == school_id
    ).order_by(models.SchoolDayScheduleBlock.order_index).all()


@router.patch(
    "/day-schedule/{block_id}", response_model=schemas.DayScheduleBlockOut,
    dependencies=[Depends(require_roles(*ACADEMIC_ROLES))],
)
def update_day_schedule_block(block_id: int, payload: schemas.DayScheduleBlockCreate, db: Session = Depends(get_db)):
    block = db.query(models.SchoolDayScheduleBlock).filter(models.SchoolDayScheduleBlock.id == block_id).first()
    if not block:
        raise HTTPException(status_code=404, detail="Schedule block not found")
    for field, value in payload.model_dump().items():
        setattr(block, field, value)
    db.commit()
    db.refresh(block)
    return block


@router.delete(
    "/day-schedule/{block_id}", status_code=204,
    dependencies=[Depends(require_roles(*ACADEMIC_ROLES))],
)
def delete_day_schedule_block(block_id: int, db: Session = Depends(get_db)):
    block = db.query(models.SchoolDayScheduleBlock).filter(models.SchoolDayScheduleBlock.id == block_id).first()
    if not block:
        raise HTTPException(status_code=404, detail="Schedule block not found")
    db.delete(block)
    db.commit()


@router.patch(
    "/subjects/{subject_id}", response_model=schemas.SubjectOut,
    dependencies=[Depends(require_roles(*ACADEMIC_ROLES))],
)
def update_subject(subject_id: int, payload: schemas.SubjectUpdate, db: Session = Depends(get_db)):
    subject = db.query(models.Subject).filter(models.Subject.id == subject_id).first()
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")

    updates = payload.model_dump(exclude_unset=True)
    for field, value in updates.items():
        setattr(subject, field, value)

    db.commit()
    db.refresh(subject)
    return subject


@router.delete(
    "/subjects/{subject_id}", status_code=204,
    dependencies=[Depends(require_roles(*ACADEMIC_ROLES))],
)
def delete_subject(subject_id: int, db: Session = Depends(get_db)):
    """
    A soft delete (is_active=False), not a hard DELETE — a subject is
    referenced by TimetableSlot, ClassSubject, Homework, and
    SyllabusChapter rows; actually removing the row would either fail
    on the foreign key or silently orphan historical records. Hiding it
    from lists while keeping history intact is the correct behavior for
    something a school has already been using.
    """
    subject = db.query(models.Subject).filter(models.Subject.id == subject_id).first()
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")

    subject.is_active = False
    db.commit()


# ---------- Class <-> Subject mapping ----------

@router.post(
    "/class-subjects",
    response_model=schemas.ClassSubjectOut,
    status_code=201,
    dependencies=[Depends(require_roles(*ACADEMIC_ROLES))],
)
def map_subject_to_class(payload: schemas.ClassSubjectCreate, db: Session = Depends(get_db)):
    existing = db.query(models.ClassSubject).filter(
        models.ClassSubject.school_class_id == payload.school_class_id,
        models.ClassSubject.subject_id == payload.subject_id,
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="This subject is already mapped to this class")

    mapping = models.ClassSubject(**payload.model_dump())
    db.add(mapping)
    db.commit()
    db.refresh(mapping)
    return mapping


@router.get("/classes/{school_class_id}/subjects", response_model=list[schemas.ClassSubjectOut])
def list_class_subjects(school_class_id: int, db: Session = Depends(get_db)):
    return db.query(models.ClassSubject).filter(
        models.ClassSubject.school_class_id == school_class_id
    ).all()


# ---------- Timetable ----------

@router.post(
    "/timetable",
    response_model=schemas.TimetableSlotOut,
    status_code=201,
    dependencies=[Depends(require_roles(*ACADEMIC_ROLES))],
)
def create_timetable_slot(payload: schemas.TimetableSlotCreate, db: Session = Depends(get_db)):
    existing = db.query(models.TimetableSlot).filter(
        models.TimetableSlot.section_id == payload.section_id,
        models.TimetableSlot.day_of_week == payload.day_of_week,
        models.TimetableSlot.period_number == payload.period_number,
    ).first()
    if existing:
        raise HTTPException(
            status_code=400,
            detail="This section already has a subject scheduled for that day/period",
        )

    slot = models.TimetableSlot(**payload.model_dump())
    db.add(slot)
    db.commit()
    db.refresh(slot)
    return slot


@router.get("/timetable", response_model=list[schemas.TimetableSlotOut])
def get_timetable(section_id: int, db: Session = Depends(get_db)):
    return db.query(models.TimetableSlot).filter(
        models.TimetableSlot.section_id == section_id
    ).order_by(models.TimetableSlot.day_of_week, models.TimetableSlot.period_number).all()


@router.get("/timetable/substitute-view", response_model=list[schemas.SubstituteTimetableSlot])
def get_substitute_timetable(section_id: int, date: str, db: Session = Depends(get_db)):
    """
    One section's timetable for one specific date, with any approved
    substitutions applied — "who is actually taking this period today,"
    not just the standing weekly schedule. Reuses the existing
    Substitution records (built for the Morning Briefing) rather than a
    separate mechanism.
    """
    from datetime import date as date_type
    target_date = date_type.fromisoformat(date)
    day_of_week = target_date.weekday()

    slots = db.query(models.TimetableSlot).filter(
        models.TimetableSlot.section_id == section_id, models.TimetableSlot.day_of_week == day_of_week,
    ).order_by(models.TimetableSlot.period_number).all()

    substitutions_today = {
        s.timetable_slot_id: s
        for s in db.query(models.Substitution).filter(
            models.Substitution.date == target_date,
            models.Substitution.timetable_slot_id.in_([s.id for s in slots]),
        ).all()
    }

    results = []
    for slot in slots:
        subject = db.query(models.Subject).filter(models.Subject.id == slot.subject_id).first()
        original_teacher = db.query(models.User).filter(models.User.id == slot.teacher_id).first() if slot.teacher_id else None
        sub = substitutions_today.get(slot.id)
        substitute_teacher = db.query(models.User).filter(models.User.id == sub.substitute_teacher_id).first() if sub else None

        results.append(schemas.SubstituteTimetableSlot(
            timetable_slot_id=slot.id, period_number=slot.period_number,
            start_time=slot.start_time, end_time=slot.end_time,
            subject_name=subject.name if subject else "—",
            original_teacher_id=slot.teacher_id or 0,
            original_teacher_name=original_teacher.full_name if original_teacher else "Unassigned",
            substitute_teacher_id=sub.substitute_teacher_id if sub else None,
            substitute_teacher_name=substitute_teacher.full_name if substitute_teacher else None,
        ))
    return results


@router.get("/timetable/mine", response_model=list[schemas.MyScheduleSlot])
def get_my_schedule(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    A teacher's own timetable across every section they teach — powers
    the Teacher Workbench's 'Today's Schedule' / 'My Timetable' view.
    """
    rows = db.query(models.TimetableSlot).join(
        models.Section, models.TimetableSlot.section_id == models.Section.id
    ).join(
        models.SchoolClass, models.Section.school_class_id == models.SchoolClass.id
    ).join(
        models.Subject, models.TimetableSlot.subject_id == models.Subject.id
    ).filter(
        models.TimetableSlot.teacher_id == current_user.id
    ).order_by(
        models.TimetableSlot.day_of_week, models.TimetableSlot.period_number
    ).all()

    return [
        schemas.MyScheduleSlot(
            id=slot.id,
            day_of_week=slot.day_of_week,
            period_number=slot.period_number,
            start_time=slot.start_time,
            end_time=slot.end_time,
            section_id=slot.section_id,
            section_name=slot.section.school_class.name + " - " + slot.section.name,
            school_class_name=slot.section.school_class.name,
            subject_name=slot.subject.name,
        )
        for slot in rows
    ]


@router.get("/my-sections", response_model=list[schemas.MySection])
def get_my_sections(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Every section this teacher has at least one timetable slot in —
    powers the 'My Classes' list on the Teacher Workbench."""
    section_ids = db.query(models.TimetableSlot.section_id).filter(
        models.TimetableSlot.teacher_id == current_user.id
    ).distinct().all()
    section_ids = [s[0] for s in section_ids]

    if not section_ids:
        return []

    sections = db.query(models.Section).filter(models.Section.id.in_(section_ids)).all()
    result = []
    for section in sections:
        student_count = db.query(models.Student).filter(
            models.Student.section_id == section.id
        ).count()
        result.append(schemas.MySection(
            section_id=section.id,
            section_name=section.school_class.name + " - " + section.name,
            school_class_name=section.school_class.name,
            student_count=student_count,
        ))
    return result

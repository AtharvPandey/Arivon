"""
Communication — bulk WhatsApp messaging by class/section/whole school,
a dedicated (personalized) fee reminder to defaulters, and PTM
scheduling + attendance tracking.

Bulk messaging and PTM creation are restricted to the same
Admin-tier roles as Announcements — broadcasting to every parent in a
class or the whole school is a school-wide communication decision, not
something any individual teacher should trigger unilaterally.
"""

from datetime import date as date_type, datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app import models, schemas
from app.core.deps import get_current_user, require_roles
from app.core.notifications import send_whatsapp_message

COMMS_ROLES = ("school_admin", "principal", "vice_principal", "administrator", "super_admin")

router = APIRouter(prefix="/communication", tags=["communication"])


def _resolve_target_students(db: Session, school_id: int, target_scope: str, school_class_id: int | None, section_id: int | None) -> list[models.Student]:
    query = db.query(models.Student).filter(
        models.Student.school_id == school_id, models.Student.is_active == True,  # noqa: E712
    )
    if target_scope == "section":
        if not section_id:
            raise HTTPException(status_code=400, detail="section_id is required when target_scope is 'section'")
        query = query.filter(models.Student.section_id == section_id)
    elif target_scope == "class":
        if not school_class_id:
            raise HTTPException(status_code=400, detail="school_class_id is required when target_scope is 'class'")
        query = query.join(models.Section).filter(models.Section.school_class_id == school_class_id)
    elif target_scope != "school":
        raise HTTPException(status_code=400, detail="target_scope must be 'school', 'class', or 'section'")
    return query.all()


@router.post("/bulk-message", response_model=schemas.BulkMessageResult, dependencies=[Depends(require_roles(*COMMS_ROLES))])
def send_bulk_message(
    payload: schemas.BulkMessageCreate,
    school_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Covers exam schedule notices, PTM reminders, holiday notices, and
    emergency broadcasts — all the same mechanism, just a different
    message_type label for the audit log. Fee reminders have their own
    dedicated endpoint below instead, since those need a personalized
    amount per student rather than one identical message to everyone.
    """
    students = _resolve_target_students(db, school_id, payload.target_scope, payload.school_class_id, payload.section_id)

    for student in students:
        send_whatsapp_message(student.guardian_phone, payload.message_content)

    log = models.BulkMessageLog(
        school_id=school_id, message_type=payload.message_type, target_scope=payload.target_scope,
        school_class_id=payload.school_class_id, section_id=payload.section_id,
        message_content=payload.message_content, recipient_count=len(students),
        sent_by_user_id=current_user.id,
    )
    db.add(log)
    db.commit()

    return schemas.BulkMessageResult(recipient_count=len(students), message_type=payload.message_type)


@router.get("/bulk-message/log", response_model=list[schemas.BulkMessageLogOut])
def list_bulk_message_log(school_id: int, db: Session = Depends(get_db)):
    return db.query(models.BulkMessageLog).filter(
        models.BulkMessageLog.school_id == school_id
    ).order_by(models.BulkMessageLog.sent_at.desc()).all()


@router.post("/fee-reminder", response_model=schemas.FeeReminderResult, dependencies=[Depends(require_roles(*COMMS_ROLES, "accountant"))])
def send_fee_reminders(school_id: int, section_id: int | None = None, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    """
    Personalized, unlike bulk-message — reuses the exact same
    outstanding-balance computation as the Defaulters report (including
    any live late fee), so the amount quoted in the WhatsApp message is
    never a different number than what the Defaulters report shows for
    the same student at the same moment.
    """
    from app.routers.fees import get_defaulters

    defaulters = get_defaulters(school_id, section_id, db)
    for d in defaulters:
        message = (
            f"Dear Parent, this is a reminder that Rs.{d.total_outstanding} is outstanding "
            f"for {d.student_name} ({d.admission_number}), overdue since {d.oldest_due_date}. "
            f"Please clear the balance at your earliest convenience."
        )
        send_whatsapp_message(d.guardian_phone, message)

    total_students = len(_resolve_target_students(db, school_id, "section" if section_id else "school", None, section_id))
    log = models.BulkMessageLog(
        school_id=school_id, message_type="fee_reminder", target_scope="section" if section_id else "school",
        section_id=section_id, message_content="[personalized per-student outstanding balance reminder]",
        recipient_count=len(defaulters), sent_by_user_id=current_user.id,
    )
    db.add(log)
    db.commit()

    return schemas.FeeReminderResult(notified_count=len(defaulters), skipped_count=max(total_students - len(defaulters), 0))


# ---------- PTM Scheduling ----------

def _ptm_to_out(db: Session, ptm: models.PTMSchedule) -> schemas.PTMScheduleOut:
    school_class = db.query(models.SchoolClass).filter(models.SchoolClass.id == ptm.school_class_id).first() if ptm.school_class_id else None
    section = db.query(models.Section).filter(models.Section.id == ptm.section_id).first() if ptm.section_id else None
    return schemas.PTMScheduleOut(
        id=ptm.id, school_id=ptm.school_id, title=ptm.title, school_class_id=ptm.school_class_id,
        section_id=ptm.section_id, class_name=school_class.name if school_class else None,
        section_name=section.name if section else None, ptm_date=ptm.ptm_date, start_time=ptm.start_time,
        end_time=ptm.end_time, venue=ptm.venue, created_by_user_id=ptm.created_by_user_id,
    )


@router.post("/ptm", response_model=schemas.PTMScheduleOut, status_code=201, dependencies=[Depends(require_roles(*COMMS_ROLES))])
def create_ptm(payload: schemas.PTMScheduleCreate, school_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    ptm = models.PTMSchedule(school_id=school_id, created_by_user_id=current_user.id, **payload.model_dump())
    db.add(ptm)
    db.commit()
    db.refresh(ptm)
    return _ptm_to_out(db, ptm)


@router.get("/ptm", response_model=list[schemas.PTMScheduleOut])
def list_ptm(school_id: int, db: Session = Depends(get_db)):
    schedules = db.query(models.PTMSchedule).filter(models.PTMSchedule.school_id == school_id).order_by(models.PTMSchedule.ptm_date.desc()).all()
    return [_ptm_to_out(db, p) for p in schedules]


@router.post("/ptm/{ptm_id}/notify", response_model=schemas.BulkMessageResult, dependencies=[Depends(require_roles(*COMMS_ROLES))])
def notify_ptm(ptm_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    """Sends the PTM reminder to exactly the students in scope for this
    specific PTM, using the actual schedule details in the message."""
    ptm = db.query(models.PTMSchedule).filter(models.PTMSchedule.id == ptm_id).first()
    if not ptm:
        raise HTTPException(status_code=404, detail="PTM not found")

    scope = "section" if ptm.section_id else ("class" if ptm.school_class_id else "school")
    students = _resolve_target_students(db, ptm.school_id, scope, ptm.school_class_id, ptm.section_id)

    message = (
        f"Dear Parent, reminder: {ptm.title} on {ptm.ptm_date} from {ptm.start_time} to {ptm.end_time}"
        f"{f' at {ptm.venue}' if ptm.venue else ''}. We look forward to seeing you."
    )
    for student in students:
        send_whatsapp_message(student.guardian_phone, message)

    db.add(models.BulkMessageLog(
        school_id=ptm.school_id, message_type="ptm_reminder", target_scope=scope,
        school_class_id=ptm.school_class_id, section_id=ptm.section_id,
        message_content=message, recipient_count=len(students), sent_by_user_id=current_user.id,
    ))
    db.commit()
    return schemas.BulkMessageResult(recipient_count=len(students), message_type="ptm_reminder")


@router.get("/ptm/{ptm_id}/attendance", response_model=list[schemas.PTMAttendanceOut])
def get_ptm_attendance(ptm_id: int, db: Session = Depends(get_db)):
    ptm = db.query(models.PTMSchedule).filter(models.PTMSchedule.id == ptm_id).first()
    if not ptm:
        raise HTTPException(status_code=404, detail="PTM not found")

    scope = "section" if ptm.section_id else ("class" if ptm.school_class_id else "school")
    students = _resolve_target_students(db, ptm.school_id, scope, ptm.school_class_id, ptm.section_id)
    attendance_by_student = {
        a.student_id: a
        for a in db.query(models.PTMAttendance).filter(models.PTMAttendance.ptm_schedule_id == ptm_id).all()
    }

    return [
        schemas.PTMAttendanceOut(
            student_id=s.id, student_name=s.full_name,
            attended=attendance_by_student[s.id].attended if s.id in attendance_by_student else False,
            notes=attendance_by_student[s.id].notes if s.id in attendance_by_student else None,
        )
        for s in students
    ]


@router.post("/ptm/{ptm_id}/attendance", response_model=schemas.PTMAttendanceOut, dependencies=[Depends(require_roles(*COMMS_ROLES, "teacher"))])
def mark_ptm_attendance(ptm_id: int, payload: schemas.PTMAttendanceMarkRequest, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    existing = db.query(models.PTMAttendance).filter(
        models.PTMAttendance.ptm_schedule_id == ptm_id, models.PTMAttendance.student_id == payload.student_id,
    ).first()
    if existing:
        existing.attended = payload.attended
        existing.notes = payload.notes
        existing.marked_by_user_id = current_user.id
    else:
        existing = models.PTMAttendance(
            ptm_schedule_id=ptm_id, student_id=payload.student_id,
            attended=payload.attended, notes=payload.notes, marked_by_user_id=current_user.id,
        )
        db.add(existing)
    db.commit()
    db.refresh(existing)

    student = db.query(models.Student).filter(models.Student.id == payload.student_id).first()
    return schemas.PTMAttendanceOut(
        student_id=payload.student_id, student_name=student.full_name if student else "—",
        attended=existing.attended, notes=existing.notes,
    )

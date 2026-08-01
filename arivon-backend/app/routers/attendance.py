"""
Daily attendance. The key operation is POST /attendance/mark, which takes
a WHOLE SECTION's attendance in one request — this is the actual workflow
a teacher performs each morning, not a series of individual record inserts.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app import models, schemas
from app.core.deps import get_current_user
from app.core.teacher_scope import assert_teacher_can_access_section
from app.core.notifications import send_whatsapp_message

router = APIRouter(prefix="/attendance", tags=["attendance"])

VALID_STATUSES = {"present", "absent", "late", "excused"}


@router.post("/mark", response_model=list[schemas.AttendanceOut])
def mark_attendance(
    payload: schemas.AttendanceMarkRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    section = db.query(models.Section).filter(
        models.Section.id == payload.section_id
    ).first()
    if not section:
        raise HTTPException(status_code=404, detail="Section not found")

    assert_teacher_can_access_section(db, current_user, payload.section_id)

    # Validate every student actually belongs to this section BEFORE writing
    # anything — we want this to be all-or-nothing, not half-saved on error.
    student_ids_in_section = {
        s.id for s in db.query(models.Student).filter(
            models.Student.section_id == payload.section_id
        ).all()
    }

    results = []
    for entry in payload.entries:
        if entry.student_id not in student_ids_in_section:
            raise HTTPException(
                status_code=400,
                detail=f"Student {entry.student_id} is not in section {payload.section_id}",
            )
        if entry.status not in VALID_STATUSES:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid status '{entry.status}'. Must be one of {VALID_STATUSES}",
            )

        # Upsert scoped to (student, date, period_number) now — a school
        # doing whole-day tracking only ever touches period_number=0
        # rows, exactly as before; a school doing period-wise tracking
        # gets independent rows per period without one period's mark
        # overwriting another's.
        existing = db.query(models.AttendanceRecord).filter(
            models.AttendanceRecord.student_id == entry.student_id,
            models.AttendanceRecord.date == payload.date,
            models.AttendanceRecord.period_number == payload.period_number,
        ).first()

        if existing:
            existing.status = entry.status
            existing.marked_by_user_id = current_user.id
            record = existing
        else:
            record = models.AttendanceRecord(
                section_id=payload.section_id,
                student_id=entry.student_id,
                date=payload.date,
                period_number=payload.period_number,
                status=entry.status,
                marked_by_user_id=current_user.id,
            )
            db.add(record)

        results.append(record)

    db.commit()
    for r in results:
        db.refresh(r)

    # This is the payoff: attendance and communication are no longer
    # separate modules. Marking a student absent automatically closes
    # the loop with their parent — no separate WhatsApp group, no
    # separate phone call, no separate step for the teacher to remember.
    # Scoped to period_number == 0 (whole-day marking) on purpose — a
    # school doing period-wise tracking that marks a student absent for
    # one period isn't reporting the same thing as a full-day absence,
    # and shouldn't trigger the same "your child is absent" message.
    if payload.period_number == 0:
        for r in results:
            if r.status == "absent":
                student = db.query(models.Student).filter(
                    models.Student.id == r.student_id
                ).first()
                if student:
                    message = (
                        f"Dear Parent, this is to inform you that {student.full_name} "
                        f"was marked ABSENT today ({r.date}). If this is unexpected, "
                        f"please contact the school office."
                    )
                    send_whatsapp_message(student.guardian_phone, message)

    return results


@router.get("/", response_model=list[schemas.AttendanceOut])
def get_attendance(section_id: int, date: str, period_number: int = 0, db: Session = Depends(get_db)):
    """
    Fetch attendance for a section on a specific date.
    date must be in YYYY-MM-DD format, e.g. 2026-07-10

    Defaults to period_number=0 (whole-day) — the only kind of record
    that existed before period-wise tracking was added, so every
    existing caller of this endpoint keeps seeing exactly what it saw
    before, without needing to know this parameter exists at all.
    """
    return db.query(models.AttendanceRecord).filter(
        models.AttendanceRecord.section_id == section_id,
        models.AttendanceRecord.date == date,
        models.AttendanceRecord.period_number == period_number,
    ).all()


@router.get("/student/{student_id}", response_model=list[schemas.AttendanceOut])
def get_student_attendance(student_id: int, period_number: int = 0, db: Session = Depends(get_db)):
    """Full attendance history for one student — defaults to whole-day
    records only, same backward-compatibility reasoning as above."""
    return db.query(models.AttendanceRecord).filter(
        models.AttendanceRecord.student_id == student_id,
        models.AttendanceRecord.period_number == period_number,
    ).all()


def _compute_student_stats(records: list[models.AttendanceRecord]) -> dict:
    present = sum(1 for r in records if r.status == "present")
    absent = sum(1 for r in records if r.status == "absent")
    late = sum(1 for r in records if r.status == "late")
    excused = sum(1 for r in records if r.status == "excused")
    total = len(records)
    # Late still counts toward "present" for the percentage — the
    # student showed up, matching how most Indian schools' board
    # attendance rules treat a late arrival for the 75% requirement.
    effective_present = present + late
    pct = round((effective_present / total) * 100, 1) if total > 0 else 0.0
    return {
        "present": present, "absent": absent, "late": late, "excused": excused,
        "total": total, "pct": pct,
    }


@router.get("/register", response_model=list[schemas.StudentAttendanceRegisterItem])
def get_attendance_register(section_id: int, year: int, month: int, db: Session = Depends(get_db)):
    """
    Per-student monthly rollup for one section — the exact same shape
    as the Staff Attendance Register, applied to students. This is what
    a school actually hands to a board inspector or files at year-end,
    not a raw day-by-day dump.
    """
    from datetime import date as date_type
    from calendar import monthrange

    _, days_in_month = monthrange(year, month)
    month_start = date_type(year, month, 1)
    month_end = date_type(year, month, days_in_month)

    students = db.query(models.Student).filter(
        models.Student.section_id == section_id, models.Student.is_active == True,  # noqa: E712
    ).all()

    results = []
    for student in students:
        records = db.query(models.AttendanceRecord).filter(
            models.AttendanceRecord.student_id == student.id,
            models.AttendanceRecord.period_number == 0,
            models.AttendanceRecord.date >= month_start, models.AttendanceRecord.date <= month_end,
        ).all()
        stats = _compute_student_stats(records)
        results.append(schemas.StudentAttendanceRegisterItem(
            student_id=student.id, full_name=student.full_name, admission_number=student.admission_number,
            present_days=stats["present"], absent_days=stats["absent"], late_days=stats["late"],
            excused_days=stats["excused"], total_marked_days=stats["total"], attendance_pct=stats["pct"],
        ))
    return results


@router.get("/register/export")
def export_attendance_register(section_id: int, year: int, month: int, db: Session = Depends(get_db)):
    """The monthly register above, as a CSV — for board filing or an inspector visit."""
    import csv
    import io
    from fastapi import Response

    report = get_attendance_register(section_id, year, month, db)

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Admission Number", "Student Name", "Present", "Absent", "Late", "Excused", "Total Marked Days", "Attendance %"])
    for item in report:
        writer.writerow([
            item.admission_number, item.full_name, item.present_days, item.absent_days,
            item.late_days, item.excused_days, item.total_marked_days, item.attendance_pct,
        ])

    return Response(
        content=output.getvalue(), media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=attendance_register_{year}_{month:02d}.csv"},
    )


@router.get("/percentage/{student_id}", response_model=schemas.StudentAttendancePercentageOut)
def get_student_attendance_percentage(student_id: int, threshold: float = 75.0, db: Session = Depends(get_db)):
    """
    Overall attendance percentage across every whole-day record ever
    marked for this student — not a rolling 30-day window (that's what
    the Student Lookup search on the Attendance Overview page already
    shows). This is the number that actually matters for the 75% board
    requirement, computed over the entire academic session to date.
    """
    student = db.query(models.Student).filter(models.Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    records = db.query(models.AttendanceRecord).filter(
        models.AttendanceRecord.student_id == student_id, models.AttendanceRecord.period_number == 0,
    ).all()
    stats = _compute_student_stats(records)

    return schemas.StudentAttendancePercentageOut(
        student_id=student.id, full_name=student.full_name,
        present_days=stats["present"], absent_days=stats["absent"], late_days=stats["late"],
        excused_days=stats["excused"], total_marked_days=stats["total"], attendance_pct=stats["pct"],
        below_threshold=stats["total"] > 0 and stats["pct"] < threshold,
    )


@router.get("/low-attendance", response_model=list[schemas.LowAttendanceItem])
def get_low_attendance_students(school_id: int, threshold: float = 75.0, section_id: int | None = None, db: Session = Depends(get_db)):
    """
    Every student below the board-mandated attendance threshold (75% by
    default), across the whole school or one section — computed over
    every whole-day record marked so far this session, not a rolling
    window, since that's what actually determines board eligibility.
    """
    query = db.query(models.Student).filter(
        models.Student.school_id == school_id, models.Student.is_active == True,  # noqa: E712
    )
    if section_id is not None:
        query = query.filter(models.Student.section_id == section_id)
    students = query.all()

    results = []
    for student in students:
        records = db.query(models.AttendanceRecord).filter(
            models.AttendanceRecord.student_id == student.id, models.AttendanceRecord.period_number == 0,
        ).all()
        stats = _compute_student_stats(records)
        if stats["total"] > 0 and stats["pct"] < threshold:
            section = db.query(models.Section).filter(models.Section.id == student.section_id).first()
            school_class = db.query(models.SchoolClass).filter(models.SchoolClass.id == section.school_class_id).first() if section else None
            section_label = f"{school_class.name} - {section.name}" if section and school_class else "—"
            results.append(schemas.LowAttendanceItem(
                student_id=student.id, full_name=student.full_name, admission_number=student.admission_number,
                section_name=section_label, attendance_pct=stats["pct"], total_marked_days=stats["total"],
            ))

    results.sort(key=lambda x: x.attendance_pct)
    return results

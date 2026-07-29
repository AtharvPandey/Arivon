"""
Staff attendance — same upsert pattern as student attendance, but scoped
to a whole school (not a section), since staff aren't organized by class.
Marking is restricted to Principal/Vice Principal/Administrator — a
teacher can't mark their own or a colleague's attendance.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import date as date_type

from app.database import get_db
from app import models, schemas
from app.core.deps import get_current_user, require_roles

router = APIRouter(prefix="/staff-attendance", tags=["staff-attendance"])

VALID_STATUSES = {"present", "absent", "late", "half_day", "leave"}


@router.post(
    "/mark",
    response_model=list[schemas.StaffAttendanceOut],
    dependencies=[Depends(require_roles("school_admin", "principal", "vice_principal", "administrator", "super_admin"))],
)
def mark_staff_attendance(
    payload: schemas.StaffAttendanceMarkRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    staff_ids_in_school = {
        u.id for u in db.query(models.User).filter(
            models.User.school_id == payload.school_id
        ).all()
    }

    results = []
    for entry in payload.entries:
        if entry.user_id not in staff_ids_in_school:
            raise HTTPException(
                status_code=400,
                detail=f"User {entry.user_id} does not belong to school {payload.school_id}",
            )
        if entry.status not in VALID_STATUSES:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid status '{entry.status}'. Must be one of {VALID_STATUSES}",
            )

        existing = db.query(models.StaffAttendanceRecord).filter(
            models.StaffAttendanceRecord.user_id == entry.user_id,
            models.StaffAttendanceRecord.date == payload.date,
        ).first()

        if existing:
            existing.status = entry.status
            existing.marked_by_user_id = current_user.id
            record = existing
        else:
            record = models.StaffAttendanceRecord(
                user_id=entry.user_id,
                date=payload.date,
                status=entry.status,
                marked_by_user_id=current_user.id,
            )
            db.add(record)

        results.append(record)

    db.commit()
    for r in results:
        db.refresh(r)
    return results


@router.get("/", response_model=list[schemas.StaffAttendanceOut])
def get_staff_attendance(school_id: int, date: str, db: Session = Depends(get_db)):
    return db.query(models.StaffAttendanceRecord).join(
        models.User, models.StaffAttendanceRecord.user_id == models.User.id
    ).filter(
        models.User.school_id == school_id,
        models.StaffAttendanceRecord.date == date,
    ).all()


@router.get("/monthly-report", response_model=list[schemas.StaffAttendanceMonthlyItem])
def get_monthly_attendance_report(school_id: int, year: int, month: int, db: Session = Depends(get_db)):
    """
    Per-staff rollup for one calendar month — present/absent/late/
    half-day/not-marked day counts and an overall attendance percentage.
    Working days = every day actually marked for at least one staff
    member that month, not a hardcoded weekday count, since schools
    close on holidays that vary school to school.
    """
    from calendar import monthrange

    _, days_in_month = monthrange(year, month)
    month_start = date_type(year, month, 1)
    month_end = date_type(year, month, days_in_month)

    staff = db.query(models.User).filter(models.User.school_id == school_id).all()
    records = db.query(models.StaffAttendanceRecord).join(
        models.User, models.StaffAttendanceRecord.user_id == models.User.id
    ).filter(
        models.User.school_id == school_id,
        models.StaffAttendanceRecord.date >= month_start,
        models.StaffAttendanceRecord.date <= month_end,
    ).all()

    working_days = len({r.date for r in records}) or days_in_month
    records_by_user: dict[int, list] = {}
    for r in records:
        records_by_user.setdefault(r.user_id, []).append(r)

    results = []
    for member in staff:
        user_records = records_by_user.get(member.id, [])
        present = sum(1 for r in user_records if r.status == "present")
        absent = sum(1 for r in user_records if r.status == "absent")
        late = sum(1 for r in user_records if r.status == "late")
        half_day = sum(1 for r in user_records if r.status == "half_day")
        marked_days = len(user_records)
        not_marked = max(working_days - marked_days, 0)
        effective_present = present + late + (half_day * 0.5)
        pct = round((effective_present / working_days) * 100, 1) if working_days > 0 else 0.0

        results.append(schemas.StaffAttendanceMonthlyItem(
            user_id=member.id, full_name=member.full_name, role_name=member.role_name or "unknown",
            present_days=present, absent_days=absent, late_days=late, half_days=half_day,
            not_marked_days=not_marked, total_working_days=working_days, attendance_pct=pct,
        ))

    return results


@router.get("/export")
def export_attendance_register(school_id: int, year: int, month: int, db: Session = Depends(get_db)):
    """The monthly register export — the same report above, as a CSV a
    school can hand to an inspector or file with the board."""
    import csv
    import io
    from fastapi import Response

    report = get_monthly_attendance_report(school_id, year, month, db)

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Employee Name", "Role", "Present", "Absent", "Late", "Half Day",
        "Not Marked", "Working Days", "Attendance %",
    ])
    for item in report:
        writer.writerow([
            item.full_name, item.role_name, item.present_days, item.absent_days,
            item.late_days, item.half_days, item.not_marked_days,
            item.total_working_days, item.attendance_pct,
        ])

    return Response(
        content=output.getvalue(), media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=staff_attendance_{year}_{month:02d}.csv"},
    )

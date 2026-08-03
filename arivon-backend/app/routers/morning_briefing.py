"""
School Admin Morning Operations Briefing — the 8-10 AM check-in a School
Admin does every day: teacher attendance + who needs a substitute,
which sections haven't submitted attendance yet, open parent
complaints, yesterday's fee collection, and pending admission inquiries.

Follows the existing dashboard.py convention: direct queries in the
router, no repository/service layer — that pattern is reserved for the
newer Register School domain (see architecture notes from that work);
every other school-facing dashboard endpoint in Arivon works this way.
"""

from datetime import date as date_type, datetime, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app import models, schemas
from app.core.deps import require_roles

WORKBENCH_ROLES = ("school_admin", "principal", "vice_principal", "administrator", "super_admin")

router = APIRouter(
    prefix="/dashboard/morning-briefing",
    tags=["morning-briefing"],
    dependencies=[Depends(require_roles(*WORKBENCH_ROLES))],
)


@router.get("/", response_model=schemas.MorningBriefingOut)
def get_morning_briefing(school_id: int, date: date_type, db: Session = Depends(get_db)):
    yesterday = date - timedelta(days=1)
    day_of_week = date.weekday()  # 0=Monday .. 6=Sunday, matches TimetableSlot's convention

    # ---------- 1. Teacher Attendance + who needs a substitute ----------
    teacher_role_ids = [
        r.id for r in db.query(models.Role).filter(models.Role.name == "teacher").all()
    ]
    teachers = db.query(models.User).filter(
        models.User.school_id == school_id, models.User.role_id.in_(teacher_role_ids),
    ).all()
    total_teachers = len(teachers)

    attendance_by_user = {
        r.user_id: r.status
        for r in db.query(models.StaffAttendanceRecord).filter(
            models.StaffAttendanceRecord.date == date,
            models.StaffAttendanceRecord.user_id.in_([t.id for t in teachers]),
        ).all()
    }

    present = sum(1 for s in attendance_by_user.values() if s == "present")
    late = sum(1 for s in attendance_by_user.values() if s == "late")
    absent_teachers = [t for t in teachers if attendance_by_user.get(t.id) == "absent"]
    not_marked = total_teachers - len(attendance_by_user)

    substitutions_today = db.query(models.Substitution).filter(
        models.Substitution.school_id == school_id, models.Substitution.date == date,
    ).all()
    covered_slot_ids_by_teacher: dict[int, set] = {}
    for sub in substitutions_today:
        covered_slot_ids_by_teacher.setdefault(sub.original_teacher_id, set()).add(sub.timetable_slot_id)

    absent_list = []
    for teacher in absent_teachers:
        # Real bug fixed here: this used to just COUNT the teacher's
        # periods_today and separately count how many substitution rows
        # existed for that teacher, then compare the two numbers. That
        # meant a substitution pointing at the WRONG slot entirely (a
        # typo, a mismatched section) could still make needs_substitute
        # look satisfied purely by coincidental count matching. This now
        # checks the actual INTERSECTION — a slot only counts as covered
        # if it's genuinely one of this teacher's periods today.
        todays_slot_ids = {
            slot.id for slot in db.query(models.TimetableSlot).filter(
                models.TimetableSlot.teacher_id == teacher.id,
                models.TimetableSlot.day_of_week == day_of_week,
            ).all()
        }
        covered_slot_ids = covered_slot_ids_by_teacher.get(teacher.id, set()) & todays_slot_ids
        uncovered_slot_ids = list(todays_slot_ids - covered_slot_ids)
        absent_list.append(schemas.AbsentTeacherItem(
            user_id=teacher.id, full_name=teacher.full_name,
            periods_today=len(todays_slot_ids), periods_covered=len(covered_slot_ids),
            needs_substitute=len(todays_slot_ids) > len(covered_slot_ids),
            uncovered_slot_ids=uncovered_slot_ids,
        ))

    teacher_attendance = schemas.TeacherAttendanceBriefing(
        total_teachers=total_teachers, present=present, absent=len(absent_teachers),
        late=late, not_marked=max(not_marked, 0), absent_list=absent_list,
    )

    # ---------- 2. Attendance submission status by section ----------
    # Fixed a real ordering bug here: this had no ORDER BY at all, so
    # sections came back in arbitrary database row order — which is
    # exactly why "Class 5" could appear before "Nursery" in the list.
    # Sorted by the class ladder position first, then alphabetically by
    # section letter within a class.
    sections = db.query(models.Section).join(models.SchoolClass).filter(
        models.SchoolClass.school_id == school_id,
    ).order_by(models.SchoolClass.order_index, models.Section.name).all()
    sections_with_attendance_today = {
        r.section_id
        for r in db.query(models.AttendanceRecord.section_id).filter(
            models.AttendanceRecord.date == date,
            models.AttendanceRecord.section_id.in_([s.id for s in sections]),
        ).distinct().all()
    }

    not_submitted_list = []
    for section in sections:
        if section.id in sections_with_attendance_today:
            continue
        school_class = db.query(models.SchoolClass).filter(
            models.SchoolClass.id == section.school_class_id
        ).first()

        class_teacher = None
        class_teacher_has_phone = False
        if section.class_teacher_id:
            class_teacher = db.query(models.User).filter(models.User.id == section.class_teacher_id).first()
            if class_teacher:
                profile = db.query(models.StaffProfile).filter(
                    models.StaffProfile.user_id == class_teacher.id
                ).first()
                class_teacher_has_phone = bool(profile and profile.phone)

        not_submitted_list.append(schemas.UnsubmittedSectionItem(
            section_id=section.id, section_name=f"{school_class.name} - {section.name}",
            class_id=school_class.id, class_name=school_class.name,
            class_teacher_id=class_teacher.id if class_teacher else None,
            class_teacher_name=class_teacher.full_name if class_teacher else None,
            class_teacher_has_phone=class_teacher_has_phone,
        ))

    attendance_submission = schemas.AttendanceSubmissionBriefing(
        total_sections=len(sections),
        submitted=len(sections_with_attendance_today),
        not_submitted=len(sections) - len(sections_with_attendance_today),
        not_submitted_list=not_submitted_list,
    )

    # ---------- 3. Open parent complaints ----------
    open_complaints = db.query(models.ParentComplaint).filter(
        models.ParentComplaint.school_id == school_id, models.ParentComplaint.status == "open",
    ).order_by(models.ParentComplaint.created_at.desc()).all()

    complaints = schemas.ComplaintsBriefing(
        open_count=len(open_complaints),
        items=[
            schemas.ComplaintBriefingItem(id=c.id, guardian_name=c.guardian_name, subject=c.subject, created_at=c.created_at)
            for c in open_complaints[:10]
        ],
    )

    # ---------- 4. Yesterday's fee collection ----------
    yesterday_payments = db.query(models.FeePayment).join(models.StudentFeeInvoice).join(models.Student).filter(
        models.Student.school_id == school_id, models.FeePayment.payment_date == yesterday,
    ).all()
    fee_collection = schemas.FeeCollectionBriefing(
        yesterday_total=sum(p.amount for p in yesterday_payments),
        yesterday_payment_count=len(yesterday_payments),
    )

    # ---------- 5. Pending admission inquiries ----------
    pending_admissions = db.query(models.AdmissionApplication).filter(
        models.AdmissionApplication.school_id == school_id,
        models.AdmissionApplication.stage.notin_(["admission_confirmed", "rejected", "waitlisted"]),
    ).order_by(models.AdmissionApplication.created_at.desc()).all()

    admissions = schemas.AdmissionsBriefing(
        pending_count=len(pending_admissions),
        items=[
            schemas.AdmissionInquiryItem(id=a.id, applicant_name=a.student_name, created_at=a.created_at)
            for a in pending_admissions[:10]
        ],
    )

    return schemas.MorningBriefingOut(
        date=date, teacher_attendance=teacher_attendance, attendance_submission=attendance_submission,
        complaints=complaints, fee_collection=fee_collection, admissions=admissions,
    )


@router.get("/staff-overview", response_model=list[schemas.StaffAttendanceOverviewItem])
def get_staff_attendance_overview(school_id: int, date: date_type, db: Session = Depends(get_db)):
    """
    Full attendance status for EVERY staff member — teaching and
    non-teaching alike (accountants, receptionists, librarians,
    transport managers, drivers, support staff). This used to only
    query role_name == "teacher", which meant a School Admin had no way
    to see whether the school's cleaners, drivers, or front-office staff
    had been marked present today. Substitute logic (needs_substitute,
    uncovered_slot_ids) only ever applies to teaching staff — it stays
    False/empty for everyone else, since only teachers have periods to cover.
    """
    all_staff = db.query(models.User).filter(models.User.school_id == school_id).all()

    attendance_by_user = {
        r.user_id: r.status
        for r in db.query(models.StaffAttendanceRecord).filter(
            models.StaffAttendanceRecord.date == date,
            models.StaffAttendanceRecord.user_id.in_([s.id for s in all_staff]),
        ).all()
    }

    day_of_week = date.weekday()
    substitutions_today = db.query(models.Substitution).filter(
        models.Substitution.school_id == school_id, models.Substitution.date == date,
    ).all()
    covered_slot_ids_by_teacher: dict[int, set] = {}
    for sub in substitutions_today:
        covered_slot_ids_by_teacher.setdefault(sub.original_teacher_id, set()).add(sub.timetable_slot_id)

    result = []
    for staff_member in all_staff:
        status = attendance_by_user.get(staff_member.id, "not_marked")
        needs_substitute = False
        uncovered_slot_ids = []

        if status == "absent" and staff_member.role_name == "teacher":
            todays_slot_ids = {
                slot.id for slot in db.query(models.TimetableSlot).filter(
                    models.TimetableSlot.teacher_id == staff_member.id,
                    models.TimetableSlot.day_of_week == day_of_week,
                ).all()
            }
            covered = covered_slot_ids_by_teacher.get(staff_member.id, set()) & todays_slot_ids
            uncovered_slot_ids = list(todays_slot_ids - covered)
            needs_substitute = len(uncovered_slot_ids) > 0

        result.append(schemas.StaffAttendanceOverviewItem(
            user_id=staff_member.id, full_name=staff_member.full_name,
            role_name=staff_member.role_name or "unknown", status=status,
            needs_substitute=needs_substitute, uncovered_slot_ids=uncovered_slot_ids,
        ))

    return result


@router.get("/student-search", response_model=list[schemas.StudentAttendanceSearchItem])
def search_student_attendance(school_id: int, query: str, db: Session = Depends(get_db)):
    """
    Individual student lookup — distinct from the Section-wise tab, which
    only shows aggregate submission status per section. This lets an
    Admin search for one specific student by name and see their actual
    attendance picture: today's status plus a rolling 30-day percentage.
    """
    if len(query.strip()) < 2:
        return []

    students = db.query(models.Student).filter(
        models.Student.school_id == school_id,
        models.Student.is_active == True,  # noqa: E712
        models.Student.full_name.ilike(f"%{query}%"),
    ).limit(20).all()

    today = date_type.today()
    thirty_days_ago = today - timedelta(days=30)

    result = []
    for student in students:
        section = db.query(models.Section).filter(models.Section.id == student.section_id).first()
        school_class = db.query(models.SchoolClass).filter(
            models.SchoolClass.id == section.school_class_id
        ).first() if section else None
        section_label = f"{school_class.name} - {section.name}" if section and school_class else "Unassigned"

        today_record = db.query(models.AttendanceRecord).filter(
            models.AttendanceRecord.student_id == student.id, models.AttendanceRecord.date == today,
        ).first()

        recent_records = db.query(models.AttendanceRecord).filter(
            models.AttendanceRecord.student_id == student.id,
            models.AttendanceRecord.date >= thirty_days_ago,
        ).all()
        pct = None
        if recent_records:
            present_count = sum(1 for r in recent_records if r.status in ("present", "late"))
            pct = round((present_count / len(recent_records)) * 100, 1)

        result.append(schemas.StudentAttendanceSearchItem(
            student_id=student.id, full_name=student.full_name, section_name=section_label,
            today_status=today_record.status if today_record else None,
            attendance_pct_last_30_days=pct,
        ))

    return result


@router.post("/notify-attendance-reminder", response_model=schemas.NotifyReminderResult)
def notify_attendance_reminder(
    payload: schemas.NotifyAttendanceReminderRequest,
    db: Session = Depends(get_db),
):
    """
    Sends a WhatsApp reminder to a section's class teacher to mark
    today's attendance. Reuses the existing dry-run-safe WhatsApp sender
    — nothing new invented here, just a new call site for it.
    """
    from app.core.notifications import send_whatsapp_message

    section = db.query(models.Section).filter(models.Section.id == payload.section_id).first()
    if not section:
        return schemas.NotifyReminderResult(sent=False, message="Section not found.")
    if not section.class_teacher_id:
        return schemas.NotifyReminderResult(sent=False, message="This section has no class teacher assigned yet.")

    teacher = db.query(models.User).filter(models.User.id == section.class_teacher_id).first()
    profile = db.query(models.StaffProfile).filter(models.StaffProfile.user_id == section.class_teacher_id).first()
    if not profile or not profile.phone:
        return schemas.NotifyReminderResult(
            sent=False,
            message=f"No phone number on file for {teacher.full_name if teacher else 'this teacher'}.",
        )

    school_class = db.query(models.SchoolClass).filter(models.SchoolClass.id == section.school_class_id).first()
    section_label = f"{school_class.name} - {section.name}" if school_class else section.name
    send_whatsapp_message(
        profile.phone,
        f"Hi {teacher.full_name}, please mark today's attendance for {section_label} — it hasn't been submitted yet.",
    )
    return schemas.NotifyReminderResult(sent=True, message=f"Reminder sent to {teacher.full_name}.")

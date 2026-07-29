"""
The Principal Dashboard. One endpoint, restricted to Principal/Vice
Principal/Administrator, that aggregates across students, staff, classes,
and sections — this is the payoff of everything built so far: the
management layer that gives an at-a-glance view across the whole school,
the way we envisioned Arivon working back in the very first conversation.
"""

from datetime import date as date_type
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app import models, schemas
from app.core.deps import require_roles

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get(
    "/summary",
    response_model=schemas.DashboardSummary,
    dependencies=[Depends(require_roles("school_admin", "principal", "vice_principal", "administrator", "super_admin"))],
)
def get_dashboard_summary(school_id: int, date: date_type, db: Session = Depends(get_db)):
    # --- Students ---
    total_students = db.query(models.Student).filter(
        models.Student.school_id == school_id,
        models.Student.is_active == True,  # noqa: E712
    ).count()

    def count_students(status: str) -> int:
        return db.query(models.AttendanceRecord).join(
            models.Student, models.AttendanceRecord.student_id == models.Student.id
        ).filter(
            models.Student.school_id == school_id,
            models.AttendanceRecord.date == date,
            models.AttendanceRecord.status == status,
        ).count()

    students_present = count_students("present")
    students_absent = count_students("absent")
    students_late = count_students("late")
    students_excused = count_students("excused")
    students_marked = students_present + students_absent + students_late + students_excused
    students_unmarked = total_students - students_marked

    # --- Staff ---
    total_staff = db.query(models.User).filter(models.User.school_id == school_id).count()

    def count_staff(status: str) -> int:
        return db.query(models.StaffAttendanceRecord).join(
            models.User, models.StaffAttendanceRecord.user_id == models.User.id
        ).filter(
            models.User.school_id == school_id,
            models.StaffAttendanceRecord.date == date,
            models.StaffAttendanceRecord.status == status,
        ).count()

    staff_present = count_staff("present")
    staff_absent = count_staff("absent")
    staff_late = count_staff("late")
    staff_marked = staff_present + staff_absent + staff_late
    staff_unmarked = total_staff - staff_marked

    # --- Structure ---
    total_classes = db.query(models.SchoolClass).filter(
        models.SchoolClass.school_id == school_id
    ).count()
    total_sections = db.query(models.Section).join(
        models.SchoolClass, models.Section.school_class_id == models.SchoolClass.id
    ).filter(models.SchoolClass.school_id == school_id).count()

    return schemas.DashboardSummary(
        date=date,
        total_students=total_students,
        students_present=students_present,
        students_absent=students_absent,
        students_late=students_late,
        students_excused=students_excused,
        students_unmarked=students_unmarked,
        total_staff=total_staff,
        staff_present=staff_present,
        staff_absent=staff_absent,
        staff_late=staff_late,
        staff_unmarked=staff_unmarked,
        total_classes=total_classes,
        total_sections=total_sections,
    )


WORKBENCH_ROLES = ("school_admin", "principal", "vice_principal", "administrator", "super_admin")


@router.get(
    "/workbench",
    response_model=schemas.WorkbenchSummary,
    dependencies=[Depends(require_roles(*WORKBENCH_ROLES))],
)
def get_workbench_summary(school_id: int, date: date_type, db: Session = Depends(get_db)):
    """
    Everything the School Admin Workbench dashboard needs, in one call.
    Some widgets here (Teacher Leave, Fee Waivers, Transport Requests,
    Transfer Certificates, Promotion, Timetable Approval) reflect
    workflows that don't exist yet — they're returned with
    available=False so the frontend can show them honestly as
    "coming soon" instead of a fabricated zero.
    """
    school = db.query(models.School).filter(models.School.id == school_id).first()

    current_year = db.query(models.AcademicYear).filter(
        models.AcademicYear.school_id == school_id,
        models.AcademicYear.is_current == True,  # noqa: E712
    ).first()

    total_students = db.query(models.Student).filter(
        models.Student.school_id == school_id,
        models.Student.is_active == True,  # noqa: E712
    ).count()

    total_teachers = db.query(models.User).join(
        models.Role, models.User.role_id == models.Role.id
    ).filter(models.User.school_id == school_id, models.Role.name == "teacher").count()

    total_staff = db.query(models.User).filter(models.User.school_id == school_id).count()

    admissions_pending = db.query(models.AdmissionApplication).filter(
        models.AdmissionApplication.school_id == school_id,
        models.AdmissionApplication.status.notin_(["enrolled", "rejected", "withdrawn"]),
    ).count()

    fee_collected_today = db.query(models.FeePayment).join(
        models.StudentFeeInvoice, models.FeePayment.invoice_id == models.StudentFeeInvoice.id
    ).join(
        models.Student, models.StudentFeeInvoice.student_id == models.Student.id
    ).filter(
        models.Student.school_id == school_id,
        models.FeePayment.payment_date == date,
    ).with_entities(models.FeePayment.amount).all()
    fee_collected_today_total = sum(a[0] for a in fee_collected_today)

    students_present = db.query(models.AttendanceRecord).join(
        models.Student, models.AttendanceRecord.student_id == models.Student.id
    ).filter(
        models.Student.school_id == school_id,
        models.AttendanceRecord.date == date,
        models.AttendanceRecord.status == "present",
    ).count()
    attendance_today_pct = round((students_present / total_students) * 100, 1) if total_students else 0.0

    # --- Needs Attention: only real, computable signals ---
    fee_defaulters = db.query(models.StudentFeeInvoice.student_id).join(
        models.Student, models.StudentFeeInvoice.student_id == models.Student.id
    ).filter(
        models.Student.school_id == school_id,
        models.StudentFeeInvoice.status == "overdue",
    ).distinct().count()

    total_sections = db.query(models.Section).join(
        models.SchoolClass, models.Section.school_class_id == models.SchoolClass.id
    ).filter(models.SchoolClass.school_id == school_id).count()
    sections_with_attendance_today = db.query(models.AttendanceRecord.section_id).join(
        models.Section, models.AttendanceRecord.section_id == models.Section.id
    ).join(
        models.SchoolClass, models.Section.school_class_id == models.SchoolClass.id
    ).filter(
        models.SchoolClass.school_id == school_id,
        models.AttendanceRecord.date == date,
    ).distinct().count()
    attendance_not_submitted = max(total_sections - sections_with_attendance_today, 0)

    disabled_staff = db.query(models.User).filter(
        models.User.school_id == school_id,
        models.User.is_active == False,  # noqa: E712
    ).count()

    # Timetable conflict = same teacher, same day+period, in TWO DIFFERENT
    # sections. Our unique constraint already prevents double-booking a
    # single section/day/period, but nothing stops the SAME teacher being
    # scheduled in two different sections at once — that's the real gap.
    from sqlalchemy import func
    teacher_slots = db.query(
        models.TimetableSlot.teacher_id,
        models.TimetableSlot.day_of_week,
        models.TimetableSlot.period_number,
        func.count(func.distinct(models.TimetableSlot.section_id)).label("section_count"),
    ).join(
        models.Section, models.TimetableSlot.section_id == models.Section.id
    ).join(
        models.SchoolClass, models.Section.school_class_id == models.SchoolClass.id
    ).filter(
        models.SchoolClass.school_id == school_id,
        models.TimetableSlot.teacher_id.isnot(None),
    ).group_by(
        models.TimetableSlot.teacher_id, models.TimetableSlot.day_of_week, models.TimetableSlot.period_number
    ).having(func.count(func.distinct(models.TimetableSlot.section_id)) > 1).all()
    timetable_conflicts = len(teacher_slots)

    needs_attention = [
        schemas.NeedsAttentionItem(label="Admission Applications Pending", count=admissions_pending, link="/dashboard/admissions"),
        schemas.NeedsAttentionItem(label="Fee Defaulters", count=fee_defaulters, link="/dashboard/finance"),
        schemas.NeedsAttentionItem(label="Attendance Not Submitted", count=attendance_not_submitted, link="/dashboard/attendance"),
        schemas.NeedsAttentionItem(label="Staff Accounts Disabled", count=disabled_staff, link="/dashboard/people/staff"),
        schemas.NeedsAttentionItem(label="Timetable Conflicts", count=timetable_conflicts, link="/dashboard/academics"),
    ]
    # Only surface items that actually need attention — an empty "Needs
    # Attention" list is itself useful information (nothing's on fire).
    needs_attention = [item for item in needs_attention if item.count > 0]

    # --- School Health ---
    total_staff_marked_present = db.query(models.StaffAttendanceRecord).join(
        models.User, models.StaffAttendanceRecord.user_id == models.User.id
    ).filter(
        models.User.school_id == school_id,
        models.StaffAttendanceRecord.date == date,
        models.StaffAttendanceRecord.status == "present",
    ).count()
    teacher_attendance_pct = round((total_staff_marked_present / total_staff) * 100, 1) if total_staff else 0.0

    all_invoices = db.query(models.StudentFeeInvoice).join(
        models.Student, models.StudentFeeInvoice.student_id == models.Student.id
    ).filter(models.Student.school_id == school_id).all()
    total_due = sum(inv.amount_due for inv in all_invoices)
    total_paid = sum(inv.amount_paid for inv in all_invoices)
    fees_collected_pct = round((total_paid / total_due) * 100, 1) if total_due else 0.0

    school_health = {
        "attendance": attendance_today_pct,
        "fees_collected": fees_collected_pct,
        "teacher_attendance": teacher_attendance_pct,
        "homework_completion": None,  # Homework module not built yet
        "exam_progress": None,  # Examinations module not built yet
    }

    # --- Recent Activity: pulled from multiple existing tables, not a
    # separate generic activity-log system, since every source here
    # already has a real timestamp we can use. ---
    activity = []

    recent_students = db.query(models.Student).filter(
        models.Student.school_id == school_id
    ).order_by(models.Student.created_at.desc()).limit(5).all()
    for s in recent_students:
        activity.append(schemas.ActivityItem(description=f"Student {s.full_name} admitted", timestamp=s.created_at))

    recent_payments = db.query(models.FeePayment).join(
        models.StudentFeeInvoice, models.FeePayment.invoice_id == models.StudentFeeInvoice.id
    ).join(
        models.Student, models.StudentFeeInvoice.student_id == models.Student.id
    ).filter(models.Student.school_id == school_id).order_by(models.FeePayment.created_at.desc()).limit(5).all()
    for p in recent_payments:
        student = db.query(models.Student).join(
            models.StudentFeeInvoice, models.Student.id == models.StudentFeeInvoice.student_id
        ).filter(models.StudentFeeInvoice.id == p.invoice_id).first()
        name = student.full_name if student else "a student"
        activity.append(schemas.ActivityItem(description=f"Fee payment of ₹{p.amount} received from {name}", timestamp=p.created_at))

    recent_announcements = db.query(models.Announcement).filter(
        models.Announcement.school_id == school_id
    ).order_by(models.Announcement.created_at.desc()).limit(5).all()
    for a in recent_announcements:
        activity.append(schemas.ActivityItem(description=f"Notice published: {a.title}", timestamp=a.created_at))

    activity.sort(key=lambda x: x.timestamp, reverse=True)
    recent_activity = activity[:8]

    # --- Pending Approvals: real where we have the data, honest
    # "coming soon" where the workflow doesn't exist yet. ---
    pending_approvals = [
        schemas.ApprovalItem(label="Admissions", count=admissions_pending, available=True, link="/dashboard/admissions"),
        schemas.ApprovalItem(label="Teacher Leave", count=0, available=False),
        schemas.ApprovalItem(label="Fee Waiver", count=0, available=False),
        schemas.ApprovalItem(label="Transport Request", count=0, available=False),
        schemas.ApprovalItem(label="Transfer Certificate", count=0, available=False),
        schemas.ApprovalItem(label="Student Promotion", count=0, available=False),
        schemas.ApprovalItem(label="Timetable Approval", count=0, available=False),
    ]

    # --- Gender Distribution: real counts from Student.gender, no
    # placeholder categories invented for ones that aren't set. ---
    gender_rows = db.query(models.Student.gender, func.count(models.Student.id)).filter(
        models.Student.school_id == school_id, models.Student.is_active == True,  # noqa: E712
    ).group_by(models.Student.gender).all()
    gender_counts = {"male": 0, "female": 0, "other": 0}
    for gender_value, count in gender_rows:
        key = (gender_value or "other").lower()
        if key in gender_counts:
            gender_counts[key] += count
        else:
            gender_counts["other"] += count
    gender_distribution = schemas.GenderDistribution(**gender_counts)

    # --- Class-wise Strength: student count per class, ordered the same
    # way the class ladder is ordered everywhere else in Arivon. ---
    class_strength_rows = db.query(
        models.SchoolClass.name, models.SchoolClass.order_index, func.count(models.Student.id),
    ).join(
        models.Section, models.Section.school_class_id == models.SchoolClass.id
    ).join(
        models.Student, models.Student.section_id == models.Section.id
    ).filter(
        models.SchoolClass.school_id == school_id, models.Student.is_active == True,  # noqa: E712
    ).group_by(models.SchoolClass.id, models.SchoolClass.name, models.SchoolClass.order_index).order_by(
        models.SchoolClass.order_index
    ).all()
    class_wise_strength = [
        schemas.ClassStrengthItem(class_name=name, student_count=count)
        for name, _, count in class_strength_rows
    ]

    return schemas.WorkbenchSummary(
        school_name=school.name if school else "",
        academic_year_id=current_year.id if current_year else None,
        academic_year_label=current_year.label if current_year else None,
        total_students=total_students,
        total_teachers=total_teachers,
        total_staff=total_staff,
        admissions_pending=admissions_pending,
        fee_collected_today=fee_collected_today_total,
        attendance_today_pct=attendance_today_pct,
        needs_attention=needs_attention,
        school_health=school_health,
        recent_activity=recent_activity,
        pending_approvals=pending_approvals,
        gender_distribution=gender_distribution,
        class_wise_strength=class_wise_strength,
        fees_total_due=total_due,
        fees_total_paid=total_paid,
    )

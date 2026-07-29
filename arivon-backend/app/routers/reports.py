"""
Reports & Analytics — the reports a Tier 2/3 school admin actually
maintains today in Excel or on paper. Everything else this page surfaces
(fee defaulters, fee collection, exam analysis, promotion lists,
attendance registers) already lives in its own router where it's
generated — this file only holds the genuinely new reports: student
strength, staff list, UDISE+ export, and demographic summary.
"""

import csv
import io

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session

from app.database import get_db
from app import models, schemas

router = APIRouter(prefix="/reports", tags=["reports"])


def _category_key(category: str | None) -> str:
    if not category:
        return "category_unspecified"
    normalized = category.strip().upper()
    if normalized in ("GENERAL", "GEN"):
        return "general"
    if normalized == "OBC":
        return "obc"
    if normalized == "SC":
        return "sc"
    if normalized == "ST":
        return "st"
    if normalized == "EWS":
        return "ews"
    return "category_unspecified"


@router.get("/student-strength", response_model=list[schemas.StudentStrengthItem])
def get_student_strength(school_id: int, academic_year_id: int | None = None, db: Session = Depends(get_db)):
    """
    Class-wise, section-wise, gender-wise, category-wise headcount —
    the single report every school office keeps updated by hand at the
    start of term and re-checks all year. Scoped to the CURRENT academic
    year by default, since strength for a past year is a historical
    question, not "how full is each section right now."
    """
    if academic_year_id is None:
        current_year = db.query(models.AcademicYear).filter(
            models.AcademicYear.school_id == school_id, models.AcademicYear.is_current == True,  # noqa: E712
        ).first()
        if not current_year:
            return []
        academic_year_id = current_year.id

    sections = db.query(models.Section).join(models.SchoolClass).filter(
        models.SchoolClass.academic_year_id == academic_year_id
    ).order_by(models.SchoolClass.order_index, models.Section.name).all()

    results = []
    for section in sections:
        school_class = db.query(models.SchoolClass).filter(models.SchoolClass.id == section.school_class_id).first()
        students = db.query(models.Student).filter(
            models.Student.section_id == section.id, models.Student.is_active == True,  # noqa: E712
        ).all()

        counts = {"general": 0, "obc": 0, "sc": 0, "st": 0, "ews": 0, "category_unspecified": 0}
        boys = girls = other_gender = 0
        for s in students:
            if s.gender == "Male":
                boys += 1
            elif s.gender == "Female":
                girls += 1
            else:
                other_gender += 1
            counts[_category_key(s.category)] += 1

        results.append(schemas.StudentStrengthItem(
            school_class_id=school_class.id, class_name=school_class.name,
            section_id=section.id, section_name=section.name,
            total=len(students), boys=boys, girls=girls, other_gender=other_gender,
            general=counts["general"], obc=counts["obc"], sc=counts["sc"], st=counts["st"], ews=counts["ews"],
            category_unspecified=counts["category_unspecified"],
        ))
    return results


@router.get("/student-strength/export")
def export_student_strength(school_id: int, academic_year_id: int | None = None, db: Session = Depends(get_db)):
    rows = get_student_strength(school_id, academic_year_id, db)
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Class", "Section", "Total", "Boys", "Girls", "Other", "General", "OBC", "SC", "ST", "EWS", "Unspecified"])
    for r in rows:
        writer.writerow([r.class_name, r.section_name, r.total, r.boys, r.girls, r.other_gender, r.general, r.obc, r.sc, r.st, r.ews, r.category_unspecified])
    return Response(
        content=output.getvalue(), media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=student_strength_report.csv"},
    )


@router.get("/staff-list", response_model=list[schemas.StaffListItem])
def get_staff_list_report(school_id: int, include_inactive: bool = False, db: Session = Depends(get_db)):
    """Every staff member with the fields that go into government/board
    HR reporting — qualification, experience, date of joining."""
    query = db.query(models.User).join(models.Role).filter(
        models.User.school_id == school_id, models.Role.name != "school_admin",
    )
    if not include_inactive:
        query = query.filter(models.User.is_active == True)  # noqa: E712
    users = query.all()

    results = []
    for user in users:
        profile = db.query(models.StaffProfile).filter(models.StaffProfile.user_id == user.id).first()
        results.append(schemas.StaffListItem(
            id=user.id, full_name=user.full_name, role_name=user.role_name,
            designation=profile.designation if profile else None,
            department=profile.department if profile else None,
            qualification=profile.qualification if profile else None,
            experience_years=profile.experience_years if profile else None,
            email=user.email, phone=profile.phone if profile else None,
            date_of_joining=profile.date_of_joining if profile else None,
            is_active=user.is_active,
        ))
    return sorted(results, key=lambda r: (r.role_name or "", r.full_name))


@router.get("/staff-list/export")
def export_staff_list(school_id: int, include_inactive: bool = False, db: Session = Depends(get_db)):
    rows = get_staff_list_report(school_id, include_inactive, db)
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Name", "Role", "Designation", "Department", "Qualification", "Experience (yrs)", "Email", "Phone", "Date of Joining", "Active"])
    for r in rows:
        writer.writerow([
            r.full_name, (r.role_name or "").replace("_", " ").title(), r.designation or "", r.department or "",
            r.qualification or "", r.experience_years if r.experience_years is not None else "",
            r.email, r.phone or "", r.date_of_joining or "", "Yes" if r.is_active else "No",
        ])
    return Response(
        content=output.getvalue(), media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=staff_list_report.csv"},
    )


@router.get("/demographics", response_model=schemas.DemographicSummaryOut)
def get_demographic_summary(school_id: int, db: Session = Depends(get_db)):
    """
    The breakdown a government or board reporting form actually asks
    for — gender, category, religion, nationality, mother tongue —
    across every active student, not scoped to a single class.
    """
    students = db.query(models.Student).filter(
        models.Student.school_id == school_id, models.Student.is_active == True,  # noqa: E712
    ).all()

    def tally(field_getter) -> list[schemas.DemographicBreakdownEntry]:
        counts: dict[str, int] = {}
        for s in students:
            value = field_getter(s) or "Unspecified"
            counts[value] = counts.get(value, 0) + 1
        return [schemas.DemographicBreakdownEntry(label=k, count=v) for k, v in sorted(counts.items(), key=lambda kv: -kv[1])]

    return schemas.DemographicSummaryOut(
        total_students=len(students),
        by_gender=tally(lambda s: s.gender),
        by_category=tally(lambda s: s.category),
        by_religion=tally(lambda s: s.religion),
        by_nationality=tally(lambda s: s.nationality),
        by_mother_tongue=tally(lambda s: s.mother_tongue),
    )


@router.get("/udise-export")
def export_udise_data(school_id: int, academic_year_id: int | None = None, db: Session = Depends(get_db)):
    """
    A UDISE+-aligned export — school profile, class-wise enrollment by
    gender and social category, and staff counts by qualification —
    covering the standard data points every school reports to UDISE+
    each year. Built from the same fields UDISE+'s own form asks for
    (recognition status, affiliation, enrollment split by category),
    so filling the government portal becomes copy-paste instead of a
    from-scratch manual count. This mirrors the commonly-reported UDISE+
    structure; always cross-check specific field labels against the
    current year's official form before final submission, since the
    government's exact schema can change year to year.
    """
    school = db.query(models.School).filter(models.School.id == school_id).first()
    if not school:
        raise HTTPException(status_code=404, detail="School not found")

    strength = get_student_strength(school_id, academic_year_id, db)
    staff = get_staff_list_report(school_id, False, db)

    output = io.StringIO()
    writer = csv.writer(output)

    writer.writerow(["UDISE+ EXPORT", school.name])
    writer.writerow(["UDISE Code", school.udise_code or ""])
    writer.writerow(["Board Type", school.board_type])
    writer.writerow(["School Category", school.school_category or ""])
    writer.writerow(["Year Established", school.year_established or ""])
    writer.writerow(["Address", school.address or ""])
    writer.writerow(["State", school.state or ""])
    writer.writerow(["Pincode", school.pincode or ""])
    writer.writerow([])

    writer.writerow(["SECTION 1: CLASS-WISE ENROLLMENT"])
    writer.writerow(["Class", "Section", "Boys", "Girls", "Other", "Total", "General", "OBC", "SC", "ST", "EWS"])
    for r in strength:
        writer.writerow([r.class_name, r.section_name, r.boys, r.girls, r.other_gender, r.total, r.general, r.obc, r.sc, r.st, r.ews])
    writer.writerow(["TOTAL", "", sum(r.boys for r in strength), sum(r.girls for r in strength), sum(r.other_gender for r in strength),
                      sum(r.total for r in strength), sum(r.general for r in strength), sum(r.obc for r in strength),
                      sum(r.sc for r in strength), sum(r.st for r in strength), sum(r.ews for r in strength)])
    writer.writerow([])

    writer.writerow(["SECTION 2: TEACHING STAFF BY QUALIFICATION"])
    writer.writerow(["Name", "Designation", "Qualification", "Experience (yrs)"])
    for s in staff:
        if s.role_name == "teacher":
            writer.writerow([s.full_name, s.designation or "", s.qualification or "", s.experience_years or ""])
    writer.writerow([])
    writer.writerow(["Total Teaching Staff", len([s for s in staff if s.role_name == "teacher"])])
    writer.writerow(["Total Non-Teaching Staff", len([s for s in staff if s.role_name != "teacher"])])

    return Response(
        content=output.getvalue(), media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=udise_export.csv"},
    )

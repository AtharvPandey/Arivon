from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app import models, schemas
from app.core.deps import require_roles

router = APIRouter(prefix="/academic-years", tags=["academic-years"])

# Creating a session and marking one "current" is a configuration action —
# it reshapes what the whole school's data is bucketed against. That's
# School Admin / Administrator territory, exactly like editing the school
# profile. Everyone else (Principal included) can READ sessions but not
# create or change them.
SESSION_MANAGEMENT_ROLES = ("school_admin", "administrator", "super_admin")

# The fixed, standard Indian school class ladder, organized by the 5
# real school stages. Classes are NOT freely creatable by staff — every
# school runs this same sequence, only the top end differs (High School
# stops at Secondary/Class 10, Higher Secondary continues two more years).
# This is the direct fix for "I could create as many classes as I wanted" —
# the only way a class comes into existence now is through this list.
SCHOOL_STAGES = [
    ("pre_primary", ["Nursery", "LKG", "UKG"]),
    ("primary", ["Class 1", "Class 2", "Class 3", "Class 4", "Class 5"]),
    ("middle", ["Class 6", "Class 7", "Class 8"]),
    ("secondary", ["Class 9", "Class 10"]),
    ("higher_secondary", ["Class 11", "Class 12"]),
]


def _build_ladder(include_higher_secondary: bool):
    ladder = []
    for stage_key, names in SCHOOL_STAGES:
        if stage_key == "higher_secondary" and not include_higher_secondary:
            continue
        for name in names:
            ladder.append((name, stage_key))
    return ladder


HIGH_SCHOOL_LADDER = _build_ladder(include_higher_secondary=False)
HIGHER_SECONDARY_LADDER = _build_ladder(include_higher_secondary=True)


def build_ladder_for_selected_stages(selected_stage_keys: list[str]) -> list[tuple[str, str]]:
    """
    PRD Step 6 extension: unlike the binary HIGH_SCHOOL_LADDER/
    HIGHER_SECONDARY_LADDER above (still used as-is by the endpoint
    below, unchanged), the registration wizard allows ARBITRARY stage
    combinations (e.g. Middle+Secondary only). This walks SCHOOL_STAGES
    — the same source of truth — filtering to just the requested stages,
    so there is exactly one place that knows what classes exist in each
    stage, reused by both the simple binary path and this flexible one.
    """
    ladder = []
    for stage_key, names in SCHOOL_STAGES:
        if stage_key not in selected_stage_keys:
            continue
        for name in names:
            ladder.append((name, stage_key))
    return ladder


@router.post("/", response_model=schemas.AcademicYearOut, status_code=201, dependencies=[Depends(require_roles(*SESSION_MANAGEMENT_ROLES))])
def create_academic_year(payload: schemas.AcademicYearCreate, db: Session = Depends(get_db)):
    school = db.query(models.School).filter(models.School.id == payload.school_id).first()
    if not school:
        raise HTTPException(status_code=404, detail="School not found")

    # Fixed a real bug here: nothing previously stopped more than one
    # academic year from being marked "current" for the same school —
    # every other place in the app that looks up "the" current year
    # (dashboard stats, class listings, etc.) assumes there's exactly
    # one, so unset any existing one before creating this one as current.
    if payload.is_current:
        db.query(models.AcademicYear).filter(
            models.AcademicYear.school_id == payload.school_id, models.AcademicYear.is_current == True,  # noqa: E712
        ).update({"is_current": False})

    year = models.AcademicYear(**payload.model_dump())
    db.add(year)
    db.flush()  # get year.id before creating classes against it

    ladder = HIGHER_SECONDARY_LADDER if school.education_level == "higher_secondary" else HIGH_SCHOOL_LADDER
    for index, (class_name, stage) in enumerate(ladder):
        db.add(models.SchoolClass(
            school_id=school.id,
            academic_year_id=year.id,
            name=class_name,
            order_index=index,
            stage=stage,
        ))

    db.commit()
    db.refresh(year)
    return year


@router.get("/", response_model=list[schemas.AcademicYearOut])
def list_academic_years(school_id: int, db: Session = Depends(get_db)):
    return db.query(models.AcademicYear).filter(
        models.AcademicYear.school_id == school_id
    ).order_by(models.AcademicYear.start_date.desc()).all()


@router.get("/{year_id}", response_model=schemas.AcademicYearOut)
def get_academic_year(year_id: int, db: Session = Depends(get_db)):
    year = db.query(models.AcademicYear).filter(models.AcademicYear.id == year_id).first()
    if not year:
        raise HTTPException(status_code=404, detail="Academic year not found")
    return year


@router.patch("/{year_id}", response_model=schemas.AcademicYearOut, dependencies=[Depends(require_roles(*SESSION_MANAGEMENT_ROLES))])
def update_academic_year(year_id: int, payload: schemas.AcademicYearUpdate, db: Session = Depends(get_db)):
    year = db.query(models.AcademicYear).filter(models.AcademicYear.id == year_id).first()
    if not year:
        raise HTTPException(status_code=404, detail="Academic year not found")

    updates = payload.model_dump(exclude_unset=True)
    if updates.get("is_current"):
        db.query(models.AcademicYear).filter(
            models.AcademicYear.school_id == year.school_id, models.AcademicYear.id != year_id,
            models.AcademicYear.is_current == True,  # noqa: E712
        ).update({"is_current": False})

    for field, value in updates.items():
        setattr(year, field, value)

    db.commit()
    db.refresh(year)
    return year


@router.get("/{year_id}/stats", response_model=schemas.AcademicYearStatsOut)
def get_academic_year_stats(year_id: int, db: Session = Depends(get_db)):
    """
    The drill-down view — everything meaningfully scoped to one
    academic year in one place, so clicking into a past session
    actually shows something, not just its start/end dates.
    """
    year = db.query(models.AcademicYear).filter(models.AcademicYear.id == year_id).first()
    if not year:
        raise HTTPException(status_code=404, detail="Academic year not found")

    classes = db.query(models.SchoolClass).filter(models.SchoolClass.academic_year_id == year_id).all()
    class_ids = [c.id for c in classes]
    sections = db.query(models.Section).filter(models.Section.school_class_id.in_(class_ids)).all() if class_ids else []
    section_ids = [s.id for s in sections]
    total_students = db.query(models.Student).filter(
        models.Student.academic_year_id == year_id, models.Student.is_active == True,  # noqa: E712
    ).count()
    total_staff = db.query(models.User).join(models.Role).filter(
        models.User.school_id == year.school_id, models.Role.name != "super_admin",
    ).count()

    invoices = db.query(models.StudentFeeInvoice).join(
        models.FeeStructure, models.StudentFeeInvoice.fee_structure_id == models.FeeStructure.id
    ).filter(models.FeeStructure.academic_year_id == year_id).all()
    total_billed = sum(inv.amount_due for inv in invoices)
    total_collected = sum(inv.amount_paid for inv in invoices)

    return schemas.AcademicYearStatsOut(
        academic_year_id=year.id, label=year.label, is_current=year.is_current,
        total_classes=len(classes), total_sections=len(section_ids), total_students=total_students,
        total_staff=total_staff, total_fee_collected=total_collected, total_fee_billed=total_billed,
    )

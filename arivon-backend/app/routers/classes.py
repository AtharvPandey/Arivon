"""
Classes are NOT manually creatable through this router anymore — the
full class ladder (Nursery through Class 10 or 12) is auto-provisioned
the moment an Academic Year is created (see academic_years.py). This
router only exposes reading them, plus creating/reading Sections.

Sections are auto-lettered in strict sequence (A, then B, then C...) —
there is no way to request an arbitrary letter or skip ahead.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app import models, schemas
from app.core.deps import require_roles

router = APIRouter(tags=["classes"])


@router.post(
    "/classes/deduplicate",
    dependencies=[Depends(require_roles("school_admin", "administrator", "principal", "super_admin"))],
)
def deduplicate_classes(school_id: int, db: Session = Depends(get_db)):
    """
    One-time cleanup for the exact bug found in the Sections tab —
    duplicate class rows (e.g. two "Class 11" rows) within the same
    academic year, left over from provisioning having run more than
    once at some point. Must be run BEFORE the migration that adds the
    (academic_year_id, name) unique constraint, or that migration will
    fail against a database that still has the duplicates.

    For each duplicate group, keeps the LOWEST id (the original) and
    reassigns every Section, FeeStructure, ClassSubject, and
    SyllabusChapter row pointing at a duplicate over to the survivor
    before deleting the duplicate rows — nothing referencing a
    duplicate class is silently orphaned.
    """
    classes = db.query(models.SchoolClass).filter(models.SchoolClass.school_id == school_id).all()

    groups: dict[tuple, list] = {}
    for c in classes:
        groups.setdefault((c.academic_year_id, c.name), []).append(c)

    merged_summary = []
    for (year_id, name), group in groups.items():
        if len(group) <= 1:
            continue
        group.sort(key=lambda c: c.id)
        survivor = group[0]
        duplicates = group[1:]

        for dup in duplicates:
            db.query(models.Section).filter(models.Section.school_class_id == dup.id).update(
                {"school_class_id": survivor.id}
            )
            db.query(models.FeeStructure).filter(models.FeeStructure.school_class_id == dup.id).update(
                {"school_class_id": survivor.id}
            )
            db.query(models.ClassSubject).filter(models.ClassSubject.school_class_id == dup.id).update(
                {"school_class_id": survivor.id}
            )
            db.query(models.SyllabusChapter).filter(models.SyllabusChapter.school_class_id == dup.id).update(
                {"school_class_id": survivor.id}
            )
            db.delete(dup)

        merged_summary.append({
            "class_name": name, "kept_id": survivor.id,
            "removed_ids": [d.id for d in duplicates],
        })

    db.commit()
    return {"merged_groups": len(merged_summary), "details": merged_summary}


@router.get("/classes/", response_model=list[schemas.SchoolClassOut])
def list_classes(school_id: int, academic_year_id: int | None = None, db: Session = Depends(get_db)):
    """
    Fixed a real bug here: this previously filtered ONLY by school_id,
    with no academic_year_id filter at all. A school with more than one
    AcademicYear row (e.g. a new year created for the next session)
    would have every year's classes flattened into one list together —
    which is exactly what made classes look duplicated in the Sections
    tab. Defaults to the school's current academic year when not
    explicitly specified, matching how Section/Student are already
    properly scoped everywhere else.
    """
    query = db.query(models.SchoolClass).filter(models.SchoolClass.school_id == school_id)

    if academic_year_id is not None:
        query = query.filter(models.SchoolClass.academic_year_id == academic_year_id)
    else:
        current_year = db.query(models.AcademicYear).filter(
            models.AcademicYear.school_id == school_id, models.AcademicYear.is_current == True,  # noqa: E712
        ).first()
        if current_year:
            query = query.filter(models.SchoolClass.academic_year_id == current_year.id)

    return query.order_by(models.SchoolClass.order_index).all()


def _next_section_letter(db: Session, school_class_id: int) -> str:
    existing = db.query(models.Section).filter(
        models.Section.school_class_id == school_class_id
    ).order_by(models.Section.name).all()

    if not existing:
        return "A"

    # Sections must always be a clean, gapless sequence — if somehow
    # existing data has a gap, we still only ever extend one letter past
    # the last one actually present, never guess or backfill a gap silently.
    last_letter = existing[-1].name
    return chr(ord(last_letter) + 1)


@router.post("/sections/", response_model=schemas.SectionOut, status_code=201)
def create_section(payload: schemas.SectionCreate, db: Session = Depends(get_db)):
    school_class = db.query(models.SchoolClass).filter(
        models.SchoolClass.id == payload.school_class_id
    ).first()
    if not school_class:
        raise HTTPException(status_code=404, detail="Class not found")

    next_letter = _next_section_letter(db, payload.school_class_id)
    if next_letter > "Z":
        raise HTTPException(status_code=400, detail="Maximum of 26 sections (A-Z) per class reached")

    section = models.Section(
        school_class_id=payload.school_class_id,
        name=next_letter,
        capacity=payload.capacity,
        class_teacher_id=payload.class_teacher_id,
    )
    db.add(section)
    db.commit()
    db.refresh(section)
    return section


@router.patch("/sections/{section_id}", response_model=schemas.SectionOut)
def update_section(section_id: int, payload: schemas.SectionUpdate, db: Session = Depends(get_db)):
    """
    The piece that was missing: capacity and class_teacher_id could only
    ever be set once, at creation. A school reassigning a class teacher
    mid-year (or correcting a capacity number) had no way to do it.
    """
    section = db.query(models.Section).filter(models.Section.id == section_id).first()
    if not section:
        raise HTTPException(status_code=404, detail="Section not found")

    updates = payload.model_dump(exclude_unset=True)
    for field, value in updates.items():
        setattr(section, field, value)

    db.commit()
    db.refresh(section)
    return section


@router.get("/classes/{school_class_id}/sections", response_model=list[schemas.SectionOut])
def list_sections(school_class_id: int, db: Session = Depends(get_db)):
    return db.query(models.Section).filter(
        models.Section.school_class_id == school_class_id
    ).order_by(models.Section.name).all()


def _class_name_to_slug(name: str) -> str:
    """Nursery → nursery, Class 5 → class-5, LKG → lkg. Reversible per
    school scope: within one school+academic-year, class names are
    unique (guaranteed by the auto-provision logic), so slugs are too."""
    return name.strip().lower().replace(" ", "-")


def _section_name_to_slug(name: str) -> str:
    """Section A → a, Science A → science-a. Same rules as class slug.
    Higher classes typically name sections by stream ('Science A',
    'Commerce A', 'Arts B') — those slugify cleanly to science-a,
    commerce-a, arts-b, giving readable URLs like
    /classes/class-11/science-a."""
    return name.strip().lower().replace(" ", "-")


def _resolve_class(db: Session, class_key: str, school_id: int | None) -> models.SchoolClass:
    """Accept either a numeric ID or a slug like 'nursery' or 'class-5'.
    The URL a user sees is now readable ('nursery'), while the API
    remains backwards-compatible with the numeric-ID form used by the
    existing endpoints throughout the app."""
    if class_key.isdigit():
        return db.query(models.SchoolClass).filter(models.SchoolClass.id == int(class_key)).first()

    # Slug lookup — requires school_id since slugs are only unique per school+year
    if school_id is None:
        raise HTTPException(status_code=400, detail="school_id is required when looking up a class by slug")

    current_year = db.query(models.AcademicYear).filter(
        models.AcademicYear.school_id == school_id, models.AcademicYear.is_current == True,  # noqa: E712
    ).first()

    query = db.query(models.SchoolClass).filter(models.SchoolClass.school_id == school_id)
    if current_year:
        query = query.filter(models.SchoolClass.academic_year_id == current_year.id)

    for candidate in query.all():
        if _class_name_to_slug(candidate.name) == class_key.lower():
            return candidate
    return None


@router.get("/classes/{class_key}/detail", response_model=schemas.ClassDetailOut)
def get_class_detail(class_key: str, school_id: int | None = None, db: Session = Depends(get_db)):
    """
    Everything the Class page needs in one call: the class itself, its
    sections, and per-section headcount/gender split/class-teacher name.
    Avoids the N+3 waterfall the plain endpoints would force (fetch
    class → fetch sections → for each section: fetch teacher + count
    students + count by gender). Same server-side aggregation pattern
    as the dashboard and student-strength endpoints.

    Accepts either a numeric ID (e.g. `1`) or a readable slug (e.g.
    `nursery`, `class-5`) as `class_key`. Slug form requires a
    `school_id` query param since class slugs aren't globally unique.
    """
    school_class = _resolve_class(db, class_key, school_id)
    if not school_class:
        raise HTTPException(status_code=404, detail="Class not found")

    sections = db.query(models.Section).filter(
        models.Section.school_class_id == school_class.id
    ).order_by(models.Section.name).all()

    section_details = []
    class_total = class_boys = class_girls = 0

    for section in sections:
        students = db.query(models.Student).filter(
            models.Student.section_id == section.id, models.Student.is_active == True,  # noqa: E712
        ).all()
        boys = sum(1 for s in students if s.gender == "Male")
        girls = sum(1 for s in students if s.gender == "Female")
        other = len(students) - boys - girls

        teacher_name = None
        if section.class_teacher_id:
            teacher = db.query(models.User).filter(models.User.id == section.class_teacher_id).first()
            teacher_name = teacher.full_name if teacher else None

        section_details.append(schemas.SectionDetailOut(
            id=section.id, school_class_id=section.school_class_id,
            class_name=school_class.name, name=section.name, section_slug=_section_name_to_slug(section.name), capacity=section.capacity,
            class_teacher_id=section.class_teacher_id, class_teacher_name=teacher_name,
            total_students=len(students), boys=boys, girls=girls, other_gender=other,
        ))
        class_total += len(students)
        class_boys += boys
        class_girls += girls

    return schemas.ClassDetailOut(
        id=school_class.id, school_id=school_class.school_id,
        academic_year_id=school_class.academic_year_id, name=school_class.name,
        order_index=school_class.order_index, stage=school_class.stage,
        total_students=class_total, total_sections=len(sections),
        boys=class_boys, girls=class_girls, sections=section_details,
    )


@router.get("/classes/{class_key}/sections/{section_key}/detail", response_model=schemas.SectionDetailOut)
def get_nested_section_detail(class_key: str, section_key: str, school_id: int | None = None, db: Session = Depends(get_db)):
    """
    A section only exists WITHIN a class — so the URL that identifies it
    should too. This nested endpoint mirrors the URL structure
    /classes/{class}/sections/{section} that the UI actually uses, and
    accepts slug forms for both parts (e.g. class-11/science-a).
    Semantically cleaner than the flat /sections/{id} lookup, which
    stays available for anywhere internal code still relies on it.
    """
    school_class = _resolve_class(db, class_key, school_id)
    if not school_class:
        raise HTTPException(status_code=404, detail="Class not found")

    # Find the matching section within this class - by numeric ID or by slug
    if section_key.isdigit():
        section = db.query(models.Section).filter(
            models.Section.id == int(section_key),
            models.Section.school_class_id == school_class.id,
        ).first()
    else:
        section = None
        for candidate in db.query(models.Section).filter(models.Section.school_class_id == school_class.id).all():
            if _section_name_to_slug(candidate.name) == section_key.lower():
                section = candidate
                break

    if not section:
        raise HTTPException(status_code=404, detail="Section not found in this class")

    students = db.query(models.Student).filter(
        models.Student.section_id == section.id, models.Student.is_active == True,  # noqa: E712
    ).all()
    boys = sum(1 for s in students if s.gender == "Male")
    girls = sum(1 for s in students if s.gender == "Female")
    other = len(students) - boys - girls

    teacher_name = None
    if section.class_teacher_id:
        teacher = db.query(models.User).filter(models.User.id == section.class_teacher_id).first()
        teacher_name = teacher.full_name if teacher else None

    return schemas.SectionDetailOut(
        id=section.id, school_class_id=section.school_class_id,
        class_name=school_class.name,
        name=section.name, section_slug=_section_name_to_slug(section.name), capacity=section.capacity,
        class_teacher_id=section.class_teacher_id, class_teacher_name=teacher_name,
        total_students=len(students), boys=boys, girls=girls, other_gender=other,
    )


@router.get("/sections/{section_id}/detail", response_model=schemas.SectionDetailOut)
def get_section_detail(section_id: int, db: Session = Depends(get_db)):
    """Flat lookup - kept for backwards compatibility. New UI code should
    prefer /classes/{class}/sections/{section}/detail instead."""
    section = db.query(models.Section).filter(models.Section.id == section_id).first()
    if not section:
        raise HTTPException(status_code=404, detail="Section not found")

    school_class = db.query(models.SchoolClass).filter(models.SchoolClass.id == section.school_class_id).first()

    students = db.query(models.Student).filter(
        models.Student.section_id == section_id, models.Student.is_active == True,  # noqa: E712
    ).all()
    boys = sum(1 for s in students if s.gender == "Male")
    girls = sum(1 for s in students if s.gender == "Female")
    other = len(students) - boys - girls

    teacher_name = None
    if section.class_teacher_id:
        teacher = db.query(models.User).filter(models.User.id == section.class_teacher_id).first()
        teacher_name = teacher.full_name if teacher else None

    return schemas.SectionDetailOut(
        id=section.id, school_class_id=section.school_class_id,
        class_name=school_class.name if school_class else "—",
        name=section.name, section_slug=_section_name_to_slug(section.name), capacity=section.capacity,
        class_teacher_id=section.class_teacher_id, class_teacher_name=teacher_name,
        total_students=len(students), boys=boys, girls=girls, other_gender=other,
    )

"""
Teacher data scoping — a teacher should only ever see or act on the
sections they actually teach, never the whole school. The real source
of truth for "does this teacher teach this section" is the timetable
(TimetableSlot.teacher_id) — that's what's actually assigned period by
period, not a looser guess. Being a section's "class teacher" (the
homeroom/pastoral role, Section.class_teacher_id) also counts, since
that's a real, broader responsibility for that one section even
without necessarily teaching every subject in it.

This is a no-op for every other role (school_admin, principal, etc.) —
it only narrows things down for teacher accounts specifically.
"""

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app import models


def get_teacher_section_ids(db: Session, teacher_id: int) -> set[int]:
    from_timetable = {
        row[0] for row in db.query(models.TimetableSlot.section_id)
        .filter(models.TimetableSlot.teacher_id == teacher_id)
        .distinct()
        .all()
    }
    from_class_teacher = {
        row[0] for row in db.query(models.Section.id)
        .filter(models.Section.class_teacher_id == teacher_id)
        .all()
    }
    return from_timetable | from_class_teacher


def assert_teacher_can_access_section(db: Session, current_user: models.User, section_id: int) -> None:
    """Call this at the top of any endpoint that mutates or reads
    section-scoped data (attendance, homework, marks, etc.). Raises 403
    if the current user is a teacher not assigned to this section.
    Does nothing for any other role."""
    if current_user.role_name != "teacher":
        return
    allowed = get_teacher_section_ids(db, current_user.id)
    if section_id not in allowed:
        raise HTTPException(
            status_code=403,
            detail="You're not assigned to this class.",
        )


def assert_teacher_can_access_class_subject(db: Session, current_user: models.User, school_class_id: int, subject_id: int) -> None:
    """Syllabus is tracked per class+subject, not per section (the
    syllabus is the same across every section of one class) — so this
    checks a looser condition than assert_teacher_can_access_section:
    does this teacher teach this subject in ANY section of this class?
    A no-op for every role except teacher, same as the section check."""
    if current_user.role_name != "teacher":
        return
    taught = db.query(models.TimetableSlot).join(
        models.Section, models.TimetableSlot.section_id == models.Section.id
    ).filter(
        models.TimetableSlot.teacher_id == current_user.id,
        models.TimetableSlot.subject_id == subject_id,
        models.Section.school_class_id == school_class_id,
    ).first()
    if not taught:
        raise HTTPException(
            status_code=403,
            detail="You don't teach this subject in this class.",
        )

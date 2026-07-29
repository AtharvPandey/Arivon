"""
Homework & Assignments — deliberately basic tracking, not a full LMS.
A teacher creates homework for their subject+section, sets a due date,
and marks who's submitted. No file uploads, no grading.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app import models, schemas
from app.core.deps import get_current_user

router = APIRouter(prefix="/homework", tags=["homework"])


@router.post("/", response_model=schemas.HomeworkOut, status_code=201)
def create_homework(
    payload: schemas.HomeworkCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    section = db.query(models.Section).filter(models.Section.id == payload.section_id).first()
    if not section:
        raise HTTPException(status_code=404, detail="Section not found")
    subject = db.query(models.Subject).filter(models.Subject.id == payload.subject_id).first()
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")

    homework = models.Homework(
        school_id=current_user.school_id, section_id=payload.section_id, subject_id=payload.subject_id,
        title=payload.title, description=payload.description, due_date=payload.due_date,
        assigned_by_user_id=current_user.id,
    )
    db.add(homework)
    db.commit()
    db.refresh(homework)

    total_students = db.query(models.Student).filter(
        models.Student.section_id == payload.section_id, models.Student.is_active == True,  # noqa: E712
    ).count()

    return _to_out(homework, subject.name, total_students, 0)


@router.get("/", response_model=list[schemas.HomeworkOut])
def list_homework(school_id: int, section_id: int | None = None, db: Session = Depends(get_db)):
    query = db.query(models.Homework).filter(models.Homework.school_id == school_id)
    if section_id is not None:
        query = query.filter(models.Homework.section_id == section_id)
    homework_list = query.order_by(models.Homework.due_date.desc()).all()

    results = []
    for hw in homework_list:
        subject = db.query(models.Subject).filter(models.Subject.id == hw.subject_id).first()
        total_students = db.query(models.Student).filter(
            models.Student.section_id == hw.section_id, models.Student.is_active == True,  # noqa: E712
        ).count()
        submitted_count = db.query(models.HomeworkSubmission).filter(
            models.HomeworkSubmission.homework_id == hw.id, models.HomeworkSubmission.status == "submitted",
        ).count()
        results.append(_to_out(hw, subject.name if subject else "—", total_students, submitted_count))
    return results


@router.get("/{homework_id}/submissions", response_model=list[schemas.HomeworkSubmissionOut])
def get_homework_submissions(homework_id: int, db: Session = Depends(get_db)):
    """
    Every student in the section, with their submission status — a
    student with no HomeworkSubmission row defaults to "not_submitted"
    rather than requiring one to be pre-created for every student the
    moment homework is assigned.
    """
    homework = db.query(models.Homework).filter(models.Homework.id == homework_id).first()
    if not homework:
        raise HTTPException(status_code=404, detail="Homework not found")

    students = db.query(models.Student).filter(
        models.Student.section_id == homework.section_id, models.Student.is_active == True,  # noqa: E712
    ).all()
    submissions_by_student = {
        s.student_id: s.status
        for s in db.query(models.HomeworkSubmission).filter(models.HomeworkSubmission.homework_id == homework_id).all()
    }

    return [
        schemas.HomeworkSubmissionOut(
            student_id=s.id, student_name=s.full_name,
            status=submissions_by_student.get(s.id, "not_submitted"),
        )
        for s in students
    ]


@router.post("/{homework_id}/submissions", response_model=list[schemas.HomeworkSubmissionOut])
def mark_submissions(
    homework_id: int,
    payload: schemas.SubmissionMarkRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    homework = db.query(models.Homework).filter(models.Homework.id == homework_id).first()
    if not homework:
        raise HTTPException(status_code=404, detail="Homework not found")
    if payload.status not in ("submitted", "not_submitted"):
        raise HTTPException(status_code=400, detail="status must be 'submitted' or 'not_submitted'")

    for student_id in payload.student_ids:
        existing = db.query(models.HomeworkSubmission).filter(
            models.HomeworkSubmission.homework_id == homework_id,
            models.HomeworkSubmission.student_id == student_id,
        ).first()
        if existing:
            existing.status = payload.status
            existing.marked_by_user_id = current_user.id
        else:
            db.add(models.HomeworkSubmission(
                homework_id=homework_id, student_id=student_id,
                status=payload.status, marked_by_user_id=current_user.id,
            ))
    db.commit()

    return get_homework_submissions(homework_id, db)


def _to_out(hw: models.Homework, subject_name: str, total_students: int, submitted_count: int) -> schemas.HomeworkOut:
    return schemas.HomeworkOut(
        id=hw.id, school_id=hw.school_id, section_id=hw.section_id, subject_id=hw.subject_id,
        subject_name=subject_name, title=hw.title, description=hw.description, due_date=hw.due_date,
        assigned_by_user_id=hw.assigned_by_user_id, created_at=hw.created_at,
        total_students=total_students, submitted_count=submitted_count,
    )

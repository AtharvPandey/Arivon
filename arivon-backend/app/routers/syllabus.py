"""
Syllabus/Curriculum Tracking — chapter-wise completion per subject per
class. The completion % rollup is Admin-facing visibility (per the
School Admin plan); marking a chapter complete happens wherever a
teacher naturally would, since they're the only one who knows what's
actually been taught.
"""

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app import models, schemas
from app.core.deps import get_current_user
from app.core.teacher_scope import assert_teacher_can_access_class_subject

router = APIRouter(prefix="/syllabus", tags=["syllabus"])


@router.post("/chapters", response_model=schemas.SyllabusChapterOut, status_code=201)
def create_chapter(payload: schemas.SyllabusChapterCreate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    school_class = db.query(models.SchoolClass).filter(models.SchoolClass.id == payload.school_class_id).first()
    if not school_class:
        raise HTTPException(status_code=404, detail="Class not found")
    subject = db.query(models.Subject).filter(models.Subject.id == payload.subject_id).first()
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")

    chapter = models.SyllabusChapter(
        school_id=current_user.school_id, school_class_id=payload.school_class_id,
        subject_id=payload.subject_id, chapter_name=payload.chapter_name, order_index=payload.order_index,
    )
    db.add(chapter)
    db.commit()
    db.refresh(chapter)
    return chapter


@router.get("/progress", response_model=list[schemas.SyllabusProgressOut])
def get_syllabus_progress(
    school_id: int,
    school_class_id: int | None = None,
    subject_id: int | None = None,
    db: Session = Depends(get_db),
):
    """
    Grouped by (class, subject) — this is the Admin-facing rollup: how
    much of each subject's syllabus has actually been covered, across
    every class, in one view.
    """
    query = db.query(models.SyllabusChapter).filter(models.SyllabusChapter.school_id == school_id)
    if school_class_id is not None:
        query = query.filter(models.SyllabusChapter.school_class_id == school_class_id)
    if subject_id is not None:
        query = query.filter(models.SyllabusChapter.subject_id == subject_id)
    chapters = query.order_by(models.SyllabusChapter.order_index).all()

    grouped: dict[tuple, list] = {}
    for ch in chapters:
        key = (ch.school_class_id, ch.subject_id)
        grouped.setdefault(key, []).append(ch)

    results = []
    for (class_id, subj_id), chs in grouped.items():
        school_class = db.query(models.SchoolClass).filter(models.SchoolClass.id == class_id).first()
        subject = db.query(models.Subject).filter(models.Subject.id == subj_id).first()
        completed = sum(1 for c in chs if c.is_completed)
        results.append(schemas.SyllabusProgressOut(
            subject_id=subj_id, subject_name=subject.name if subject else "—",
            school_class_id=class_id, class_name=school_class.name if school_class else "—",
            total_chapters=len(chs), completed_chapters=completed,
            completion_pct=round((completed / len(chs)) * 100, 1) if chs else 0.0,
            chapters=chs,
        ))
    return results


@router.patch("/chapters/{chapter_id}/toggle", response_model=schemas.SyllabusChapterOut)
def toggle_chapter_completion(chapter_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    chapter = db.query(models.SyllabusChapter).filter(models.SyllabusChapter.id == chapter_id).first()
    if not chapter:
        raise HTTPException(status_code=404, detail="Chapter not found")

    assert_teacher_can_access_class_subject(db, current_user, chapter.school_class_id, chapter.subject_id)

    chapter.is_completed = not chapter.is_completed
    if chapter.is_completed:
        chapter.completed_at = datetime.utcnow()
        chapter.completed_by_user_id = current_user.id
    else:
        chapter.completed_at = None
        chapter.completed_by_user_id = None

    db.commit()
    db.refresh(chapter)
    return chapter

"""
Examinations — the biggest single module in Arivon. Four connected
pieces: Exam Setup (the exam + its per-subject schedule), Marks Entry
(with an Admin-lock + correction-request workflow instead of freely
editable marks forever), Result Processing (totals/percentages/grades/
ranks/promotion status — always COMPUTED live, never stored, so nothing
can drift out of sync with the underlying marks), and Report Cards
(PDF generation + physical parent-signature tracking).
"""

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app import models, schemas
from app.core.deps import get_current_user, require_roles

EXAM_SETUP_ROLES = ("academic_coordinator", "school_admin", "administrator", "principal", "super_admin")
MARKS_LOCK_ROLES = ("school_admin", "administrator", "principal", "vice_principal", "super_admin")

router = APIRouter(prefix="/exams", tags=["exams"])

GRACE_MARKS_THRESHOLD = 5  # a student failing a subject by this many marks or fewer is flagged for grace-mark review, not automatic detention


def percentage_to_grade(pct: float) -> str:
    """Standard CBSE-style 9-point scale — used for display on marks-
    based exams too, alongside the raw percentage, since most schools
    want both shown even when marks (not just grades) are entered."""
    if pct >= 91: return "A1"
    if pct >= 81: return "A2"
    if pct >= 71: return "B1"
    if pct >= 61: return "B2"
    if pct >= 51: return "C1"
    if pct >= 41: return "C2"
    if pct >= 33: return "D"
    if pct >= 21: return "E1"
    return "E2"


# ---------- Exam Setup ----------

@router.post("/", response_model=schemas.ExamOut, status_code=201, dependencies=[Depends(require_roles(*EXAM_SETUP_ROLES))])
def create_exam(payload: schemas.ExamCreate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    exam = models.Exam(
        school_id=current_user.school_id, academic_year_id=payload.academic_year_id,
        name=payload.name, exam_type=payload.exam_type, created_by_user_id=current_user.id,
    )
    db.add(exam)
    db.commit()
    db.refresh(exam)
    return exam


@router.get("/", response_model=list[schemas.ExamOut])
def list_exams(school_id: int, academic_year_id: int | None = None, db: Session = Depends(get_db)):
    query = db.query(models.Exam).filter(models.Exam.school_id == school_id)
    if academic_year_id is not None:
        query = query.filter(models.Exam.academic_year_id == academic_year_id)
    return query.order_by(models.Exam.created_at.desc()).all()


@router.get("/{exam_id}", response_model=schemas.ExamOut)
def get_exam(exam_id: int, db: Session = Depends(get_db)):
    exam = db.query(models.Exam).filter(models.Exam.id == exam_id).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")
    return exam


@router.patch("/{exam_id}/status", response_model=schemas.ExamOut, dependencies=[Depends(require_roles(*EXAM_SETUP_ROLES))])
def update_exam_status(exam_id: int, status: str, db: Session = Depends(get_db)):
    valid_statuses = {"draft", "scheduled", "ongoing", "completed", "results_published"}
    if status not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"status must be one of {valid_statuses}")
    exam = db.query(models.Exam).filter(models.Exam.id == exam_id).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")
    exam.status = status
    db.commit()
    db.refresh(exam)
    return exam


@router.post(
    "/{exam_id}/schedule", response_model=schemas.ExamScheduleOut, status_code=201,
    dependencies=[Depends(require_roles(*EXAM_SETUP_ROLES))],
)
def add_exam_schedule(exam_id: int, payload: schemas.ExamScheduleCreate, db: Session = Depends(get_db)):
    exam = db.query(models.Exam).filter(models.Exam.id == exam_id).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")

    existing = db.query(models.ExamSchedule).filter(
        models.ExamSchedule.exam_id == exam_id, models.ExamSchedule.school_class_id == payload.school_class_id,
        models.ExamSchedule.subject_id == payload.subject_id,
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="This subject is already scheduled for this class in this exam")

    schedule = models.ExamSchedule(exam_id=exam_id, **payload.model_dump())
    db.add(schedule)
    db.commit()
    db.refresh(schedule)
    return _schedule_to_out(db, schedule)


@router.get("/{exam_id}/schedule", response_model=list[schemas.ExamScheduleOut])
def list_exam_schedule(exam_id: int, school_class_id: int | None = None, db: Session = Depends(get_db)):
    query = db.query(models.ExamSchedule).filter(models.ExamSchedule.exam_id == exam_id)
    if school_class_id is not None:
        query = query.filter(models.ExamSchedule.school_class_id == school_class_id)
    schedules = query.order_by(models.ExamSchedule.exam_date).all()
    return [_schedule_to_out(db, s) for s in schedules]


@router.delete(
    "/schedule/{schedule_id}", status_code=204,
    dependencies=[Depends(require_roles(*EXAM_SETUP_ROLES))],
)
def delete_exam_schedule(schedule_id: int, db: Session = Depends(get_db)):
    schedule = db.query(models.ExamSchedule).filter(models.ExamSchedule.id == schedule_id).first()
    if not schedule:
        raise HTTPException(status_code=404, detail="Schedule entry not found")
    has_marks = db.query(models.ExamMarks).filter(models.ExamMarks.exam_schedule_id == schedule_id).first()
    if has_marks:
        raise HTTPException(status_code=400, detail="Cannot remove a paper that already has marks entered")
    db.delete(schedule)
    db.commit()


def _schedule_to_out(db: Session, schedule: models.ExamSchedule) -> schemas.ExamScheduleOut:
    school_class = db.query(models.SchoolClass).filter(models.SchoolClass.id == schedule.school_class_id).first()
    subject = db.query(models.Subject).filter(models.Subject.id == schedule.subject_id).first()
    return schemas.ExamScheduleOut(
        id=schedule.id, exam_id=schedule.exam_id, school_class_id=schedule.school_class_id,
        class_name=school_class.name if school_class else "—",
        subject_id=schedule.subject_id, subject_name=subject.name if subject else "—",
        exam_date=schedule.exam_date, start_time=schedule.start_time, end_time=schedule.end_time,
        room=schedule.room, max_marks=schedule.max_marks, passing_marks=schedule.passing_marks,
    )


# ---------- Marks Entry ----------

@router.get("/schedule/{schedule_id}/marks", response_model=list[schemas.ExamMarksOut])
def get_marks_for_entry(schedule_id: int, section_id: int, db: Session = Depends(get_db)):
    """
    Every student in the section, for this one paper — a student with
    no ExamMarks row yet just shows as ungraded, same lazy-row pattern
    as Homework submissions (no need to pre-create a blank row for
    every student the moment a schedule entry is made).
    """
    schedule = db.query(models.ExamSchedule).filter(models.ExamSchedule.id == schedule_id).first()
    if not schedule:
        raise HTTPException(status_code=404, detail="Schedule entry not found")

    students = db.query(models.Student).filter(
        models.Student.section_id == section_id, models.Student.is_active == True,  # noqa: E712
    ).all()
    marks_by_student = {
        m.student_id: m
        for m in db.query(models.ExamMarks).filter(models.ExamMarks.exam_schedule_id == schedule_id).all()
    }

    result = []
    for student in students:
        m = marks_by_student.get(student.id)
        result.append(schemas.ExamMarksOut(
            student_id=student.id, student_name=student.full_name,
            marks_obtained=m.marks_obtained if m else None, grade=m.grade if m else None,
            is_absent=m.is_absent if m else False, is_locked=m.is_locked if m else False,
            max_marks=schedule.max_marks, passing_marks=schedule.passing_marks,
        ))
    return result


@router.post("/schedule/{schedule_id}/marks", response_model=list[schemas.ExamMarksOut])
def enter_marks(
    schedule_id: int,
    payload: schemas.MarksEntryRequest,
    section_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Rejects the whole batch if ANY targeted student's marks are already
    locked — a teacher can't quietly slip a change past the lock by
    bulk-submitting; they have to go through the correction-request
    workflow for a locked entry instead.
    """
    schedule = db.query(models.ExamSchedule).filter(models.ExamSchedule.id == schedule_id).first()
    if not schedule:
        raise HTTPException(status_code=404, detail="Schedule entry not found")

    for entry in payload.entries:
        existing = db.query(models.ExamMarks).filter(
            models.ExamMarks.exam_schedule_id == schedule_id, models.ExamMarks.student_id == entry.student_id,
        ).first()
        if existing and existing.is_locked:
            raise HTTPException(
                status_code=400,
                detail=f"Marks for student {entry.student_id} are locked — use a correction request instead",
            )
        if entry.marks_obtained is not None and entry.marks_obtained > schedule.max_marks:
            raise HTTPException(status_code=400, detail=f"Marks cannot exceed the maximum ({schedule.max_marks})")

        if existing:
            existing.marks_obtained = entry.marks_obtained
            existing.grade = entry.grade
            existing.is_absent = entry.is_absent
            existing.entered_by_user_id = current_user.id
            existing.entered_at = datetime.utcnow()
        else:
            db.add(models.ExamMarks(
                exam_schedule_id=schedule_id, student_id=entry.student_id,
                marks_obtained=entry.marks_obtained, grade=entry.grade, is_absent=entry.is_absent,
                entered_by_user_id=current_user.id, entered_at=datetime.utcnow(),
            ))
    db.commit()

    return get_marks_for_entry(schedule_id, section_id, db)


@router.post(
    "/{exam_id}/marks/lock", dependencies=[Depends(require_roles(*MARKS_LOCK_ROLES))],
)
def lock_marks(exam_id: int, payload: schemas.MarksLockRequest, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    schedule = db.query(models.ExamSchedule).filter(
        models.ExamSchedule.exam_id == exam_id, models.ExamSchedule.school_class_id == payload.school_class_id,
        models.ExamSchedule.subject_id == payload.subject_id,
    ).first()
    if not schedule:
        raise HTTPException(status_code=404, detail="Schedule entry not found")

    marks = db.query(models.ExamMarks).filter(models.ExamMarks.exam_schedule_id == schedule.id).all()
    for m in marks:
        m.is_locked = True
        m.locked_by_user_id = current_user.id
        m.locked_at = datetime.utcnow()
    db.commit()
    return {"locked_count": len(marks)}


@router.post(
    "/{exam_id}/marks/unlock", dependencies=[Depends(require_roles(*MARKS_LOCK_ROLES))],
)
def unlock_marks(exam_id: int, payload: schemas.MarksLockRequest, db: Session = Depends(get_db)):
    schedule = db.query(models.ExamSchedule).filter(
        models.ExamSchedule.exam_id == exam_id, models.ExamSchedule.school_class_id == payload.school_class_id,
        models.ExamSchedule.subject_id == payload.subject_id,
    ).first()
    if not schedule:
        raise HTTPException(status_code=404, detail="Schedule entry not found")

    marks = db.query(models.ExamMarks).filter(models.ExamMarks.exam_schedule_id == schedule.id).all()
    for m in marks:
        m.is_locked = False
    db.commit()
    return {"unlocked_count": len(marks)}


# ---------- Correction Requests ----------

@router.post("/marks-correction", response_model=schemas.MarksCorrectionOut, status_code=201)
def request_correction(
    payload: schemas.MarksCorrectionCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    marks = db.query(models.ExamMarks).filter(models.ExamMarks.id == payload.exam_marks_id).first()
    if not marks:
        raise HTTPException(status_code=404, detail="Marks entry not found")
    if not marks.is_locked:
        raise HTTPException(status_code=400, detail="These marks aren't locked — edit them directly instead")

    request = models.MarksCorrectionRequest(
        exam_marks_id=payload.exam_marks_id, requested_by_user_id=current_user.id,
        old_marks=marks.marks_obtained, requested_marks=payload.requested_marks, reason=payload.reason,
    )
    db.add(request)
    db.commit()
    db.refresh(request)
    return _correction_to_out(db, request)


@router.get("/marks-correction", response_model=list[schemas.MarksCorrectionOut])
def list_corrections(exam_id: int, status: str | None = None, db: Session = Depends(get_db)):
    schedules = {s.id for s in db.query(models.ExamSchedule).filter(models.ExamSchedule.exam_id == exam_id).all()}
    marks_ids = {m.id for m in db.query(models.ExamMarks).filter(models.ExamMarks.exam_schedule_id.in_(schedules)).all()}
    query = db.query(models.MarksCorrectionRequest).filter(models.MarksCorrectionRequest.exam_marks_id.in_(marks_ids))
    if status:
        query = query.filter(models.MarksCorrectionRequest.status == status)
    return [_correction_to_out(db, r) for r in query.order_by(models.MarksCorrectionRequest.requested_at.desc()).all()]


@router.patch(
    "/marks-correction/{request_id}/approve", response_model=schemas.MarksCorrectionOut,
    dependencies=[Depends(require_roles(*MARKS_LOCK_ROLES))],
)
def approve_correction(
    request_id: int, payload: schemas.CorrectionReviewRequest,
    db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user),
):
    """Approving is what actually applies the corrected marks — the
    marks row stays locked throughout; only the value changes."""
    request = db.query(models.MarksCorrectionRequest).filter(models.MarksCorrectionRequest.id == request_id).first()
    if not request:
        raise HTTPException(status_code=404, detail="Correction request not found")
    if request.status != "pending":
        raise HTTPException(status_code=400, detail=f"This request is already {request.status}")

    marks = db.query(models.ExamMarks).filter(models.ExamMarks.id == request.exam_marks_id).first()
    marks.marks_obtained = request.requested_marks

    request.status = "approved"
    request.reviewed_by_user_id = current_user.id
    request.reviewed_at = datetime.utcnow()
    request.review_notes = payload.review_notes
    db.commit()
    db.refresh(request)
    return _correction_to_out(db, request)


@router.patch(
    "/marks-correction/{request_id}/reject", response_model=schemas.MarksCorrectionOut,
    dependencies=[Depends(require_roles(*MARKS_LOCK_ROLES))],
)
def reject_correction(
    request_id: int, payload: schemas.CorrectionReviewRequest,
    db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user),
):
    request = db.query(models.MarksCorrectionRequest).filter(models.MarksCorrectionRequest.id == request_id).first()
    if not request:
        raise HTTPException(status_code=404, detail="Correction request not found")
    if request.status != "pending":
        raise HTTPException(status_code=400, detail=f"This request is already {request.status}")

    request.status = "rejected"
    request.reviewed_by_user_id = current_user.id
    request.reviewed_at = datetime.utcnow()
    request.review_notes = payload.review_notes
    db.commit()
    db.refresh(request)
    return _correction_to_out(db, request)


def _correction_to_out(db: Session, r: models.MarksCorrectionRequest) -> schemas.MarksCorrectionOut:
    marks = db.query(models.ExamMarks).filter(models.ExamMarks.id == r.exam_marks_id).first()
    student = db.query(models.Student).filter(models.Student.id == marks.student_id).first() if marks else None
    schedule = db.query(models.ExamSchedule).filter(models.ExamSchedule.id == marks.exam_schedule_id).first() if marks else None
    subject = db.query(models.Subject).filter(models.Subject.id == schedule.subject_id).first() if schedule else None
    return schemas.MarksCorrectionOut(
        id=r.id, exam_marks_id=r.exam_marks_id, student_name=student.full_name if student else "—",
        subject_name=subject.name if subject else "—", old_marks=r.old_marks, requested_marks=r.requested_marks,
        reason=r.reason, status=r.status, requested_at=r.requested_at,
        reviewed_by_user_id=r.reviewed_by_user_id, review_notes=r.review_notes,
    )


# ---------- Result Processing ----------

@router.get("/{exam_id}/results", response_model=list[schemas.StudentResultOut])
def get_results(exam_id: int, section_id: int, db: Session = Depends(get_db)):
    """
    Computed entirely live — nothing about totals, percentages, grades,
    or ranks is ever stored. Ranking is within the section (the natural
    peer group a student is actually compared against day to day).
    """
    exam = db.query(models.Exam).filter(models.Exam.id == exam_id).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")

    section = db.query(models.Section).filter(models.Section.id == section_id).first()
    if not section:
        raise HTTPException(status_code=404, detail="Section not found")

    schedules = db.query(models.ExamSchedule).filter(
        models.ExamSchedule.exam_id == exam_id, models.ExamSchedule.school_class_id == section.school_class_id,
    ).all()
    students = db.query(models.Student).filter(
        models.Student.section_id == section_id, models.Student.is_active == True,  # noqa: E712
    ).all()

    provisional = []
    for student in students:
        subjects = []
        total_obtained, total_max = 0, 0
        for schedule in schedules:
            subject = db.query(models.Subject).filter(models.Subject.id == schedule.subject_id).first()
            marks = db.query(models.ExamMarks).filter(
                models.ExamMarks.exam_schedule_id == schedule.id, models.ExamMarks.student_id == student.id,
            ).first()
            obtained = marks.marks_obtained if marks else None
            is_absent = marks.is_absent if marks else False
            passed_subject = (obtained is not None and obtained >= schedule.passing_marks) if not is_absent else False

            subjects.append(schemas.SubjectResultItem(
                subject_id=schedule.subject_id, subject_name=subject.name if subject else "—",
                marks_obtained=obtained, grade=marks.grade if marks else None,
                max_marks=schedule.max_marks, passing_marks=schedule.passing_marks,
                is_absent=is_absent, passed=passed_subject,
            ))
            total_max += schedule.max_marks
            total_obtained += obtained or 0

        pct = round((total_obtained / total_max) * 100, 2) if total_max > 0 else 0.0
        overall_passed = all(s.passed for s in subjects) if subjects else False

        provisional.append((student, subjects, total_obtained, total_max, pct, overall_passed))

    # Rank by percentage, descending — computed after the full section's
    # results are assembled, since rank is inherently relative to peers.
    provisional.sort(key=lambda p: p[4], reverse=True)

    results = []
    for rank, (student, subjects, total_obtained, total_max, pct, overall_passed) in enumerate(provisional, start=1):
        results.append(schemas.StudentResultOut(
            student_id=student.id, student_name=student.full_name, admission_number=student.admission_number,
            subjects=subjects, total_obtained=total_obtained, total_max=total_max, percentage=pct,
            overall_grade=percentage_to_grade(pct), passed=overall_passed, rank=rank,
        ))
    return results


@router.get("/{exam_id}/analysis", response_model=list[schemas.SubjectAnalysisItem])
def get_subject_analysis(exam_id: int, school_class_id: int, db: Session = Depends(get_db)):
    """Subject-wise performance across every section of one class —
    average, highest, lowest, and pass rate per subject."""
    schedules = db.query(models.ExamSchedule).filter(
        models.ExamSchedule.exam_id == exam_id, models.ExamSchedule.school_class_id == school_class_id,
    ).all()

    results = []
    for schedule in schedules:
        subject = db.query(models.Subject).filter(models.Subject.id == schedule.subject_id).first()
        marks = db.query(models.ExamMarks).filter(
            models.ExamMarks.exam_schedule_id == schedule.id, models.ExamMarks.is_absent == False,  # noqa: E712
            models.ExamMarks.marks_obtained.isnot(None),
        ).all()

        if not marks:
            results.append(schemas.SubjectAnalysisItem(
                subject_id=schedule.subject_id, subject_name=subject.name if subject else "—",
                students_appeared=0, average_marks=0.0, highest_marks=0, lowest_marks=0,
                pass_count=0, pass_percentage=0.0,
            ))
            continue

        values = [m.marks_obtained for m in marks]
        pass_count = sum(1 for v in values if v >= schedule.passing_marks)
        results.append(schemas.SubjectAnalysisItem(
            subject_id=schedule.subject_id, subject_name=subject.name if subject else "—",
            students_appeared=len(values), average_marks=round(sum(values) / len(values), 1),
            highest_marks=max(values), lowest_marks=min(values),
            pass_count=pass_count, pass_percentage=round((pass_count / len(values)) * 100, 1),
        ))
    return results


@router.get("/{exam_id}/promotion-list", response_model=list[schemas.PromotionListItem])
def get_promotion_list(exam_id: int, section_id: int, db: Session = Depends(get_db)):
    """
    Pass/detained/grace-zone determination — a student who fails exactly
    one subject by GRACE_MARKS_THRESHOLD marks or fewer is flagged for
    manual grace-mark review rather than automatically detained;
    anyone failing more than one subject, or failing by more than the
    threshold, is a clear detention case.
    """
    results = get_results(exam_id, section_id, db)

    items = []
    for r in results:
        failed_subjects = [s for s in r.subjects if not s.passed]
        if not failed_subjects:
            status_label = "pass"
        elif len(failed_subjects) == 1 and (failed_subjects[0].passing_marks - (failed_subjects[0].marks_obtained or 0)) <= GRACE_MARKS_THRESHOLD:
            status_label = "grace_zone"
        else:
            status_label = "detained"

        items.append(schemas.PromotionListItem(
            student_id=r.student_id, student_name=r.student_name, admission_number=r.admission_number,
            percentage=r.percentage, status=status_label,
            failed_subjects=[s.subject_name for s in failed_subjects],
        ))
    return items


# ---------- Report Cards & Signatures ----------

@router.post("/{exam_id}/report-card/{student_id}", response_model=schemas.GenerateReportCardResponse)
def generate_report_card(exam_id: int, student_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    from app.core.certificates import generate_report_card_pdf

    exam = db.query(models.Exam).filter(models.Exam.id == exam_id).first()
    student = db.query(models.Student).filter(models.Student.id == student_id).first()
    if not exam or not student:
        raise HTTPException(status_code=404, detail="Exam or student not found")

    results = get_results(exam_id, student.section_id, db)
    student_result = next((r for r in results if r.student_id == student_id), None)
    if not student_result:
        raise HTTPException(status_code=404, detail="No results found for this student in this exam")

    school = db.query(models.School).filter(models.School.id == student.school_id).first()
    section = db.query(models.Section).filter(models.Section.id == student.section_id).first()
    school_class = db.query(models.SchoolClass).filter(models.SchoolClass.id == section.school_class_id).first() if section else None

    stored_filename = generate_report_card_pdf(
        student, school, exam, student_result,
        school_class.name if school_class else "—", section.name if section else "—",
    )

    document = models.Document(
        school_id=student.school_id, entity_type="student", entity_id=student.id,
        document_type="report_card", original_filename=f"ReportCard_{exam.name}_{student.full_name.replace(' ', '_')}.pdf",
        stored_filename=stored_filename, uploaded_by_user_id=current_user.id,
    )
    db.add(document)
    db.commit()
    db.refresh(document)

    return schemas.GenerateReportCardResponse(document_id=document.id, download_url=f"/documents/{document.id}/download")


@router.get("/{exam_id}/signatures", response_model=dict)
def get_signatures(exam_id: int, section_id: int, db: Session = Depends(get_db)):
    students = db.query(models.Student).filter(
        models.Student.section_id == section_id, models.Student.is_active == True,  # noqa: E712
    ).all()
    signatures = {
        s.student_id: s
        for s in db.query(models.ReportCardSignature).filter(models.ReportCardSignature.exam_id == exam_id).all()
    }
    return {
        str(student.id): {
            "student_name": student.full_name,
            "signed": signatures[student.id].signed if student.id in signatures else False,
            "signed_date": signatures[student.id].signed_date.isoformat() if student.id in signatures and signatures[student.id].signed_date else None,
        }
        for student in students
    }


@router.patch("/{exam_id}/signatures/{student_id}")
def update_signature(
    exam_id: int, student_id: int, payload: schemas.ReportCardSignatureUpdate,
    db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user),
):
    signature = db.query(models.ReportCardSignature).filter(
        models.ReportCardSignature.exam_id == exam_id, models.ReportCardSignature.student_id == student_id,
    ).first()
    if signature:
        signature.signed = payload.signed
        signature.signed_date = payload.signed_date
        signature.recorded_by_user_id = current_user.id
    else:
        db.add(models.ReportCardSignature(
            exam_id=exam_id, student_id=student_id, signed=payload.signed,
            signed_date=payload.signed_date, recorded_by_user_id=current_user.id,
        ))
    db.commit()
    return {"success": True}

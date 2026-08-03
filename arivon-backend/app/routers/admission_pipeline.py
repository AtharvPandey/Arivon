"""
Admission Pipeline (Phase 3) — the real CRM-grade workflow, built on
top of app/services/admissions_engine.py (Phase 1's state machine).

This file starts with the Inquiries module: Lead creation, advancing
to Inquiry, counselor assignment, Counseling sessions, and the handoff
into a full Application. Later phases add Applications, Verification,
Tests, Interviews, Decisions, Fee Collection, and Reports as their own
route groups in this same file (or split out if it grows too large).
"""

import json
from datetime import date as date_type

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app import models, schemas
from app.core.deps import get_current_user, require_roles
from app.services import admissions_engine as engine

router = APIRouter(prefix="/admission-pipeline", tags=["admission-pipeline"])

# Viewing the pipeline is oversight - anyone who could reasonably need
# to see where an applicant stands. Writing (creating leads, advancing
# stages) is Admissions Officer's actual job, with School Admin/
# Administrator/Super Admin able to do it too since they oversee the
# whole school. Counselor ASSIGNMENT is separate from these lists
# entirely - per the confirmed decision, any staff member can be
# assigned, it's not a role restriction.
PIPELINE_VIEW_ROLES = ("admissions_officer", "school_admin", "administrator", "principal", "vice_principal", "academic_coordinator", "super_admin")
PIPELINE_WRITE_ROLES = ("admissions_officer", "school_admin", "administrator", "super_admin")


def _get_application_or_404(db: Session, application_id: int) -> models.AdmissionApplication:
    application = db.query(models.AdmissionApplication).filter(
        models.AdmissionApplication.id == application_id
    ).first()
    if not application:
        raise HTTPException(status_code=404, detail="Application not found")
    return application


def _to_pipeline_out(db: Session, application: models.AdmissionApplication) -> schemas.PipelineApplicationOut:
    school_class = None
    if application.applying_for_class_id:
        school_class = db.query(models.SchoolClass).filter(models.SchoolClass.id == application.applying_for_class_id).first()
    counselor = None
    if application.assigned_counselor_user_id:
        counselor = db.query(models.User).filter(models.User.id == application.assigned_counselor_user_id).first()

    return schemas.PipelineApplicationOut(
        id=application.id, school_id=application.school_id, academic_year_id=application.academic_year_id,
        stage=application.stage, source=application.source, student_name=application.student_name,
        parent_name=application.parent_name, phone=application.phone, email=application.email,
        applying_for_class_id=application.applying_for_class_id,
        applying_for_class_name=school_class.name if school_class else None,
        date_of_birth=application.date_of_birth, gender=application.gender,
        current_school=application.current_school, address=application.address,
        assigned_counselor_user_id=application.assigned_counselor_user_id,
        assigned_counselor_name=counselor.full_name if counselor else None,
        guardian_id=application.guardian_id, decision=application.decision,
        decision_reason=application.decision_reason, lost_reason=application.lost_reason,
        converted_student_id=application.converted_student_id, notes=application.notes,
        created_at=application.created_at, updated_at=application.updated_at,
    )


@router.post(
    "/leads", response_model=schemas.PipelineApplicationOut, status_code=201,
    dependencies=[Depends(require_roles(*PIPELINE_WRITE_ROLES))],
)
def create_lead(payload: schemas.LeadCreate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    application = engine.create_lead(
        db, school_id=payload.school_id, academic_year_id=payload.academic_year_id, source=payload.source,
        student_name=payload.student_name, parent_name=payload.parent_name, phone=payload.phone,
        email=payload.email, created_by_user_id=current_user.id,
    )
    return _to_pipeline_out(db, application)


@router.get(
    "/inquiries", response_model=list[schemas.PipelineApplicationOut],
    dependencies=[Depends(require_roles(*PIPELINE_VIEW_ROLES))],
)
def list_inquiries(school_id: int, db: Session = Depends(get_db)):
    """Everyone still in the early funnel - Lead, Inquiry, or
    Counseling - not yet a formal Application. Once submitted, an
    applicant moves to the Applications module instead."""
    applications = db.query(models.AdmissionApplication).filter(
        models.AdmissionApplication.school_id == school_id,
        models.AdmissionApplication.stage.in_(["lead", "inquiry", "counseling"]),
    ).order_by(models.AdmissionApplication.created_at.desc()).all()
    return [_to_pipeline_out(db, a) for a in applications]


@router.get(
    "/applications/{application_id}", response_model=schemas.PipelineApplicationOut,
    dependencies=[Depends(require_roles(*PIPELINE_VIEW_ROLES))],
)
def get_application(application_id: int, db: Session = Depends(get_db)):
    application = _get_application_or_404(db, application_id)
    return _to_pipeline_out(db, application)


@router.get(
    "/applications/{application_id}/counseling-sessions", response_model=list[schemas.CounselingSessionOut],
    dependencies=[Depends(require_roles(*PIPELINE_VIEW_ROLES))],
)
def list_counseling_sessions(application_id: int, db: Session = Depends(get_db)):
    _get_application_or_404(db, application_id)
    sessions = db.query(models.CounselingSession).filter(
        models.CounselingSession.application_id == application_id
    ).order_by(models.CounselingSession.scheduled_at.desc()).all()
    result = []
    for s in sessions:
        counselor = db.query(models.User).filter(models.User.id == s.counselor_user_id).first()
        out = schemas.CounselingSessionOut.model_validate(s)
        out.counselor_name = counselor.full_name if counselor else None
        result.append(out)
    return result


@router.patch(
    "/applications/{application_id}/advance-to-inquiry", response_model=schemas.PipelineApplicationOut,
    dependencies=[Depends(require_roles(*PIPELINE_WRITE_ROLES))],
)
def advance_to_inquiry(application_id: int, payload: schemas.InquiryAdvanceRequest, db: Session = Depends(get_db)):
    application = _get_application_or_404(db, application_id)
    school_class = db.query(models.SchoolClass).filter(models.SchoolClass.id == payload.applying_for_class_id).first()
    if not school_class:
        raise HTTPException(status_code=404, detail="Class not found")
    application = engine.advance_to_inquiry(
        db, application, applying_for_class_id=payload.applying_for_class_id, date_of_birth=payload.date_of_birth,
        gender=payload.gender, current_school=payload.current_school, address=payload.address,
    )
    return _to_pipeline_out(db, application)


@router.patch(
    "/applications/{application_id}/assign-counselor", response_model=schemas.PipelineApplicationOut,
    dependencies=[Depends(require_roles(*PIPELINE_WRITE_ROLES))],
)
def assign_counselor(application_id: int, payload: schemas.AssignCounselorRequest, db: Session = Depends(get_db)):
    application = _get_application_or_404(db, application_id)
    staff = db.query(models.User).filter(models.User.id == payload.counselor_user_id).first()
    if not staff:
        raise HTTPException(status_code=404, detail="Staff member not found")
    application = engine.assign_counselor(db, application, payload.counselor_user_id)
    return _to_pipeline_out(db, application)


@router.post(
    "/applications/{application_id}/counseling-sessions", response_model=schemas.CounselingSessionOut, status_code=201,
    dependencies=[Depends(require_roles(*PIPELINE_WRITE_ROLES))],
)
def schedule_counseling(application_id: int, payload: schemas.CounselingSessionCreate, db: Session = Depends(get_db)):
    application = _get_application_or_404(db, application_id)
    staff = db.query(models.User).filter(models.User.id == payload.counselor_user_id).first()
    if not staff:
        raise HTTPException(status_code=404, detail="Staff member not found")
    session = engine.schedule_counseling(
        db, application, counselor_user_id=payload.counselor_user_id, scheduled_at=payload.scheduled_at,
    )
    out = schemas.CounselingSessionOut.model_validate(session)
    out.counselor_name = staff.full_name
    return out


@router.patch(
    "/counseling-sessions/{session_id}", response_model=schemas.CounselingSessionOut,
    dependencies=[Depends(require_roles(*PIPELINE_WRITE_ROLES))],
)
def record_counseling_outcome(session_id: int, payload: schemas.CounselingOutcomeUpdate, db: Session = Depends(get_db)):
    session = db.query(models.CounselingSession).filter(models.CounselingSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Counseling session not found")
    session = engine.record_counseling_outcome(
        db, session, discussion_notes=payload.discussion_notes, follow_up_date=payload.follow_up_date, outcome=payload.outcome,
    )
    counselor = db.query(models.User).filter(models.User.id == session.counselor_user_id).first()
    out = schemas.CounselingSessionOut.model_validate(session)
    out.counselor_name = counselor.full_name if counselor else None
    return out


@router.post(
    "/applications/{application_id}/submit", response_model=schemas.PipelineApplicationOut,
    dependencies=[Depends(require_roles(*PIPELINE_WRITE_ROLES))],
)
def submit_application(application_id: int, payload: schemas.SubmitApplicationRequest, db: Session = Depends(get_db)):
    application = _get_application_or_404(db, application_id)

    guardian_id = payload.guardian_id
    if not guardian_id:
        if not payload.guardian_full_name or not payload.guardian_phone:
            raise HTTPException(status_code=400, detail="Provide either guardian_id or guardian_full_name + guardian_phone to create one.")
        guardian = models.Guardian(
            school_id=application.school_id, full_name=payload.guardian_full_name,
            phone=payload.guardian_phone, email=payload.guardian_email,
        )
        db.add(guardian)
        db.commit()
        db.refresh(guardian)
        guardian_id = guardian.id
    else:
        guardian = db.query(models.Guardian).filter(models.Guardian.id == guardian_id).first()
        if not guardian:
            raise HTTPException(status_code=404, detail="Guardian not found")

    application = engine.submit_application(
        db, application, guardian_id=guardian_id,
        full_application_json={
            "transport_required": payload.transport_required, "hostel_required": payload.hostel_required,
            "emergency_contact": payload.emergency_contact, "sibling_notes": payload.sibling_notes,
        },
    )
    return _to_pipeline_out(db, application)


@router.post(
    "/applications/{application_id}/mark-lost", response_model=schemas.PipelineApplicationOut,
    dependencies=[Depends(require_roles(*PIPELINE_WRITE_ROLES))],
)
def mark_lost(application_id: int, payload: schemas.MarkLostRequest, db: Session = Depends(get_db)):
    application = _get_application_or_404(db, application_id)
    application = engine.mark_lost(db, application, reason=payload.reason)
    return _to_pipeline_out(db, application)


@router.get(
    "/staff", response_model=list[schemas.StaffPickerOut],
    dependencies=[Depends(require_roles(*PIPELINE_VIEW_ROLES))],
)
def list_eligible_staff(school_id: int, db: Session = Depends(get_db)):
    """Every staff member at the school, for the counselor/interview-
    panel picker - deliberately not role-filtered, since counselor is
    an assignment anyone eligible can take on, not a fixed role."""
    staff = db.query(models.User).join(models.Role).filter(
        models.User.school_id == school_id, models.Role.name != "student", models.Role.name != "parent",
    ).all()
    return [schemas.StaffPickerOut(id=s.id, full_name=s.full_name, role_name=s.role_name) for s in staff]


# ---------------------------------------------------------------------
# Applications module - everyone past the early funnel (submitted
# through confirmed), plus every action along the way: verification,
# test, interview, decision, fee, confirm.
# ---------------------------------------------------------------------

@router.get(
    "/applications", response_model=list[schemas.PipelineApplicationOut],
    dependencies=[Depends(require_roles(*PIPELINE_VIEW_ROLES))],
)
def list_applications(school_id: int, stage: str | None = None, db: Session = Depends(get_db)):
    query = db.query(models.AdmissionApplication).filter(
        models.AdmissionApplication.school_id == school_id,
        models.AdmissionApplication.stage.notin_(["lead", "inquiry", "counseling"]),
    )
    if stage:
        query = query.filter(models.AdmissionApplication.stage == stage)
    applications = query.order_by(models.AdmissionApplication.updated_at.desc()).all()
    return [_to_pipeline_out(db, a) for a in applications]


@router.get(
    "/settings", response_model=schemas.AdmissionSettingsOut,
    dependencies=[Depends(require_roles(*PIPELINE_VIEW_ROLES))],
)
def get_admission_settings(school_id: int, db: Session = Depends(get_db)):
    settings = engine.get_settings(db, school_id)
    return schemas.AdmissionSettingsOut(
        school_id=settings.school_id, admission_number_format=settings.admission_number_format,
        enable_entrance_test=settings.enable_entrance_test, enable_interview=settings.enable_interview,
        required_documents=json.loads(settings.required_documents_json), classes_open=json.loads(settings.classes_open_json),
        application_fee=settings.application_fee,
    )


@router.patch(
    "/settings", response_model=schemas.AdmissionSettingsOut,
    dependencies=[Depends(require_roles(*PIPELINE_WRITE_ROLES))],
)
def update_admission_settings(school_id: int, payload: schemas.AdmissionSettingsUpdate, db: Session = Depends(get_db)):
    settings = engine.get_settings(db, school_id)
    data = payload.model_dump(exclude_unset=True)
    if "required_documents" in data:
        settings.required_documents_json = json.dumps(data.pop("required_documents"))
    if "classes_open" in data:
        settings.classes_open_json = json.dumps(data.pop("classes_open"))
    for key, value in data.items():
        setattr(settings, key, value)
    db.commit()
    db.refresh(settings)
    return schemas.AdmissionSettingsOut(
        school_id=settings.school_id, admission_number_format=settings.admission_number_format,
        enable_entrance_test=settings.enable_entrance_test, enable_interview=settings.enable_interview,
        required_documents=json.loads(settings.required_documents_json), classes_open=json.loads(settings.classes_open_json),
        application_fee=settings.application_fee,
    )


@router.post(
    "/applications/{application_id}/start-verification", response_model=schemas.PipelineApplicationOut,
    dependencies=[Depends(require_roles(*PIPELINE_WRITE_ROLES))],
)
def start_document_verification(application_id: int, db: Session = Depends(get_db)):
    application = _get_application_or_404(db, application_id)
    application = engine.start_document_verification(db, application)
    return _to_pipeline_out(db, application)


@router.get(
    "/applications/{application_id}/documents", response_model=list[schemas.DocumentSubmissionOut],
    dependencies=[Depends(require_roles(*PIPELINE_VIEW_ROLES))],
)
def list_documents(application_id: int, db: Session = Depends(get_db)):
    _get_application_or_404(db, application_id)
    docs = db.query(models.DocumentSubmission).filter(models.DocumentSubmission.application_id == application_id).all()
    result = []
    for d in docs:
        verifier = db.query(models.User).filter(models.User.id == d.verified_by_user_id).first() if d.verified_by_user_id else None
        out = schemas.DocumentSubmissionOut.model_validate(d)
        out.verified_by_name = verifier.full_name if verifier else None
        result.append(out)
    return result


@router.patch(
    "/documents/{document_id}", response_model=schemas.DocumentSubmissionOut,
    dependencies=[Depends(require_roles(*PIPELINE_WRITE_ROLES))],
)
def verify_document(document_id: int, payload: schemas.VerifyDocumentRequest, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    submission = db.query(models.DocumentSubmission).filter(models.DocumentSubmission.id == document_id).first()
    if not submission:
        raise HTTPException(status_code=404, detail="Document not found")
    submission = engine.verify_document(db, submission, status=payload.status, remarks=payload.remarks, verified_by_user_id=current_user.id)
    out = schemas.DocumentSubmissionOut.model_validate(submission)
    out.verified_by_name = current_user.full_name
    return out


@router.post(
    "/applications/{application_id}/advance-past-verification", response_model=schemas.PipelineApplicationOut,
    dependencies=[Depends(require_roles(*PIPELINE_WRITE_ROLES))],
)
def advance_past_verification(application_id: int, db: Session = Depends(get_db)):
    application = _get_application_or_404(db, application_id)
    application = engine.advance_past_verification(db, application)
    return _to_pipeline_out(db, application)


@router.post(
    "/applications/{application_id}/test-result", response_model=schemas.TestResultOut,
    dependencies=[Depends(require_roles(*PIPELINE_WRITE_ROLES))],
)
def record_test_result(application_id: int, payload: schemas.TestResultCreate, db: Session = Depends(get_db)):
    application = _get_application_or_404(db, application_id)
    result = engine.record_test_result(
        db, application, subjects=[s.model_dump() for s in payload.subjects],
        overall_score=payload.overall_score, recommendation=payload.recommendation,
    )
    return schemas.TestResultOut(
        id=result.id, application_id=result.application_id, conducted_at=result.conducted_at,
        subjects=json.loads(result.subjects_json), overall_score=result.overall_score, recommendation=result.recommendation,
    )


@router.get(
    "/applications/{application_id}/interviews", response_model=list[schemas.InterviewOut],
    dependencies=[Depends(require_roles(*PIPELINE_VIEW_ROLES))],
)
def list_interviews(application_id: int, db: Session = Depends(get_db)):
    _get_application_or_404(db, application_id)
    interviews = db.query(models.Interview).filter(models.Interview.application_id == application_id).order_by(models.Interview.scheduled_at.desc()).all()
    result = []
    for iv in interviews:
        panel_ids = json.loads(iv.panel_user_ids_json)
        panel_names = [u.full_name for u in db.query(models.User).filter(models.User.id.in_(panel_ids)).all()] if panel_ids else []
        result.append(schemas.InterviewOut(
            id=iv.id, application_id=iv.application_id, scheduled_at=iv.scheduled_at,
            panel_user_ids=panel_ids, panel_names=panel_names, remarks=iv.remarks, recommendation=iv.recommendation,
        ))
    return result


@router.post(
    "/applications/{application_id}/interviews", response_model=schemas.InterviewOut, status_code=201,
    dependencies=[Depends(require_roles(*PIPELINE_WRITE_ROLES))],
)
def schedule_interview(application_id: int, payload: schemas.InterviewCreate, db: Session = Depends(get_db)):
    application = _get_application_or_404(db, application_id)
    interview = engine.schedule_interview(db, application, scheduled_at=payload.scheduled_at, panel_user_ids=payload.panel_user_ids)
    panel_names = [u.full_name for u in db.query(models.User).filter(models.User.id.in_(payload.panel_user_ids)).all()]
    return schemas.InterviewOut(
        id=interview.id, application_id=interview.application_id, scheduled_at=interview.scheduled_at,
        panel_user_ids=payload.panel_user_ids, panel_names=panel_names, remarks=None, recommendation=None,
    )


@router.patch(
    "/interviews/{interview_id}", response_model=schemas.InterviewOut,
    dependencies=[Depends(require_roles(*PIPELINE_WRITE_ROLES))],
)
def record_interview_outcome(interview_id: int, payload: schemas.InterviewOutcomeUpdate, db: Session = Depends(get_db)):
    interview = db.query(models.Interview).filter(models.Interview.id == interview_id).first()
    if not interview:
        raise HTTPException(status_code=404, detail="Interview not found")
    interview = engine.record_interview_outcome(db, interview, remarks=payload.remarks, recommendation=payload.recommendation)
    panel_ids = json.loads(interview.panel_user_ids_json)
    panel_names = [u.full_name for u in db.query(models.User).filter(models.User.id.in_(panel_ids)).all()] if panel_ids else []
    return schemas.InterviewOut(
        id=interview.id, application_id=interview.application_id, scheduled_at=interview.scheduled_at,
        panel_user_ids=panel_ids, panel_names=panel_names, remarks=interview.remarks, recommendation=interview.recommendation,
    )


@router.post(
    "/applications/{application_id}/advance-past-interview", response_model=schemas.PipelineApplicationOut,
    dependencies=[Depends(require_roles(*PIPELINE_WRITE_ROLES))],
)
def advance_past_interview(application_id: int, db: Session = Depends(get_db)):
    application = _get_application_or_404(db, application_id)
    application = engine.advance_past_interview(db, application)
    return _to_pipeline_out(db, application)


@router.post(
    "/applications/{application_id}/decision", response_model=schemas.PipelineApplicationOut,
    dependencies=[Depends(require_roles("principal", "vice_principal", "school_admin", "administrator", "super_admin"))],
)
def make_decision(application_id: int, payload: schemas.DecisionRequest, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    """
    Deliberately a NARROWER role list than the rest of this router - an
    actual accept/reject/waitlist decision is a real call with
    consequences for the school, not routine data entry, so it needs
    Principal/VP or a School-Admin-tier role, not just Admissions
    Officer.
    """
    application = _get_application_or_404(db, application_id)
    application = engine.make_decision(
        db, application, decision=payload.decision, reason=payload.reason,
        decided_by_user_id=current_user.id, offer_valid_until=payload.offer_valid_until,
    )
    return _to_pipeline_out(db, application)


@router.get(
    "/applications/{application_id}/fee-invoices", response_model=list[schemas.PipelineFeeInvoiceOut],
    dependencies=[Depends(require_roles(*PIPELINE_VIEW_ROLES))],
)
def list_fee_invoices(application_id: int, db: Session = Depends(get_db)):
    _get_application_or_404(db, application_id)
    invoices = db.query(models.StudentFeeInvoice).filter(models.StudentFeeInvoice.admission_application_id == application_id).all()
    return invoices


@router.post(
    "/applications/{application_id}/fee-invoices", response_model=list[schemas.PipelineFeeInvoiceOut], status_code=201,
    dependencies=[Depends(require_roles(*PIPELINE_WRITE_ROLES))],
)
def generate_fee_invoices(application_id: int, payload: schemas.GenerateFeeInvoicesRequest, db: Session = Depends(get_db)):
    application = _get_application_or_404(db, application_id)
    invoices = engine.generate_admission_fee_invoices(db, application, fee_items=[item.model_dump() for item in payload.items])
    return invoices


@router.post(
    "/applications/{application_id}/confirm", response_model=schemas.StudentOut, status_code=201,
    dependencies=[Depends(require_roles(*PIPELINE_WRITE_ROLES))],
)
def confirm_admission(application_id: int, payload: schemas.ConfirmAdmissionRequest, db: Session = Depends(get_db)):
    application = _get_application_or_404(db, application_id)
    student = engine.confirm_admission(db, application, section_id=payload.section_id)
    return student


# ---------------------------------------------------------------------
# Students Joined - the operational handoff. Every student who came
# through this pipeline, with exactly what still needs doing after
# confirmation surfaced directly (roll number not yet assigned, fees
# not yet fully paid) rather than assuming confirmation finished
# everything.
# ---------------------------------------------------------------------

@router.get(
    "/students-joined", response_model=list[schemas.StudentJoinedOut],
    dependencies=[Depends(require_roles(*PIPELINE_VIEW_ROLES))],
)
def list_students_joined(school_id: int, db: Session = Depends(get_db)):
    applications = db.query(models.AdmissionApplication).filter(
        models.AdmissionApplication.school_id == school_id,
        models.AdmissionApplication.stage == "admission_confirmed",
        models.AdmissionApplication.converted_student_id.isnot(None),
    ).order_by(models.AdmissionApplication.updated_at.desc()).all()

    result = []
    for app in applications:
        student = db.query(models.Student).filter(models.Student.id == app.converted_student_id).first()
        if not student:
            continue
        section = db.query(models.Section).filter(models.Section.id == student.section_id).first() if student.section_id else None
        school_class = db.query(models.SchoolClass).filter(models.SchoolClass.id == section.school_class_id).first() if section else None

        invoices = db.query(models.StudentFeeInvoice).filter(
            models.StudentFeeInvoice.admission_application_id == app.id
        ).all()
        fee_total_due = sum(inv.amount_due for inv in invoices)
        fee_total_paid = sum(inv.amount_paid for inv in invoices)

        try:
            app_json = json.loads(app.full_application_json) if app.full_application_json else {}
        except (json.JSONDecodeError, TypeError):
            app_json = {}

        result.append(schemas.StudentJoinedOut(
            student_id=student.id, application_id=app.id, full_name=student.full_name,
            admission_number=student.admission_number, roll_number=student.roll_number,
            school_class_name=school_class.name if school_class else None,
            section_name=section.name if section else None,
            guardian_name=student.guardian_name, guardian_phone=student.guardian_phone, guardian_email=student.guardian_email,
            confirmed_at=app.updated_at, transport_required=app_json.get("transport_required", False),
            hostel_required=app_json.get("hostel_required", False),
            fee_total_due=fee_total_due, fee_total_paid=fee_total_paid, fee_fully_paid=(fee_total_paid >= fee_total_due),
        ))
    return result


@router.patch(
    "/students-joined/{student_id}/roll-number", response_model=schemas.StudentJoinedOut,
    dependencies=[Depends(require_roles(*PIPELINE_WRITE_ROLES))],
)
def assign_roll_number(student_id: int, payload: schemas.AssignRollNumberRequest, db: Session = Depends(get_db)):
    student = db.query(models.Student).filter(models.Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    application = db.query(models.AdmissionApplication).filter(
        models.AdmissionApplication.converted_student_id == student_id
    ).first()
    if not application:
        raise HTTPException(status_code=404, detail="No admission application links to this student")

    student.roll_number = payload.roll_number
    db.commit()
    db.refresh(student)

    section = db.query(models.Section).filter(models.Section.id == student.section_id).first() if student.section_id else None
    school_class = db.query(models.SchoolClass).filter(models.SchoolClass.id == section.school_class_id).first() if section else None
    invoices = db.query(models.StudentFeeInvoice).filter(models.StudentFeeInvoice.admission_application_id == application.id).all()
    fee_total_due = sum(inv.amount_due for inv in invoices)
    fee_total_paid = sum(inv.amount_paid for inv in invoices)
    try:
        app_json = json.loads(application.full_application_json) if application.full_application_json else {}
    except (json.JSONDecodeError, TypeError):
        app_json = {}

    return schemas.StudentJoinedOut(
        student_id=student.id, application_id=application.id, full_name=student.full_name,
        admission_number=student.admission_number, roll_number=student.roll_number,
        school_class_name=school_class.name if school_class else None,
        section_name=section.name if section else None,
        guardian_name=student.guardian_name, guardian_phone=student.guardian_phone, guardian_email=student.guardian_email,
        confirmed_at=application.updated_at, transport_required=app_json.get("transport_required", False),
        hostel_required=app_json.get("hostel_required", False),
        fee_total_due=fee_total_due, fee_total_paid=fee_total_paid, fee_fully_paid=(fee_total_paid >= fee_total_due),
    )

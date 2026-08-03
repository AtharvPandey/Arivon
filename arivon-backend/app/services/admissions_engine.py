"""
The Admissions state machine — every function here enforces one legal
transition and nothing else. This is deliberately NOT spread across
router handlers: keeping every transition rule in one file is what
makes "can this application legally move from X to Y" answerable by
reading one place, not by tracing through a dozen endpoints.

Pipeline (in order):
    lead -> inquiry -> counseling -> application_submitted
         -> document_verification -> [admission_test] -> [interview]
         -> decision_pending -> approved -> fee_pending
         -> admission_confirmed
    (rejected / waitlisted are reachable from decision_pending, and
    are terminal-but-reopenable, not dead ends)

admission_test and interview are conditionally skipped based on the
school's AdmissionSettings — enforced here, not just hidden in the UI,
so a client can never force a skipped stage by calling the API directly.
"""

import json
from datetime import datetime

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app import models
from app.core.events import publish
from app.core.temp_password_utils import generate_temp_password


class AdmissionsError(HTTPException):
    def __init__(self, detail: str):
        super().__init__(status_code=400, detail=detail)


def get_settings(db: Session, school_id: int) -> models.AdmissionSettings:
    """Every school gets sensible defaults the first time this is
    called, rather than requiring an explicit setup step before
    Admissions can be used at all."""
    settings = db.query(models.AdmissionSettings).filter(
        models.AdmissionSettings.school_id == school_id
    ).first()
    if not settings:
        settings = models.AdmissionSettings(school_id=school_id)
        db.add(settings)
        db.commit()
        db.refresh(settings)
    return settings


def _require_stage(application: models.AdmissionApplication, *allowed: str):
    if application.stage not in allowed:
        raise AdmissionsError(
            f"This action needs the application to be at stage {allowed}, but it's currently '{application.stage}'."
        )


# ---------------------------------------------------------------------
# Lead -> Inquiry -> Counseling -> Application Submitted
# ---------------------------------------------------------------------

def create_lead(db: Session, *, school_id: int, academic_year_id: int, source: str,
                 student_name: str, parent_name: str, phone: str, email: str | None,
                 created_by_user_id: int) -> models.AdmissionApplication:
    application = models.AdmissionApplication(
        school_id=school_id, academic_year_id=academic_year_id, stage="lead",
        source=source, student_name=student_name, parent_name=parent_name,
        phone=phone, email=email, created_by_user_id=created_by_user_id,
    )
    db.add(application)
    db.commit()
    db.refresh(application)
    return application


def advance_to_inquiry(db: Session, application: models.AdmissionApplication, *, applying_for_class_id: int,
                        date_of_birth, gender: str | None, current_school: str | None, address: str | None) -> models.AdmissionApplication:
    _require_stage(application, "lead", "inquiry")
    application.applying_for_class_id = applying_for_class_id
    application.date_of_birth = date_of_birth
    application.gender = gender
    application.current_school = current_school
    application.address = address
    application.stage = "inquiry"
    db.commit()
    db.refresh(application)
    return application


def assign_counselor(db: Session, application: models.AdmissionApplication, counselor_user_id: int) -> models.AdmissionApplication:
    application.assigned_counselor_user_id = counselor_user_id
    db.commit()
    db.refresh(application)
    return application


def schedule_counseling(db: Session, application: models.AdmissionApplication, *, counselor_user_id: int,
                         scheduled_at: datetime) -> models.CounselingSession:
    _require_stage(application, "inquiry", "counseling")
    session = models.CounselingSession(
        application_id=application.id, counselor_user_id=counselor_user_id, scheduled_at=scheduled_at,
    )
    db.add(session)
    if application.stage == "inquiry":
        application.stage = "counseling"
    db.commit()
    db.refresh(session)
    return session


def record_counseling_outcome(db: Session, session: models.CounselingSession, *, discussion_notes: str | None,
                               follow_up_date, outcome: str) -> models.CounselingSession:
    session.discussion_notes = discussion_notes
    session.follow_up_date = follow_up_date
    session.outcome = outcome
    db.commit()
    db.refresh(session)
    return session


def submit_application(db: Session, application: models.AdmissionApplication, *, guardian_id: int,
                        full_application_json: dict) -> models.AdmissionApplication:
    _require_stage(application, "counseling", "application_submitted")
    if not application.applying_for_class_id:
        raise AdmissionsError("Can't submit an application before the applying class is set (see advance_to_inquiry).")
    application.guardian_id = guardian_id
    application.full_application_json = json.dumps(full_application_json, default=str)
    application.stage = "application_submitted"
    db.commit()
    db.refresh(application)
    return application


# ---------------------------------------------------------------------
# Document Verification
# ---------------------------------------------------------------------

def start_document_verification(db: Session, application: models.AdmissionApplication) -> models.AdmissionApplication:
    """Auto-creates one DocumentSubmission row per document type the
    school requires, so the officer sees a checklist rather than
    having to remember what's needed."""
    _require_stage(application, "application_submitted", "document_verification")
    settings = get_settings(db, application.school_id)
    required = json.loads(settings.required_documents_json)
    existing_types = {d.document_type for d in application.document_submissions}
    for doc_type in required:
        if doc_type not in existing_types:
            db.add(models.DocumentSubmission(application_id=application.id, document_type=doc_type))
    application.stage = "document_verification"
    db.commit()
    db.refresh(application)
    return application


def verify_document(db: Session, submission: models.DocumentSubmission, *, status: str, remarks: str | None,
                     verified_by_user_id: int) -> models.DocumentSubmission:
    if status not in ("verified", "rejected", "needs_reupload", "pending"):
        raise AdmissionsError(f"Unknown document status '{status}'.")
    submission.status = status
    submission.remarks = remarks
    submission.verified_by_user_id = verified_by_user_id
    submission.verified_at = datetime.utcnow()
    db.commit()
    db.refresh(submission)
    return submission


def advance_past_verification(db: Session, application: models.AdmissionApplication) -> models.AdmissionApplication:
    """Moves past document_verification only if every required
    document is actually verified — this is the guard that keeps a
    school's document requirements meaningful rather than decorative."""
    _require_stage(application, "document_verification")
    unverified = [d for d in application.document_submissions if d.status != "verified"]
    if unverified:
        raise AdmissionsError(
            f"{len(unverified)} document(s) still need to be verified before moving on."
        )
    settings = get_settings(db, application.school_id)
    if settings.enable_entrance_test:
        application.stage = "admission_test"
    elif settings.enable_interview:
        application.stage = "interview"
    else:
        application.stage = "decision_pending"
    db.commit()
    db.refresh(application)
    return application


# ---------------------------------------------------------------------
# Admission Test (optional) -> Interview (optional) -> Decision Pending
# ---------------------------------------------------------------------

def record_test_result(db: Session, application: models.AdmissionApplication, *, subjects: list[dict],
                        overall_score: int, recommendation: str) -> models.AdmissionTestResult:
    _require_stage(application, "admission_test")
    result = application.test_result or models.AdmissionTestResult(application_id=application.id)
    result.conducted_at = datetime.utcnow()
    result.subjects_json = json.dumps(subjects)
    result.overall_score = overall_score
    result.recommendation = recommendation
    db.add(result)

    settings = get_settings(db, application.school_id)
    application.stage = "interview" if settings.enable_interview else "decision_pending"
    db.commit()
    db.refresh(result)
    return result


def _append_note(application: models.AdmissionApplication, note: str) -> None:
    application.notes = f"{application.notes}\n{note}" if application.notes else note


def skip_test(db: Session, application: models.AdmissionApplication, *, reason: str, skipped_by_user_id: int) -> models.AdmissionApplication:
    """Skips the admission test for THIS one applicant, without
    creating a fake AdmissionTestResult that would misrepresent a test
    as having actually happened. Logged as an audit note on the
    application instead - real trail, honest data. The school-wide
    enable_entrance_test toggle still applies to every other
    applicant; this is a per-applicant override, not a setting change."""
    _require_stage(application, "admission_test")
    skipper = db.query(models.User).filter(models.User.id == skipped_by_user_id).first()
    _append_note(application, f"[Admission test skipped by {skipper.full_name if skipper else 'unknown'} on {datetime.utcnow().strftime('%Y-%m-%d')}: {reason}]")
    settings = get_settings(db, application.school_id)
    application.stage = "interview" if settings.enable_interview else "decision_pending"
    db.commit()
    db.refresh(application)
    return application


def skip_interview(db: Session, application: models.AdmissionApplication, *, reason: str, skipped_by_user_id: int) -> models.AdmissionApplication:
    """Same reasoning as skip_test - per-applicant override, honest
    audit note, no fake Interview record."""
    _require_stage(application, "interview")
    skipper = db.query(models.User).filter(models.User.id == skipped_by_user_id).first()
    _append_note(application, f"[Interview skipped by {skipper.full_name if skipper else 'unknown'} on {datetime.utcnow().strftime('%Y-%m-%d')}: {reason}]")
    application.stage = "decision_pending"
    db.commit()
    db.refresh(application)
    return application


def schedule_interview(db: Session, application: models.AdmissionApplication, *, scheduled_at: datetime,
                        panel_user_ids: list[int]) -> models.Interview:
    _require_stage(application, "interview")
    interview = models.Interview(
        application_id=application.id, scheduled_at=scheduled_at,
        panel_user_ids_json=json.dumps(panel_user_ids),
    )
    db.add(interview)
    db.commit()
    db.refresh(interview)
    return interview


def record_interview_outcome(db: Session, interview: models.Interview, *, remarks: str | None,
                              recommendation: str) -> models.Interview:
    interview.remarks = remarks
    interview.recommendation = recommendation
    db.commit()
    db.refresh(interview)
    return interview


def advance_past_interview(db: Session, application: models.AdmissionApplication) -> models.AdmissionApplication:
    _require_stage(application, "interview")
    application.stage = "decision_pending"
    db.commit()
    db.refresh(application)
    return application


# ---------------------------------------------------------------------
# Decision
# ---------------------------------------------------------------------

def make_decision(db: Session, application: models.AdmissionApplication, *, decision: str, reason: str | None,
                   decided_by_user_id: int, offer_valid_until=None) -> models.AdmissionApplication:
    _require_stage(application, "decision_pending", "rejected", "waitlisted")
    if decision not in ("approved", "waitlisted", "rejected"):
        raise AdmissionsError(f"Unknown decision '{decision}'.")

    application.decision = decision
    application.decision_reason = reason
    application.decided_by_user_id = decided_by_user_id
    application.decided_at = datetime.utcnow()
    application.offer_valid_until = offer_valid_until
    application.stage = "fee_pending" if decision == "approved" else decision
    db.commit()
    db.refresh(application)
    return application


# ---------------------------------------------------------------------
# Fee Payment -> Admission Confirmed -> Student Created
# ---------------------------------------------------------------------

def generate_admission_fee_invoices(db: Session, application: models.AdmissionApplication,
                                     fee_items: list[dict]) -> list[models.StudentFeeInvoice]:
    """fee_items: [{"description": "Registration Fee", "amount": 5000, "due_date": date(...)}, ...]
    Linked via admission_application_id only - student_id stays null
    until confirmation, since no Student exists yet."""
    _require_stage(application, "fee_pending")
    invoices = []
    for item in fee_items:
        invoice = models.StudentFeeInvoice(
            admission_application_id=application.id,
            description=item["description"],
            billing_period="Admission",
            due_date=item["due_date"],
            amount_due=item["amount"],
        )
        db.add(invoice)
        invoices.append(invoice)
    db.commit()
    for invoice in invoices:
        db.refresh(invoice)
    return invoices


def _generate_admission_number(db: Session, school_id: int, academic_year_id: int, settings: models.AdmissionSettings) -> str:
    academic_year = db.query(models.AcademicYear).filter(models.AcademicYear.id == academic_year_id).first()
    year_label = academic_year.label.split("-")[0] if academic_year else "0000"
    existing_count = db.query(models.Student).filter(
        models.Student.school_id == school_id, models.Student.academic_year_id == academic_year_id,
    ).count()
    seq = existing_count + 1
    candidate = settings.admission_number_format.format(year=year_label, seq=seq)
    while db.query(models.Student).filter(
        models.Student.school_id == school_id, models.Student.admission_number == candidate
    ).first():
        seq += 1
        candidate = settings.admission_number_format.format(year=year_label, seq=seq)
    return candidate


def confirm_admission(db: Session, application: models.AdmissionApplication, *, section_id: int | None = None) -> models.Student:
    """
    The one place an AdmissionApplication becomes a Student. Requires
    every admission-stage invoice linked to this application to be
    fully paid first — "Fee Payment" is a real gate, not a formality.

    Deliberately does NOT create parent/student portal logins or a
    Library membership — this system has no parent/student login
    concept yet (a separate, larger feature), and Library doesn't
    exist as a module. Both are left to the StudentEnrolled event
    below, which is exactly the seam a future module hooks into.
    """
    _require_stage(application, "fee_pending")

    unpaid = db.query(models.StudentFeeInvoice).filter(
        models.StudentFeeInvoice.admission_application_id == application.id,
        models.StudentFeeInvoice.status != "paid",
    ).count()
    if unpaid:
        raise AdmissionsError(f"{unpaid} admission invoice(s) are still unpaid.")

    settings = get_settings(db, application.school_id)
    guardian = db.query(models.Guardian).filter(models.Guardian.id == application.guardian_id).first()
    if not guardian:
        raise AdmissionsError("This application has no guardian on file - submit_application must set one.")

    admission_number = _generate_admission_number(db, application.school_id, application.academic_year_id, settings)

    student = models.Student(
        school_id=application.school_id,
        academic_year_id=application.academic_year_id,
        section_id=section_id,
        admission_number=admission_number,
        full_name=application.student_name,
        date_of_birth=application.date_of_birth,
        gender=application.gender,
        guardian_id=application.guardian_id,
        guardian_name=guardian.full_name,
        guardian_phone=guardian.phone,
        guardian_email=guardian.email,
    )
    db.add(student)
    db.flush()  # get student.id without a separate round trip

    # Hand off every admission-stage invoice to the new student - same
    # rows, same receipt numbers, just backfilling student_id.
    db.query(models.StudentFeeInvoice).filter(
        models.StudentFeeInvoice.admission_application_id == application.id
    ).update({"student_id": student.id})

    application.converted_student_id = student.id
    application.stage = "admission_confirmed"
    db.commit()
    db.refresh(student)

    publish("student_enrolled", {
        "student_id": student.id,
        "school_id": student.school_id,
        "academic_year_id": student.academic_year_id,
        "section_id": student.section_id,
        "admission_number": student.admission_number,
        "guardian_id": student.guardian_id,
        "application_id": application.id,
    }, db=db)

    return student


def mark_lost(db: Session, application: models.AdmissionApplication, *, reason: str) -> models.AdmissionApplication:
    """Can happen from any non-terminal stage - a family can drop out
    of the pipeline at any point, not just after a formal rejection."""
    if application.stage in ("admission_confirmed",):
        raise AdmissionsError("Can't mark a confirmed admission as lost.")
    application.lost_reason = reason
    application.stage = "rejected"
    db.commit()
    db.refresh(application)
    return application

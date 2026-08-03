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

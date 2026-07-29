"""
The Admissions workflow: Inquiry -> Submitted -> Under Review -> Offer Sent
-> Enrolled (or Rejected / Withdrawn at various points).

This is deliberately NOT the same as creating a Student directly. A
Student row means "enrolled here, today." An application can sit in
"under review" for weeks and never become a student at all. Enrollment
is an explicit, one-way action (see /enroll below) that creates the
actual Student record FROM the application data — not something that
happens automatically when a status changes.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app import models, schemas
from app.core.deps import get_current_user, require_roles
from app.routers.students import generate_admission_number

# The admissions workflow has two genuinely different kinds of actions,
# and treating them as one broad role list was the bug:
#   - VIEWING the pipeline is oversight — School Admin, Principal, VP,
#     Administrator, and Admissions Officer can all see it.
#   - CREATING a new inquiry is data entry that belongs to ONE
#     department — the Admissions Officer logs every inquiry that comes
#     in, nobody else does this.
#   - APPROVING an application — actually deciding to send an offer or
#     reject a candidate — is a real decision with consequences for the
#     school, not a data-entry task. That decision belongs to Principal
#     or Vice Principal, exactly like a leave approval does.
ADMISSIONS_VIEW_ROLES = ("admissions_officer", "school_admin", "administrator", "principal", "vice_principal", "super_admin")
ADMISSIONS_CREATE_ROLES = ("admissions_officer",)
ADMISSIONS_APPROVAL_ROLES = ("principal", "vice_principal")
# Transitions that represent an actual accept/reject DECISION, not
# routine administrative progression through the pipeline.
DECISION_TRANSITIONS = {"offer_sent", "rejected"}

router = APIRouter(
    prefix="/admissions",
    tags=["admissions"],
    dependencies=[Depends(require_roles(*ADMISSIONS_VIEW_ROLES))],
)

ALLOWED_TRANSITIONS = {
    "inquiry": {"submitted", "withdrawn"},
    "submitted": {"under_review", "withdrawn"},
    "under_review": {"offer_sent", "rejected", "withdrawn"},
    "offer_sent": {"enrolled", "rejected", "withdrawn"},
    "rejected": set(),
    "withdrawn": set(),
    "enrolled": set(),
}


@router.post(
    "/applications", response_model=schemas.AdmissionApplicationOut, status_code=201,
    dependencies=[Depends(require_roles(*ADMISSIONS_CREATE_ROLES))],
)
def create_application(payload: schemas.AdmissionApplicationCreate, db: Session = Depends(get_db)):
    guardian = db.query(models.Guardian).filter(models.Guardian.id == payload.guardian_id).first()
    if not guardian:
        raise HTTPException(status_code=404, detail="Guardian not found")

    school_class = db.query(models.SchoolClass).filter(
        models.SchoolClass.id == payload.applying_for_class_id
    ).first()
    if not school_class:
        raise HTTPException(status_code=404, detail="Class not found")

    application = models.AdmissionApplication(**payload.model_dump(), status="inquiry")
    db.add(application)
    db.commit()
    db.refresh(application)
    return application


@router.get("/applications", response_model=list[schemas.AdmissionApplicationOut])
def list_applications(
    school_id: int,
    status: str | None = None,
    db: Session = Depends(get_db),
):
    query = db.query(models.AdmissionApplication).filter(
        models.AdmissionApplication.school_id == school_id
    )
    if status:
        query = query.filter(models.AdmissionApplication.status == status)
    return query.order_by(models.AdmissionApplication.created_at.desc()).all()


@router.get("/applications/{application_id}", response_model=schemas.AdmissionApplicationOut)
def get_application(application_id: int, db: Session = Depends(get_db)):
    application = db.query(models.AdmissionApplication).filter(
        models.AdmissionApplication.id == application_id
    ).first()
    if not application:
        raise HTTPException(status_code=404, detail="Application not found")
    return application


@router.patch("/applications/{application_id}/status", response_model=schemas.AdmissionApplicationOut)
def update_status(
    application_id: int,
    payload: schemas.AdmissionStatusUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    application = db.query(models.AdmissionApplication).filter(
        models.AdmissionApplication.id == application_id
    ).first()
    if not application:
        raise HTTPException(status_code=404, detail="Application not found")

    allowed_next = ALLOWED_TRANSITIONS.get(application.status, set())
    if payload.status not in allowed_next:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Cannot move from '{application.status}' to '{payload.status}'. "
                f"Allowed next steps: {sorted(allowed_next) or 'none — this is a final status'}"
            ),
        )

    # The actual accept/reject DECISION requires Principal or Vice
    # Principal — this can't be a static route dependency since it
    # depends on which status is being requested, not just who's calling.
    # Administrative progression (inquiry → submitted → under_review,
    # or any → withdrawn) stays with whoever can already view the
    # pipeline, since that's just moving paperwork along, not deciding
    # a student's admission.
    if payload.status in DECISION_TRANSITIONS and current_user.role_name not in ADMISSIONS_APPROVAL_ROLES:
        raise HTTPException(
            status_code=403,
            detail=(
                f"Moving an application to '{payload.status}' is an admission decision — "
                f"only the Principal or Vice Principal can approve or reject applications."
            ),
        )

    application.status = payload.status
    if payload.notes is not None:
        application.notes = payload.notes
    application.reviewed_by_user_id = current_user.id
    db.commit()
    db.refresh(application)
    return application


@router.post("/applications/{application_id}/enroll", response_model=schemas.StudentOut, status_code=201)
def enroll_application(
    application_id: int,
    payload: schemas.EnrollRequest,
    db: Session = Depends(get_db),
):
    application = db.query(models.AdmissionApplication).filter(
        models.AdmissionApplication.id == application_id
    ).first()
    if not application:
        raise HTTPException(status_code=404, detail="Application not found")

    if application.status != "offer_sent":
        raise HTTPException(
            status_code=400,
            detail=f"Can only enroll an application with status 'offer_sent' (currently '{application.status}')",
        )

    existing = None
    if payload.admission_number:
        existing = db.query(models.Student).filter(
            models.Student.school_id == application.school_id,
            models.Student.admission_number == payload.admission_number,
        ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Admission number already used in this school")

    admission_number = payload.admission_number or generate_admission_number(
        db, application.school_id, application.academic_year_id
    )

    guardian = db.query(models.Guardian).filter(models.Guardian.id == application.guardian_id).first()

    student = models.Student(
        school_id=application.school_id,
        academic_year_id=application.academic_year_id,
        section_id=payload.section_id,
        admission_number=admission_number,
        full_name=application.applicant_name,
        date_of_birth=application.date_of_birth,
        gender=application.gender,
        guardian_id=application.guardian_id,
        guardian_name=guardian.full_name,
        guardian_phone=guardian.phone,
        guardian_email=guardian.email,
        previous_school=application.previous_school,
    )
    db.add(student)
    db.flush()

    application.status = "enrolled"
    application.enrolled_student_id = student.id

    db.commit()
    db.refresh(student)
    return student


@router.get("/fee-structures", response_model=list[schemas.FeeStructureOut])
def list_applicable_fee_structures(school_id: int, school_class_id: int, db: Session = Depends(get_db)):
    """
    Same query as fees.py's GET /fees/structures?school_class_id=, but
    reachable by ADMISSIONS_ROLES — that router's blanket Accountant-only
    restriction is correct for money-handling, but simply viewing which
    fee structures apply to a class (not touching payments or amounts
    owed) is exactly the read Admissions needs before generating a new
    student's first invoices, and FastAPI has no way to loosen a single
    route under a router-level dependency.
    """
    return db.query(models.FeeStructure).filter(
        models.FeeStructure.school_id == school_id,
        (models.FeeStructure.school_class_id == school_class_id) | (models.FeeStructure.school_class_id.is_(None)),
    ).all()


@router.post("/students/{student_id}/generate-invoices", response_model=list[schemas.InvoiceOut])
def generate_invoices_for_student(
    student_id: int,
    payload: schemas.GenerateInvoicesRequest,
    db: Session = Depends(get_db),
):
    """
    The explicit "assign fee structure" step at enrollment — creates one
    invoice per selected fee structure for this student, for one billing
    period. Lives here (not in fees.py) on purpose: that router's blanket
    Accountant-only restriction is correct for actual money-handling
    (recording payments), but this action is genuinely part of the
    Admissions workflow — whoever enrolls a student is who reasonably
    sets up their first bill, and this router's ADMISSIONS_ROLES already
    covers exactly that.
    """
    from datetime import date as date_type
    from app.routers.fees import _recompute_invoice_status, _invoice_to_out, apply_concession_to_amount

    student = db.query(models.Student).filter(models.Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    created = []
    for structure_id in payload.fee_structure_ids:
        structure = db.query(models.FeeStructure).filter(models.FeeStructure.id == structure_id).first()
        if not structure:
            continue

        existing = db.query(models.StudentFeeInvoice).filter(
            models.StudentFeeInvoice.student_id == student_id,
            models.StudentFeeInvoice.fee_structure_id == structure_id,
            models.StudentFeeInvoice.billing_period == payload.billing_period,
        ).first()
        if existing:
            continue  # idempotent — don't double-bill the same structure+period

        net_amount, concession_amount = apply_concession_to_amount(db, payload.concession_id, structure.amount)

        invoice = models.StudentFeeInvoice(
            student_id=student_id, fee_structure_id=structure_id,
            billing_period=payload.billing_period, due_date=payload.due_date,
            amount_due=net_amount, amount_paid=0, status="pending",
            concession_id=payload.concession_id, concession_amount=concession_amount,
        )
        _recompute_invoice_status(invoice, date_type.today(), structure)
        db.add(invoice)
        created.append(invoice)

    db.commit()
    for invoice in created:
        db.refresh(invoice)
    return [_invoice_to_out(db, inv) for inv in created]

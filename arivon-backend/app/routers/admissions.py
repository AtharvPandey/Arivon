"""
TEMPORARY COMPATIBILITY STUB - the real Admissions workflow has moved
to app/services/admissions_engine.py, a full CRM-grade pipeline
(Lead -> Inquiry -> Counseling -> Application -> Document Verification
-> Test -> Interview -> Decision -> Fee -> Confirmed), with its own new
API surface arriving in Phase 3.

This file exists ONLY so the old /admissions/* endpoints the current
frontend still calls return clean, deliberate responses instead of
crashing with a 500 - every write endpoint below returns 503 with a
clear message, every read endpoint returns an empty/safe result. None
of this creates or mutates real data. Delete this file entirely once
Phase 3's new router replaces the frontend calls that hit it.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app import models, schemas
from app.core.deps import get_current_user, require_roles

ADMISSIONS_VIEW_ROLES = ("admissions_officer", "school_admin", "administrator", "principal", "vice_principal", "super_admin")
ADMISSIONS_CREATE_ROLES = ("admissions_officer",)

router = APIRouter(
    prefix="/admissions",
    tags=["admissions"],
    dependencies=[Depends(require_roles(*ADMISSIONS_VIEW_ROLES))],
)

_REBUILD_MESSAGE = "Admissions is being upgraded to a new pipeline (Inquiry -> Counseling -> Application -> Decision -> Enrollment). This action isn't available during the upgrade - check back soon."


@router.post(
    "/applications", response_model=schemas.AdmissionApplicationOut, status_code=503,
    dependencies=[Depends(require_roles(*ADMISSIONS_CREATE_ROLES))],
)
def create_application(payload: schemas.AdmissionApplicationCreate):
    raise HTTPException(status_code=503, detail=_REBUILD_MESSAGE)


@router.get("/applications", response_model=list[schemas.AdmissionApplicationOut])
def list_applications(school_id: int, status: str | None = None, db: Session = Depends(get_db)):
    """Always empty during the upgrade - the old table's rows were
    cleared by the redesign migration, and this never touches any
    field that no longer exists, so it's safe regardless of status."""
    return []


@router.get("/applications/{application_id}", response_model=schemas.AdmissionApplicationOut)
def get_application(application_id: int):
    raise HTTPException(status_code=404, detail="Application not found")


@router.patch("/applications/{application_id}/status", response_model=schemas.AdmissionApplicationOut)
def update_status(application_id: int, payload: schemas.AdmissionStatusUpdate, current_user: models.User = Depends(get_current_user)):
    raise HTTPException(status_code=503, detail=_REBUILD_MESSAGE)


@router.post("/applications/{application_id}/enroll", response_model=schemas.StudentOut, status_code=503)
def enroll_application(application_id: int, payload: schemas.EnrollRequest):
    raise HTTPException(status_code=503, detail=_REBUILD_MESSAGE)


@router.get("/fee-structures", response_model=list[schemas.FeeStructureOut])
def list_applicable_fee_structures(school_id: int, school_class_id: int, db: Session = Depends(get_db)):
    """
    Untouched by the redesign - doesn't reference admission_applications
    at all, so this keeps working exactly as before.
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
    Untouched by the redesign - operates on Student/FeeStructure/
    StudentFeeInvoice only, never on admission_applications, so this
    keeps working exactly as before.
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

"""
Fee Management — the most sensitive module. Fee Structures (the rule),
Concessions (reusable discount rules — sibling, RTE, category-based),
Invoices (the bill for one student, net of any concession applied),
Payments (money actually received, partial payments supported), Waivers
(a case-by-case approval workflow, distinct from a standing concession),
Receipts (PDF generation), and Reporting (defaulters, collection
summaries, payment history).

Restricted to Accountant only (plus Super Admin as a platform-level
override) for anything touching money directly. Deliberately excludes
Principal/Administrator — fee handling is a distinct department with
its own accountability, the same way a real school doesn't let the
principal walk up to the accounts window and process a payment
themselves. (Fee STRUCTURE ASSIGNMENT at enrollment lives in
admissions.py instead, on purpose — see that file's notes.)
"""

from datetime import date as date_type, datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app import models, schemas
from app.core.deps import get_current_user, require_roles

FINANCE_ROLES = ("accountant", "school_admin")
VALID_PAYMENT_METHODS = {"cash", "upi", "bank_transfer", "cheque", "dd"}

router = APIRouter(
    prefix="/fees",
    tags=["fees"],
    dependencies=[Depends(require_roles(*FINANCE_ROLES))],
)


def _compute_late_fee(invoice: models.StudentFeeInvoice, structure: models.FeeStructure, today: date_type) -> int:
    """
    Computed live, every time — never stored. The moment "today" crosses
    (due_date + grace_days), the late fee applies automatically; there's
    no scheduled job to run and nothing that can silently fall out of
    sync with the calendar.
    """
    if invoice.status == "paid" or not structure or structure.late_fee_amount == 0:
        return 0
    grace_deadline = invoice.due_date + timedelta(days=structure.late_fee_grace_days)
    return structure.late_fee_amount if today > grace_deadline else 0


def _recompute_invoice_status(invoice: models.StudentFeeInvoice, today: date_type, structure: models.FeeStructure | None = None):
    effective_due = invoice.amount_due + (_compute_late_fee(invoice, structure, today) if structure else 0)
    if invoice.amount_paid >= effective_due and effective_due > 0:
        invoice.status = "paid"
    elif invoice.amount_paid > 0:
        invoice.status = "partial"
    elif invoice.due_date < today:
        invoice.status = "overdue"
    else:
        invoice.status = "pending"


def _invoice_to_out(db: Session, invoice: models.StudentFeeInvoice) -> schemas.InvoiceOut:
    student = db.query(models.Student).filter(models.Student.id == invoice.student_id).first()
    structure = db.query(models.FeeStructure).filter(models.FeeStructure.id == invoice.fee_structure_id).first()
    late_fee = _compute_late_fee(invoice, structure, date_type.today())
    effective_total = invoice.amount_due + late_fee
    return schemas.InvoiceOut(
        id=invoice.id, student_id=invoice.student_id, student_name=student.full_name if student else "—",
        fee_structure_id=invoice.fee_structure_id, fee_type=structure.fee_type if structure else "—",
        billing_period=invoice.billing_period, due_date=invoice.due_date, amount_due=invoice.amount_due,
        amount_paid=invoice.amount_paid, status=invoice.status, concession_id=invoice.concession_id,
        concession_amount=invoice.concession_amount, late_fee_amount=late_fee,
        effective_total_due=effective_total, balance=max(effective_total - invoice.amount_paid, 0),
    )


def apply_concession_to_amount(db: Session, concession_id: int | None, base_amount: int) -> tuple[int, int]:
    """
    Shared with admissions.py's bulk invoice generation — returns
    (net_amount_due, concession_amount_deducted). A single place that
    knows how a concession's discount_type/discount_value translates
    into an actual rupee reduction, so enrollment-time invoicing and
    this router's own invoice creation can never compute it differently.
    """
    if not concession_id:
        return base_amount, 0
    concession = db.query(models.FeeConcession).filter(models.FeeConcession.id == concession_id).first()
    if not concession or not concession.is_active:
        return base_amount, 0
    if concession.discount_type == "percentage":
        deducted = round(base_amount * concession.discount_value / 100)
    else:
        deducted = min(concession.discount_value, base_amount)
    return max(base_amount - deducted, 0), deducted


# ---------- Fee Structures ----------

@router.post("/structures", response_model=schemas.FeeStructureOut, status_code=201)
def create_fee_structure(payload: schemas.FeeStructureCreate, db: Session = Depends(get_db)):
    school = db.query(models.School).filter(models.School.id == payload.school_id).first()
    if not school:
        raise HTTPException(status_code=404, detail="School not found")

    structure = models.FeeStructure(**payload.model_dump())
    db.add(structure)
    db.commit()
    db.refresh(structure)
    return structure


@router.get("/structures", response_model=list[schemas.FeeStructureOut])
def list_fee_structures(school_id: int, school_class_id: int | None = None, db: Session = Depends(get_db)):
    query = db.query(models.FeeStructure).filter(models.FeeStructure.school_id == school_id)
    if school_class_id is not None:
        query = query.filter(
            (models.FeeStructure.school_class_id == school_class_id) | (models.FeeStructure.school_class_id.is_(None))
        )
    return query.all()


# ---------- Fee Concessions ----------

@router.post("/concessions", response_model=schemas.FeeConcessionOut, status_code=201)
def create_concession(payload: schemas.FeeConcessionCreate, db: Session = Depends(get_db)):
    if payload.discount_type not in ("percentage", "flat"):
        raise HTTPException(status_code=400, detail="discount_type must be 'percentage' or 'flat'")
    concession = models.FeeConcession(**payload.model_dump())
    db.add(concession)
    db.commit()
    db.refresh(concession)
    return concession


@router.get("/concessions", response_model=list[schemas.FeeConcessionOut])
def list_concessions(school_id: int, include_inactive: bool = False, db: Session = Depends(get_db)):
    query = db.query(models.FeeConcession).filter(models.FeeConcession.school_id == school_id)
    if not include_inactive:
        query = query.filter(models.FeeConcession.is_active == True)  # noqa: E712
    return query.all()


@router.delete("/concessions/{concession_id}", status_code=204)
def deactivate_concession(concession_id: int, db: Session = Depends(get_db)):
    """Soft delete — invoices that already reference this concession
    keep their historical concession_amount regardless."""
    concession = db.query(models.FeeConcession).filter(models.FeeConcession.id == concession_id).first()
    if not concession:
        raise HTTPException(status_code=404, detail="Concession not found")
    concession.is_active = False
    db.commit()


@router.post("/invoices/{invoice_id}/apply-concession", response_model=schemas.InvoiceOut)
def apply_concession_to_invoice(invoice_id: int, payload: schemas.ApplyConcessionRequest, db: Session = Depends(get_db)):
    """Applies a concession to an EXISTING, already-generated invoice —
    for the case where a concession is approved after the bill already
    went out, rather than only at generation time."""
    invoice = db.query(models.StudentFeeInvoice).filter(models.StudentFeeInvoice.id == invoice_id).first()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")

    structure = db.query(models.FeeStructure).filter(models.FeeStructure.id == invoice.fee_structure_id).first()
    original_amount = structure.amount if structure else invoice.amount_due + invoice.concession_amount
    net_amount, concession_amount = apply_concession_to_amount(db, payload.concession_id, original_amount)

    invoice.concession_id = payload.concession_id
    invoice.concession_amount = concession_amount
    invoice.amount_due = net_amount
    _recompute_invoice_status(invoice, date_type.today(), structure)
    db.commit()
    db.refresh(invoice)
    return _invoice_to_out(db, invoice)


# ---------- Invoices ----------

@router.post("/invoices", response_model=schemas.InvoiceOut, status_code=201)
def create_invoice(payload: schemas.InvoiceCreate, db: Session = Depends(get_db)):
    student = db.query(models.Student).filter(models.Student.id == payload.student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    structure = db.query(models.FeeStructure).filter(
        models.FeeStructure.id == payload.fee_structure_id
    ).first()
    if not structure:
        raise HTTPException(status_code=404, detail="Fee structure not found")

    net_amount, concession_amount = apply_concession_to_amount(db, payload.concession_id, payload.amount_due)

    invoice = models.StudentFeeInvoice(
        student_id=payload.student_id,
        fee_structure_id=payload.fee_structure_id,
        billing_period=payload.billing_period,
        due_date=payload.due_date,
        amount_due=net_amount,
        amount_paid=0,
        status="pending",
        concession_id=payload.concession_id,
        concession_amount=concession_amount,
    )
    _recompute_invoice_status(invoice, date_type.today(), structure)
    db.add(invoice)
    db.commit()
    db.refresh(invoice)
    return _invoice_to_out(db, invoice)


@router.get("/invoices", response_model=list[schemas.InvoiceOut])
def list_invoices(
    school_id: int,
    student_id: int | None = None,
    status: str | None = None,
    db: Session = Depends(get_db),
):
    query = db.query(models.StudentFeeInvoice).join(
        models.Student, models.StudentFeeInvoice.student_id == models.Student.id
    ).filter(models.Student.school_id == school_id)

    if student_id is not None:
        query = query.filter(models.StudentFeeInvoice.student_id == student_id)
    if status is not None:
        query = query.filter(models.StudentFeeInvoice.status == status)

    return [_invoice_to_out(db, inv) for inv in query.all()]


# ---------- Payments ----------

def _generate_receipt_number(db: Session, school_id: int) -> str:
    """Counts every payment at this school, whether its invoice is
    already linked to a Student or still only linked to an
    AdmissionApplication (pre-enrollment fees like Registration Fee).
    The old version joined through Student only, which silently
    excluded every admission-stage payment from the count - since
    those invoices have student_id = NULL until confirmation, the
    count was always 0 for them, generating the same receipt number
    (RCPT-{year}-00001) every single time and colliding on the second
    admission payment ever recorded."""
    year = date_type.today().year
    student_side_count = db.query(models.FeePayment).join(
        models.StudentFeeInvoice, models.FeePayment.invoice_id == models.StudentFeeInvoice.id
    ).join(
        models.Student, models.StudentFeeInvoice.student_id == models.Student.id
    ).filter(models.Student.school_id == school_id).count()
    admission_side_count = db.query(models.FeePayment).join(
        models.StudentFeeInvoice, models.FeePayment.invoice_id == models.StudentFeeInvoice.id
    ).join(
        models.AdmissionApplication, models.StudentFeeInvoice.admission_application_id == models.AdmissionApplication.id
    ).filter(models.AdmissionApplication.school_id == school_id).count()
    count = student_side_count + admission_side_count
    return f"RCPT-{year}-{count + 1:05d}"


@router.post("/payments", response_model=schemas.PaymentOut, status_code=201)
def record_payment(
    payload: schemas.PaymentCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if payload.payment_method not in VALID_PAYMENT_METHODS:
        raise HTTPException(status_code=400, detail=f"payment_method must be one of {VALID_PAYMENT_METHODS}")

    invoice = db.query(models.StudentFeeInvoice).filter(
        models.StudentFeeInvoice.id == payload.invoice_id
    ).first()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")

    if payload.amount <= 0:
        raise HTTPException(status_code=400, detail="Payment amount must be positive")

    structure = db.query(models.FeeStructure).filter(models.FeeStructure.id == invoice.fee_structure_id).first()
    late_fee = _compute_late_fee(invoice, structure, date_type.today())
    effective_total = invoice.amount_due + late_fee
    remaining = effective_total - invoice.amount_paid
    if payload.amount > remaining:
        raise HTTPException(
            status_code=400,
            detail=f"Payment of {payload.amount} exceeds remaining balance of {remaining} (including any late fee)",
        )

    student = db.query(models.Student).filter(models.Student.id == invoice.student_id).first()
    resolved_school_id = student.school_id if student else None
    if resolved_school_id is None and invoice.admission_application_id:
        application = db.query(models.AdmissionApplication).filter(
            models.AdmissionApplication.id == invoice.admission_application_id
        ).first()
        resolved_school_id = application.school_id if application else None

    payment = models.FeePayment(
        invoice_id=payload.invoice_id,
        receipt_number=_generate_receipt_number(db, resolved_school_id),
        amount=payload.amount,
        payment_date=payload.payment_date,
        payment_method=payload.payment_method,
        received_by_user_id=current_user.id,
        notes=payload.notes,
    )
    db.add(payment)

    invoice.amount_paid += payload.amount
    _recompute_invoice_status(invoice, date_type.today(), structure)

    db.commit()
    db.refresh(payment)
    return payment


@router.post("/payments/{payment_id}/receipt", response_model=schemas.GenerateReceiptResponse)
def generate_receipt(payment_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    from app.core.certificates import generate_fee_receipt_pdf
    from app.core.notifications import send_whatsapp_message

    payment = db.query(models.FeePayment).filter(models.FeePayment.id == payment_id).first()
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")

    invoice = db.query(models.StudentFeeInvoice).filter(models.StudentFeeInvoice.id == payment.invoice_id).first()
    student = db.query(models.Student).filter(models.Student.id == invoice.student_id).first()
    structure = db.query(models.FeeStructure).filter(models.FeeStructure.id == invoice.fee_structure_id).first()
    school = db.query(models.School).filter(models.School.id == student.school_id).first()

    stored_filename = generate_fee_receipt_pdf(student, school, payment, invoice, structure)

    document = models.Document(
        school_id=student.school_id, entity_type="student", entity_id=student.id,
        document_type="fee_receipt", original_filename=f"Receipt_{payment.receipt_number}.pdf",
        stored_filename=stored_filename, uploaded_by_user_id=current_user.id,
    )
    db.add(document)
    db.commit()
    db.refresh(document)

    # WhatsApp-shareable — a text summary with the receipt number now,
    # not the PDF itself (Twilio's WhatsApp API needs a publicly
    # reachable media URL for attachments, which local disk storage
    # doesn't provide yet); this is genuinely useful on its own —
    # confirmation the moment payment is recorded, not a placeholder.
    message = (
        f"Dear Parent, we've received your payment of Rs.{payment.amount} for {student.full_name} "
        f"({structure.fee_type if structure else 'Fee'}, {invoice.billing_period}). "
        f"Receipt No: {payment.receipt_number}. Thank you."
    )
    send_whatsapp_message(student.guardian_phone, message)

    return schemas.GenerateReceiptResponse(
        document_id=document.id, download_url=f"/documents/{document.id}/download",
        receipt_number=payment.receipt_number,
    )


# ---------- Fee Waivers (case-by-case approval workflow) ----------

@router.post("/waivers", response_model=schemas.FeeWaiverOut, status_code=201)
def request_waiver(payload: schemas.FeeWaiverCreate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    invoice = db.query(models.StudentFeeInvoice).filter(models.StudentFeeInvoice.id == payload.invoice_id).first()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")

    waiver = models.FeeWaiverRequest(
        invoice_id=payload.invoice_id, requested_by_user_id=current_user.id,
        waiver_amount=payload.waiver_amount, reason=payload.reason,
    )
    db.add(waiver)
    db.commit()
    db.refresh(waiver)
    return _waiver_to_out(db, waiver)


@router.get("/waivers", response_model=list[schemas.FeeWaiverOut])
def list_waivers(school_id: int, status: str | None = None, db: Session = Depends(get_db)):
    query = db.query(models.FeeWaiverRequest).join(
        models.StudentFeeInvoice, models.FeeWaiverRequest.invoice_id == models.StudentFeeInvoice.id
    ).join(
        models.Student, models.StudentFeeInvoice.student_id == models.Student.id
    ).filter(models.Student.school_id == school_id)
    if status:
        query = query.filter(models.FeeWaiverRequest.status == status)
    return [_waiver_to_out(db, w) for w in query.order_by(models.FeeWaiverRequest.requested_at.desc()).all()]


@router.patch("/waivers/{waiver_id}/approve", response_model=schemas.FeeWaiverOut)
def approve_waiver(waiver_id: int, payload: schemas.WaiverReviewRequest, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    """Approving reduces the invoice's amount_due directly — a waiver is
    a one-off reduction, tracked here for audit but applied as a plain
    change to the bill, not a separate concession record."""
    waiver = db.query(models.FeeWaiverRequest).filter(models.FeeWaiverRequest.id == waiver_id).first()
    if not waiver:
        raise HTTPException(status_code=404, detail="Waiver request not found")
    if waiver.status != "pending":
        raise HTTPException(status_code=400, detail=f"This waiver is already {waiver.status}")

    invoice = db.query(models.StudentFeeInvoice).filter(models.StudentFeeInvoice.id == waiver.invoice_id).first()
    structure = db.query(models.FeeStructure).filter(models.FeeStructure.id == invoice.fee_structure_id).first()
    invoice.amount_due = max(invoice.amount_due - waiver.waiver_amount, 0)
    _recompute_invoice_status(invoice, date_type.today(), structure)

    waiver.status = "approved"
    waiver.reviewed_by_user_id = current_user.id
    waiver.reviewed_at = datetime.utcnow()
    waiver.review_notes = payload.review_notes
    db.commit()
    db.refresh(waiver)
    return _waiver_to_out(db, waiver)


@router.patch("/waivers/{waiver_id}/reject", response_model=schemas.FeeWaiverOut)
def reject_waiver(waiver_id: int, payload: schemas.WaiverReviewRequest, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    waiver = db.query(models.FeeWaiverRequest).filter(models.FeeWaiverRequest.id == waiver_id).first()
    if not waiver:
        raise HTTPException(status_code=404, detail="Waiver request not found")
    if waiver.status != "pending":
        raise HTTPException(status_code=400, detail=f"This waiver is already {waiver.status}")

    waiver.status = "rejected"
    waiver.reviewed_by_user_id = current_user.id
    waiver.reviewed_at = datetime.utcnow()
    waiver.review_notes = payload.review_notes
    db.commit()
    db.refresh(waiver)
    return _waiver_to_out(db, waiver)


def _waiver_to_out(db: Session, waiver: models.FeeWaiverRequest) -> schemas.FeeWaiverOut:
    invoice = db.query(models.StudentFeeInvoice).filter(models.StudentFeeInvoice.id == waiver.invoice_id).first()
    student = db.query(models.Student).filter(models.Student.id == invoice.student_id).first() if invoice else None
    return schemas.FeeWaiverOut(
        id=waiver.id, invoice_id=waiver.invoice_id, student_name=student.full_name if student else "—",
        waiver_amount=waiver.waiver_amount, reason=waiver.reason, status=waiver.status,
        requested_at=waiver.requested_at, reviewed_by_user_id=waiver.reviewed_by_user_id,
        review_notes=waiver.review_notes,
    )


# ---------- Reporting ----------

@router.get("/reports/defaulters", response_model=list[schemas.DefaulterItem])
def get_defaulters(school_id: int, section_id: int | None = None, db: Session = Depends(get_db)):
    """
    The single most-used report in any Indian school — every student
    with an outstanding balance, worst first. Outstanding includes any
    live-computed late fee, matching what a parent would actually be
    told they owe today.
    """
    query = db.query(models.Student).filter(
        models.Student.school_id == school_id, models.Student.is_active == True,  # noqa: E712
    )
    if section_id is not None:
        query = query.filter(models.Student.section_id == section_id)
    students = query.all()

    results = []
    for student in students:
        invoices = db.query(models.StudentFeeInvoice).filter(models.StudentFeeInvoice.student_id == student.id).all()
        total_outstanding = 0
        oldest_due = None
        invoice_count = 0
        for inv in invoices:
            structure = db.query(models.FeeStructure).filter(models.FeeStructure.id == inv.fee_structure_id).first()
            late_fee = _compute_late_fee(inv, structure, date_type.today())
            balance = max(inv.amount_due + late_fee - inv.amount_paid, 0)
            if balance > 0:
                total_outstanding += balance
                invoice_count += 1
                if oldest_due is None or inv.due_date < oldest_due:
                    oldest_due = inv.due_date

        if total_outstanding > 0:
            section = db.query(models.Section).filter(models.Section.id == student.section_id).first()
            school_class = db.query(models.SchoolClass).filter(models.SchoolClass.id == section.school_class_id).first() if section else None
            results.append(schemas.DefaulterItem(
                student_id=student.id, student_name=student.full_name, admission_number=student.admission_number,
                class_name=school_class.name if school_class else "—", section_name=section.name if section else "—",
                guardian_name=student.guardian_name, guardian_phone=student.guardian_phone,
                total_outstanding=total_outstanding, oldest_due_date=oldest_due, invoice_count=invoice_count,
            ))

    results.sort(key=lambda x: x.total_outstanding, reverse=True)
    return results


@router.get("/reports/class-wise", response_model=list[schemas.ClassWiseCollectionItem])
def get_class_wise_collection(school_id: int, db: Session = Depends(get_db)):
    """Billed vs. collected vs. outstanding, per class — across every
    student currently enrolled in that class."""
    classes = db.query(models.SchoolClass).filter(models.SchoolClass.school_id == school_id).all()

    results = []
    for school_class in classes:
        student_ids = [
            s.id for s in db.query(models.Student).join(models.Section).filter(
                models.Section.school_class_id == school_class.id, models.Student.is_active == True,  # noqa: E712
            ).all()
        ]
        if not student_ids:
            continue

        invoices = db.query(models.StudentFeeInvoice).filter(models.StudentFeeInvoice.student_id.in_(student_ids)).all()
        total_billed = sum(inv.amount_due for inv in invoices)
        total_collected = sum(inv.amount_paid for inv in invoices)
        total_outstanding = max(total_billed - total_collected, 0)

        results.append(schemas.ClassWiseCollectionItem(
            school_class_id=school_class.id, class_name=school_class.name,
            total_billed=total_billed, total_collected=total_collected, total_outstanding=total_outstanding,
            collection_pct=round((total_collected / total_billed) * 100, 1) if total_billed > 0 else 0.0,
        ))
    return results


@router.get("/reports/collection", response_model=list[schemas.CollectionReportItem])
def get_collection_report(school_id: int, period: str, start_date: date_type, end_date: date_type, db: Session = Depends(get_db)):
    """
    period is "daily", "monthly", or "annual" — controls how payments in
    the [start_date, end_date] range get bucketed for the response, not
    how far back the query looks.
    """
    if period not in ("daily", "monthly", "annual"):
        raise HTTPException(status_code=400, detail="period must be 'daily', 'monthly', or 'annual'")

    payments = db.query(models.FeePayment).join(
        models.StudentFeeInvoice, models.FeePayment.invoice_id == models.StudentFeeInvoice.id
    ).join(
        models.Student, models.StudentFeeInvoice.student_id == models.Student.id
    ).filter(
        models.Student.school_id == school_id,
        models.FeePayment.payment_date >= start_date, models.FeePayment.payment_date <= end_date,
    ).all()

    buckets: dict[str, dict] = {}
    for p in payments:
        if period == "daily":
            key = p.payment_date.isoformat()
        elif period == "monthly":
            key = p.payment_date.strftime("%B %Y")
        else:
            key = str(p.payment_date.year)
        if key not in buckets:
            buckets[key] = {"total": 0, "count": 0}
        buckets[key]["total"] += p.amount
        buckets[key]["count"] += 1

    return [
        schemas.CollectionReportItem(period_label=k, total_collected=v["total"], payment_count=v["count"])
        for k, v in sorted(buckets.items())
    ]


@router.get("/reports/outstanding-by-fee-type", response_model=list[schemas.OutstandingByFeeTypeItem])
def get_outstanding_by_fee_type(school_id: int, db: Session = Depends(get_db)):
    structures = db.query(models.FeeStructure).filter(models.FeeStructure.school_id == school_id).all()

    results = []
    for structure in structures:
        invoices = db.query(models.StudentFeeInvoice).filter(models.StudentFeeInvoice.fee_structure_id == structure.id).all()
        if not invoices:
            continue
        total_billed = sum(inv.amount_due for inv in invoices)
        total_collected = sum(inv.amount_paid for inv in invoices)
        results.append(schemas.OutstandingByFeeTypeItem(
            fee_type=structure.fee_type, total_billed=total_billed, total_collected=total_collected,
            total_outstanding=max(total_billed - total_collected, 0),
        ))
    return results


@router.get("/students/{student_id}/payment-history", response_model=list[schemas.PaymentHistoryItem])
def get_payment_history(student_id: int, db: Session = Depends(get_db)):
    invoices = db.query(models.StudentFeeInvoice).filter(models.StudentFeeInvoice.student_id == student_id).all()
    invoice_ids = [inv.id for inv in invoices]
    payments = db.query(models.FeePayment).filter(models.FeePayment.invoice_id.in_(invoice_ids)).order_by(
        models.FeePayment.payment_date.desc()
    ).all()

    results = []
    for p in payments:
        invoice = next((inv for inv in invoices if inv.id == p.invoice_id), None)
        structure = db.query(models.FeeStructure).filter(models.FeeStructure.id == invoice.fee_structure_id).first() if invoice else None
        results.append(schemas.PaymentHistoryItem(
            payment_id=p.id, receipt_number=p.receipt_number, fee_type=structure.fee_type if structure else "—",
            billing_period=invoice.billing_period if invoice else "—", amount=p.amount,
            payment_date=p.payment_date, payment_method=p.payment_method,
        ))
    return results


# ---------- Student bank details (sensitive — finance-only view) ----------

@router.get("/students/{student_id}/bank-details", response_model=schemas.StudentBankDetails)
def get_student_bank_details(student_id: int, db: Session = Depends(get_db)):
    student = db.query(models.Student).filter(models.Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    return student

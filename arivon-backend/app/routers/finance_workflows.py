"""
Finance Phase 3 workflow endpoints — kept separate from fees.py (which
stays untouched for backward compatibility with the pages built on it)
so these new, properly-designed endpoints don't risk anything already
working. Covers: Fee Categories management, category-based Fee
Structures with a "duplicate to new academic year" action, Student
Billing's three modes (Individual is already covered by fees.py),
search-first Collections support, and the full Refunds workflow.
"""

from collections import defaultdict
from datetime import date as date_type

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app import models, schemas
from app.core.deps import get_current_user
from app.core.finance_permissions import require_finance_permission
from app.services import finance_engine as fengine
from app.routers.fees import apply_concession_to_amount, _recompute_invoice_status, _category_name

router = APIRouter(prefix="/finance", tags=["finance-workflows"])


def _add_months(d: date_type, months: int) -> date_type:
    """Simple calendar-correct month addition without an extra
    dependency - handles year rollover and shorter months (e.g. adding
    a month to Jan 31 lands on the LAST day of Feb, not an invalid
    Feb 31)."""
    month = d.month - 1 + months
    year = d.year + month // 12
    month = month % 12 + 1
    import calendar
    day = min(d.day, calendar.monthrange(year, month)[1])
    return date_type(year, month, day)


# ---------------------------------------------------------------------
# Fee Categories
# ---------------------------------------------------------------------

@router.get(
    "/categories", response_model=list[schemas.FeeCategoryOut],
    dependencies=[Depends(require_finance_permission("view_reports"))],
)
def list_fee_categories(school_id: int, include_inactive: bool = False, db: Session = Depends(get_db)):
    categories = fengine.get_or_seed_fee_categories(db, school_id)
    if not include_inactive:
        categories = [c for c in categories if c.is_active]
    return categories


@router.post(
    "/categories", response_model=schemas.FeeCategoryOut, status_code=201,
    dependencies=[Depends(require_finance_permission("manage_fee_categories"))],
)
def create_fee_category(payload: schemas.FeeCategoryCreate, db: Session = Depends(get_db)):
    existing = db.query(models.FeeCategory).filter(
        models.FeeCategory.school_id == payload.school_id, models.FeeCategory.name == payload.name,
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"A category named '{payload.name}' already exists.")
    category = models.FeeCategory(school_id=payload.school_id, name=payload.name)
    db.add(category)
    db.commit()
    db.refresh(category)
    return category


@router.patch(
    "/categories/{category_id}", response_model=schemas.FeeCategoryOut,
    dependencies=[Depends(require_finance_permission("manage_fee_categories"))],
)
def update_fee_category(category_id: int, payload: schemas.FeeCategoryUpdate, db: Session = Depends(get_db)):
    category = db.query(models.FeeCategory).filter(models.FeeCategory.id == category_id).first()
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
    data = payload.model_dump(exclude_unset=True)
    if "name" in data and data["name"]:
        duplicate = db.query(models.FeeCategory).filter(
            models.FeeCategory.school_id == category.school_id, models.FeeCategory.name == data["name"],
            models.FeeCategory.id != category_id,
        ).first()
        if duplicate:
            raise HTTPException(status_code=400, detail=f"A category named '{data['name']}' already exists.")
    for key, value in data.items():
        setattr(category, key, value)
    db.commit()
    db.refresh(category)
    return category


# ---------------------------------------------------------------------
# Fee Structures - duplicate-to-year
# ---------------------------------------------------------------------

@router.post(
    "/structures/duplicate-to-year", response_model=schemas.DuplicateStructuresResponse,
    dependencies=[Depends(require_finance_permission("manage_fee_structures"))],
)
def duplicate_structures_to_year(payload: schemas.DuplicateStructuresRequest, db: Session = Depends(get_db)):
    """The highest-value automation opportunity identified for this
    module - without this, every new academic year means re-typing
    nearly identical fee structures from scratch."""
    if payload.source_academic_year_id == payload.target_academic_year_id:
        raise HTTPException(status_code=400, detail="Source and target academic year can't be the same.")

    source_year = db.query(models.AcademicYear).filter(models.AcademicYear.id == payload.source_academic_year_id).first()
    target_year = db.query(models.AcademicYear).filter(models.AcademicYear.id == payload.target_academic_year_id).first()
    if not source_year or not target_year:
        raise HTTPException(status_code=404, detail="Academic year not found")
    if source_year.school_id != target_year.school_id:
        raise HTTPException(status_code=400, detail="Source and target academic years must belong to the same school.")

    source_structures = db.query(models.FeeStructure).filter(
        models.FeeStructure.academic_year_id == payload.source_academic_year_id
    ).all()
    existing_target = db.query(models.FeeStructure).filter(
        models.FeeStructure.academic_year_id == payload.target_academic_year_id
    ).all()
    existing_keys = {(s.school_class_id, s.fee_category_id) for s in existing_target}

    created_count = 0
    skipped_count = 0
    multiplier = 1 + (payload.percentage_increase / 100)
    for s in source_structures:
        key = (s.school_class_id, s.fee_category_id)
        if key in existing_keys:
            skipped_count += 1
            continue
        new_amount = round(s.amount * multiplier)
        db.add(models.FeeStructure(
            school_id=s.school_id, academic_year_id=payload.target_academic_year_id,
            school_class_id=s.school_class_id, fee_category_id=s.fee_category_id,
            amount=new_amount, frequency=s.frequency,
            late_fee_amount=s.late_fee_amount, late_fee_grace_days=s.late_fee_grace_days,
        ))
        created_count += 1
    db.commit()
    return schemas.DuplicateStructuresResponse(created_count=created_count, skipped_count=skipped_count)


# ---------------------------------------------------------------------
# Student Billing - Class-wise Batch and Academic Year Template modes
# (Individual mode already exists at POST /fees/invoices)
# ---------------------------------------------------------------------

@router.post(
    "/billing/class-batch", response_model=schemas.ClassBatchInvoiceResponse,
    dependencies=[Depends(require_finance_permission("generate_invoice"))],
)
def generate_class_batch_invoices(payload: schemas.ClassBatchInvoiceRequest, db: Session = Depends(get_db)):
    """Generate one invoice per active student in a class, for one
    billing period, in a single action - no Indian school accountant
    generates monthly tuition for 40 students by clicking into each one
    individually."""
    structure = db.query(models.FeeStructure).filter(models.FeeStructure.id == payload.fee_structure_id).first()
    if not structure:
        raise HTTPException(status_code=404, detail="Fee structure not found")
    if structure.school_class_id is not None and structure.school_class_id != payload.school_class_id:
        raise HTTPException(status_code=400, detail="This fee structure doesn't apply to the selected class.")

    sections = db.query(models.Section).filter(models.Section.school_class_id == payload.school_class_id).all()
    section_ids = [s.id for s in sections]
    students = db.query(models.Student).filter(
        models.Student.section_id.in_(section_ids), models.Student.is_active == True,  # noqa: E712
    ).all() if section_ids else []

    if not students:
        raise HTTPException(status_code=400, detail="No active students found in this class. Check that students have been assigned to a section.")

    created_names, skipped_names = [], []
    for student in students:
        existing = db.query(models.StudentFeeInvoice).filter(
            models.StudentFeeInvoice.student_id == student.id,
            models.StudentFeeInvoice.fee_structure_id == payload.fee_structure_id,
            models.StudentFeeInvoice.billing_period == payload.billing_period,
        ).first()
        if existing:
            skipped_names.append(student.full_name)
            continue
        net_amount, concession_amount = apply_concession_to_amount(db, payload.concession_id, structure.amount)
        invoice = models.StudentFeeInvoice(
            student_id=student.id, fee_structure_id=payload.fee_structure_id,
            billing_period=payload.billing_period, due_date=payload.due_date,
            amount_due=net_amount, amount_paid=0, status="pending",
            concession_id=payload.concession_id, concession_amount=concession_amount,
        )
        _recompute_invoice_status(invoice, date_type.today(), structure)
        db.add(invoice)
        created_names.append(student.full_name)
    db.commit()

    return schemas.ClassBatchInvoiceResponse(
        created_count=len(created_names), skipped_count=len(skipped_names),
        student_names_created=created_names, student_names_skipped=skipped_names,
    )


@router.post(
    "/billing/academic-year-template", response_model=schemas.AcademicYearTemplateResponse,
    dependencies=[Depends(require_finance_permission("generate_invoice"))],
)
def generate_academic_year_template(payload: schemas.AcademicYearTemplateRequest, db: Session = Depends(get_db)):
    """Generate an entire year's worth of recurring invoices (e.g. all
    12 months of tuition) for every student in a class, in one action -
    instead of running the class-batch generator by hand every single
    month."""
    structure = db.query(models.FeeStructure).filter(models.FeeStructure.id == payload.fee_structure_id).first()
    if not structure:
        raise HTTPException(status_code=404, detail="Fee structure not found")
    if structure.frequency not in ("monthly", "quarterly"):
        raise HTTPException(status_code=400, detail="Academic Year Templates only apply to monthly or quarterly fee structures — one-time and annual fees are already a single invoice, not a recurring template.")
    if structure.school_class_id is not None and structure.school_class_id != payload.school_class_id:
        raise HTTPException(status_code=400, detail="This fee structure doesn't apply to the selected class.")

    academic_year = db.query(models.AcademicYear).filter(models.AcademicYear.id == payload.academic_year_id).first()
    if not academic_year:
        raise HTTPException(status_code=404, detail="Academic year not found")

    sections = db.query(models.Section).filter(models.Section.school_class_id == payload.school_class_id).all()
    section_ids = [s.id for s in sections]
    students = db.query(models.Student).filter(
        models.Student.section_id.in_(section_ids), models.Student.is_active == True,  # noqa: E712
    ).all() if section_ids else []
    if not students:
        raise HTTPException(status_code=400, detail="No active students found in this class.")

    step_months = 1 if structure.frequency == "monthly" else 3
    period_count = 12 if structure.frequency == "monthly" else 4
    period_labels = []
    cursor_date = academic_year.start_date
    for i in range(period_count):
        label = cursor_date.strftime("%B %Y") if structure.frequency == "monthly" else f"Q{i + 1} {cursor_date.year}"
        period_labels.append(label)
        cursor_date = _add_months(cursor_date, step_months)

    created_count = 0
    skipped_count = 0
    due_cursor = payload.first_due_date
    for label in period_labels:
        for student in students:
            existing = db.query(models.StudentFeeInvoice).filter(
                models.StudentFeeInvoice.student_id == student.id,
                models.StudentFeeInvoice.fee_structure_id == payload.fee_structure_id,
                models.StudentFeeInvoice.billing_period == label,
            ).first()
            if existing:
                skipped_count += 1
                continue
            invoice = models.StudentFeeInvoice(
                student_id=student.id, fee_structure_id=payload.fee_structure_id,
                billing_period=label, due_date=due_cursor,
                amount_due=structure.amount, amount_paid=0, status="pending",
            )
            _recompute_invoice_status(invoice, date_type.today(), structure)
            db.add(invoice)
            created_count += 1
        due_cursor = _add_months(due_cursor, step_months)
    db.commit()

    return schemas.AcademicYearTemplateResponse(
        created_count=created_count, skipped_count=skipped_count, periods_generated=period_labels,
    )


# ---------------------------------------------------------------------
# Collections - search-first
# ---------------------------------------------------------------------

@router.get(
    "/students/search", response_model=list[schemas.StudentSearchResult],
    dependencies=[Depends(require_finance_permission("record_payment"))],
)
def search_students_for_billing(school_id: int, q: str, db: Session = Depends(get_db)):
    if len(q.strip()) < 2:
        raise HTTPException(status_code=400, detail="Search term must be at least 2 characters.")
    students = db.query(models.Student).filter(
        models.Student.school_id == school_id, models.Student.is_active == True,  # noqa: E712
        (models.Student.full_name.ilike(f"%{q}%") | models.Student.admission_number.ilike(f"%{q}%")),
    ).limit(20).all()

    results = []
    for s in students:
        section = db.query(models.Section).filter(models.Section.id == s.section_id).first() if s.section_id else None
        school_class = db.query(models.SchoolClass).filter(models.SchoolClass.id == section.school_class_id).first() if section else None
        invoices = db.query(models.StudentFeeInvoice).filter(
            models.StudentFeeInvoice.student_id == s.id, models.StudentFeeInvoice.status != "paid",
        ).all()
        outstanding = sum(inv.amount_due - inv.amount_paid for inv in invoices)
        results.append(schemas.StudentSearchResult(
            id=s.id, full_name=s.full_name, admission_number=s.admission_number,
            class_name=school_class.name if school_class else None,
            section_name=section.name if section else None, total_outstanding=outstanding,
        ))
    return results


# ---------------------------------------------------------------------
# Refunds
# ---------------------------------------------------------------------

def _refund_to_out(db: Session, refund: models.Refund) -> schemas.RefundOut:
    student = db.query(models.Student).filter(models.Student.id == refund.student_id).first()
    requester = db.query(models.User).filter(models.User.id == refund.requested_by_user_id).first()
    reviewer = db.query(models.User).filter(models.User.id == refund.reviewed_by_user_id).first() if refund.reviewed_by_user_id else None
    processor = db.query(models.User).filter(models.User.id == refund.processed_by_user_id).first() if refund.processed_by_user_id else None
    return schemas.RefundOut(
        id=refund.id, school_id=refund.school_id, payment_id=refund.payment_id, student_id=refund.student_id,
        student_name=student.full_name if student else "—", amount=refund.amount, reason=refund.reason,
        status=refund.status, requested_by_name=requester.full_name if requester else "—",
        requested_at=refund.requested_at, reviewed_by_name=reviewer.full_name if reviewer else None,
        reviewed_at=refund.reviewed_at, review_notes=refund.review_notes,
        processed_by_name=processor.full_name if processor else None, processed_at=refund.processed_at,
        refund_method=refund.refund_method, receipt_number=refund.receipt_number,
    )


@router.get(
    "/students/{student_id}/eligible-payments", response_model=list[schemas.EligiblePaymentOut],
    dependencies=[Depends(require_finance_permission("request_refund"))],
)
def list_eligible_payments(student_id: int, db: Session = Depends(get_db)):
    """Every payment this student has made, with how much of each is
    still refundable after accounting for any refunds already
    requested/approved/processed against it."""
    invoices = db.query(models.StudentFeeInvoice).filter(models.StudentFeeInvoice.student_id == student_id).all()
    invoice_ids = [inv.id for inv in invoices]
    if not invoice_ids:
        return []
    payments = db.query(models.FeePayment).filter(models.FeePayment.invoice_id.in_(invoice_ids)).order_by(models.FeePayment.payment_date.desc()).all()

    results = []
    for p in payments:
        invoice = next((inv for inv in invoices if inv.id == p.invoice_id), None)
        structure = db.query(models.FeeStructure).filter(models.FeeStructure.id == invoice.fee_structure_id).first() if invoice else None
        already_committed = db.query(models.Refund).filter(
            models.Refund.payment_id == p.id, models.Refund.status != "rejected",
        ).with_entities(models.Refund.amount).all()
        remaining = p.amount - sum(r[0] for r in already_committed)
        if remaining <= 0:
            continue  # fully refunded (or fully reserved by pending requests) - nothing left to offer
        results.append(schemas.EligiblePaymentOut(
            payment_id=p.id, invoice_id=p.invoice_id, receipt_number=p.receipt_number, amount=p.amount,
            payment_date=p.payment_date, payment_method=p.payment_method,
            fee_description=_category_name(db, structure), remaining_refundable=remaining,
        ))
    return results


@router.get(
    "/refunds", response_model=list[schemas.RefundOut],
    dependencies=[Depends(require_finance_permission("view_reports"))],
)
def list_refunds(school_id: int, status: str | None = None, db: Session = Depends(get_db)):
    query = db.query(models.Refund).filter(models.Refund.school_id == school_id)
    if status:
        query = query.filter(models.Refund.status == status)
    refunds = query.order_by(models.Refund.requested_at.desc()).all()
    return [_refund_to_out(db, r) for r in refunds]


@router.post(
    "/refunds", response_model=schemas.RefundOut, status_code=201,
    dependencies=[Depends(require_finance_permission("request_refund"))],
)
def request_refund(payload: schemas.RefundRequestCreate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    payment = db.query(models.FeePayment).filter(models.FeePayment.id == payload.payment_id).first()
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")
    invoice = db.query(models.StudentFeeInvoice).filter(models.StudentFeeInvoice.id == payment.invoice_id).first()
    student = db.query(models.Student).filter(models.Student.id == invoice.student_id).first() if invoice else None
    if not student:
        raise HTTPException(status_code=404, detail="Could not resolve the school for this payment.")
    refund = fengine.request_refund(
        db, school_id=student.school_id, payment_id=payload.payment_id, amount=payload.amount,
        reason=payload.reason, requested_by_user_id=current_user.id,
    )
    return _refund_to_out(db, refund)


@router.post(
    "/refunds/{refund_id}/start-review", response_model=schemas.RefundOut,
    dependencies=[Depends(require_finance_permission("review_refund"))],
)
def start_refund_review(refund_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    refund = db.query(models.Refund).filter(models.Refund.id == refund_id).first()
    if not refund:
        raise HTTPException(status_code=404, detail="Refund not found")
    refund = fengine.start_review(db, refund, reviewer_id=current_user.id)
    return _refund_to_out(db, refund)


@router.post(
    "/refunds/{refund_id}/decide", response_model=schemas.RefundOut,
    dependencies=[Depends(require_finance_permission("approve_refund"))],
)
def decide_refund(refund_id: int, payload: schemas.RefundDecisionRequest, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    refund = db.query(models.Refund).filter(models.Refund.id == refund_id).first()
    if not refund:
        raise HTTPException(status_code=404, detail="Refund not found")
    refund = fengine.decide_refund(db, refund, decision=payload.decision, reviewer_id=current_user.id, review_notes=payload.review_notes)
    return _refund_to_out(db, refund)


@router.post(
    "/refunds/{refund_id}/process", response_model=schemas.RefundOut,
    dependencies=[Depends(require_finance_permission("process_refund"))],
)
def process_refund(refund_id: int, payload: schemas.RefundProcessRequest, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    refund = db.query(models.Refund).filter(models.Refund.id == refund_id).first()
    if not refund:
        raise HTTPException(status_code=404, detail="Refund not found")
    refund = fengine.process_refund(db, refund, refund_method=payload.refund_method, processed_by_user_id=current_user.id)
    return _refund_to_out(db, refund)

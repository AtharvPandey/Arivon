"""
Finance engine — currently just the Refund state machine, following
the exact same pattern as app/services/admissions_engine.py: every
legal transition is its own guarded function, kept in one file so
"can this refund legally move from X to Y" is answerable by reading
one place.

Lifecycle:
    requested -> under_review -> approved -> processed
                              -> rejected (terminal, from either
                                 requested or under_review)

Every transition also publishes a domain event via app/core/events.py,
onto the SAME durable event log Admissions already uses - reusing
existing infrastructure rather than building a parallel audit table.
"""

from datetime import datetime

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app import models
from app.core.events import publish


class FinanceError(HTTPException):
    def __init__(self, detail: str):
        super().__init__(status_code=400, detail=detail)


def get_or_seed_fee_categories(db: Session, school_id: int) -> list[models.FeeCategory]:
    """Every school gets the standard category list the first time
    this is called, rather than requiring an explicit setup step -
    same lazy-default pattern as AdmissionSettings.get_settings().
    Checks each default individually rather than skipping the whole
    batch if even one category already exists for this school (which
    happens routinely via the backward-compat path in fees.py, where
    creating a structure with a free-text fee_type auto-creates just
    that one category)."""
    existing_names = {c.name for c in db.query(models.FeeCategory).filter(models.FeeCategory.school_id == school_id).all()}
    for name in models.FEE_CATEGORY_DEFAULTS:
        if name not in existing_names:
            db.add(models.FeeCategory(school_id=school_id, name=name))
    db.commit()
    return db.query(models.FeeCategory).filter(models.FeeCategory.school_id == school_id).all()


def _require_status(refund: models.Refund, *allowed: str):
    if refund.status not in allowed:
        raise FinanceError(
            f"This action needs the refund to be at status {allowed}, but it's currently '{refund.status}'."
        )


def request_refund(db: Session, *, school_id: int, payment_id: int, amount: int, reason: str,
                    requested_by_user_id: int) -> models.Refund:
    if amount <= 0:
        raise FinanceError("Refund amount must be greater than zero.")

    payment = db.query(models.FeePayment).filter(models.FeePayment.id == payment_id).first()
    if not payment:
        raise FinanceError("Payment not found.")

    # A payment can have multiple partial refunds over time - count every
    # refund against it that isn't rejected (requested/under_review/
    # approved/processed all "reserve" against the original amount),
    # otherwise two overlapping refund requests could both later be
    # approved and refund more than the payment was ever worth.
    already_committed = db.query(models.Refund).filter(
        models.Refund.payment_id == payment_id, models.Refund.status != "rejected",
    ).with_entities(models.Refund.amount).all()
    already_committed_total = sum(r[0] for r in already_committed)
    remaining_refundable = payment.amount - already_committed_total
    if amount > remaining_refundable:
        raise FinanceError(
            f"Refund amount ({amount}) exceeds what's still refundable on this payment "
            f"(₹{remaining_refundable} remaining out of the original ₹{payment.amount})."
        )

    invoice = db.query(models.StudentFeeInvoice).filter(models.StudentFeeInvoice.id == payment.invoice_id).first()
    if not invoice or not invoice.student_id:
        raise FinanceError("This payment isn't linked to an enrolled student, so a refund can't be recorded against it yet.")

    refund = models.Refund(
        school_id=school_id, payment_id=payment_id, student_id=invoice.student_id,
        amount=amount, reason=reason, status="requested", requested_by_user_id=requested_by_user_id,
    )
    db.add(refund)
    db.commit()
    db.refresh(refund)

    publish("refund_requested", {
        "refund_id": refund.id, "school_id": school_id, "payment_id": payment_id,
        "student_id": invoice.student_id, "amount": amount, "reason": reason,
    }, db=db)
    return refund


def start_review(db: Session, refund: models.Refund, *, reviewer_id: int) -> models.Refund:
    _require_status(refund, "requested")
    refund.status = "under_review"
    refund.reviewed_by_user_id = reviewer_id
    db.commit()
    db.refresh(refund)
    publish("refund_review_started", {"refund_id": refund.id, "reviewer_id": reviewer_id}, db=db)
    return refund


def decide_refund(db: Session, refund: models.Refund, *, decision: str, reviewer_id: int,
                   review_notes: str | None = None) -> models.Refund:
    _require_status(refund, "requested", "under_review")
    if decision not in ("approved", "rejected"):
        raise FinanceError(f"Unknown decision '{decision}'.")

    refund.status = decision
    refund.reviewed_by_user_id = reviewer_id
    refund.reviewed_at = datetime.utcnow()
    refund.review_notes = review_notes
    db.commit()
    db.refresh(refund)

    publish("refund_decided", {
        "refund_id": refund.id, "decision": decision, "reviewer_id": reviewer_id, "notes": review_notes,
    }, db=db)
    return refund


def process_refund(db: Session, refund: models.Refund, *, refund_method: str, processed_by_user_id: int) -> models.Refund:
    _require_status(refund, "approved")
    if refund_method not in ("cash", "upi", "bank_transfer", "cheque"):
        raise FinanceError(f"Unknown refund method '{refund_method}'.")

    year = datetime.utcnow().year
    existing_count = db.query(models.Refund).filter(
        models.Refund.school_id == refund.school_id, models.Refund.status == "processed",
    ).count()
    refund.receipt_number = f"RFND-{year}-{existing_count + 1:05d}"
    refund.refund_method = refund_method
    refund.processed_by_user_id = processed_by_user_id
    refund.processed_at = datetime.utcnow()
    refund.status = "processed"
    db.commit()
    db.refresh(refund)

    publish("refund_processed", {
        "refund_id": refund.id, "amount": refund.amount, "receipt_number": refund.receipt_number,
        "processed_by_user_id": processed_by_user_id,
    }, db=db)
    return refund

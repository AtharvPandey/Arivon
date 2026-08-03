"""
Finance Dashboard — kept in its own small router, deliberately separate
from fees.py. That router's blanket dependency (accountant/school_admin
only) is correct for every WRITE action it guards, but the Dashboard
needs a wider VIEW-ONLY audience (Principal included, per the confirmed
permission design). FastAPI applies router-level dependencies
unconditionally to every route in that router - there's no way to
loosen access for just one endpoint inside fees.py without touching
every other endpoint's restriction, so this lives separately instead.
"""

from datetime import date as date_type, datetime as datetime_type, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app import models, schemas
from app.core.finance_permissions import require_finance_permission

router = APIRouter(prefix="/finance", tags=["finance-dashboard"])


@router.get(
    "/dashboard", response_model=schemas.FinanceDashboardOut,
    dependencies=[Depends(require_finance_permission("view_dashboard"))],
)
def get_finance_dashboard(school_id: int, db: Session = Depends(get_db)):
    today = date_type.today()
    week_from_now = today + timedelta(days=7)

    # --- KPIs ---
    todays_payments = db.query(models.FeePayment).join(
        models.StudentFeeInvoice, models.FeePayment.invoice_id == models.StudentFeeInvoice.id
    ).join(
        models.Student, models.StudentFeeInvoice.student_id == models.Student.id
    ).filter(
        models.Student.school_id == school_id, models.FeePayment.payment_date == today,
    ).all()
    today_collections = sum(p.amount for p in todays_payments)
    today_receipts = len(todays_payments)

    unpaid_invoices = db.query(models.StudentFeeInvoice).join(
        models.Student, models.StudentFeeInvoice.student_id == models.Student.id
    ).filter(
        models.Student.school_id == school_id, models.StudentFeeInvoice.status != "paid",
    ).all()
    outstanding_amount = sum(inv.amount_due - inv.amount_paid for inv in unpaid_invoices)
    defaulters_count = len({inv.student_id for inv in unpaid_invoices if inv.status == "overdue"})

    pending_waivers = db.query(models.FeeWaiverRequest).join(
        models.StudentFeeInvoice, models.FeeWaiverRequest.invoice_id == models.StudentFeeInvoice.id
    ).join(
        models.Student, models.StudentFeeInvoice.student_id == models.Student.id
    ).filter(models.Student.school_id == school_id, models.FeeWaiverRequest.status == "pending").count()

    pending_refunds = db.query(models.Refund).filter(
        models.Refund.school_id == school_id, models.Refund.status.in_(["requested", "under_review"]),
    ).count()

    kpis = schemas.FinanceKPIs(
        today_collections=today_collections, outstanding_amount=outstanding_amount,
        pending_waivers=pending_waivers, pending_refunds=pending_refunds,
        today_receipts=today_receipts, defaulters_count=defaulters_count,
    )

    # --- Payment mode breakdown (today) ---
    from collections import defaultdict
    mode_totals = defaultdict(int)
    for p in todays_payments:
        mode_totals[p.payment_method] += p.amount
    payment_mode_today = [schemas.PaymentMethodBreakdown(method=m, amount=a) for m, a in mode_totals.items()]

    # --- Highest dues by class ---
    class_totals = defaultdict(int)
    for inv in unpaid_invoices:
        student = db.query(models.Student).filter(models.Student.id == inv.student_id).first()
        if not student or not student.section_id:
            class_totals["Unassigned"] += (inv.amount_due - inv.amount_paid)
            continue
        section = db.query(models.Section).filter(models.Section.id == student.section_id).first()
        school_class = db.query(models.SchoolClass).filter(models.SchoolClass.id == section.school_class_id).first() if section else None
        class_totals[school_class.name if school_class else "Unassigned"] += (inv.amount_due - inv.amount_paid)
    highest_dues_by_class = sorted(
        [schemas.ClassDuesItem(class_name=k, outstanding=v) for k, v in class_totals.items()],
        key=lambda c: c.outstanding, reverse=True,
    )[:10]

    # --- Upcoming due dates (next 7 days) ---
    upcoming = [inv for inv in unpaid_invoices if today <= inv.due_date <= week_from_now]
    upcoming_due_dates = []
    for inv in sorted(upcoming, key=lambda i: i.due_date)[:10]:
        student = db.query(models.Student).filter(models.Student.id == inv.student_id).first()
        upcoming_due_dates.append(schemas.UpcomingDueItem(
            student_name=student.full_name if student else "—",
            amount=inv.amount_due - inv.amount_paid, due_date=inv.due_date,
        ))

    # --- Recent activity (payments + waiver/refund requests, most recent first) ---
    recent_activity = []
    for p in sorted(todays_payments, key=lambda p: p.created_at, reverse=True)[:5]:
        invoice = db.query(models.StudentFeeInvoice).filter(models.StudentFeeInvoice.id == p.invoice_id).first()
        student = db.query(models.Student).filter(models.Student.id == invoice.student_id).first() if invoice else None
        recent_activity.append(schemas.RecentActivityItem(
            type="payment", description=f"{student.full_name if student else 'Someone'} paid ₹{p.amount}",
            timestamp=p.created_at,
        ))
    recent_refund_requests = db.query(models.Refund).filter(
        models.Refund.school_id == school_id
    ).order_by(models.Refund.requested_at.desc()).limit(3).all()
    for r in recent_refund_requests:
        student = db.query(models.Student).filter(models.Student.id == r.student_id).first()
        recent_activity.append(schemas.RecentActivityItem(
            type="refund_requested", description=f"Refund requested for {student.full_name if student else 'a student'}: ₹{r.amount}",
            timestamp=r.requested_at,
        ))
    recent_activity.sort(key=lambda a: a.timestamp, reverse=True)
    recent_activity = recent_activity[:8]

    return schemas.FinanceDashboardOut(
        kpis=kpis, payment_mode_today=payment_mode_today, highest_dues_by_class=highest_dues_by_class,
        upcoming_due_dates=upcoming_due_dates, recent_activity=recent_activity,
    )

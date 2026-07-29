"""
Staff Salary — genuinely new module. Same access boundary as Fee
Management (Accountant + School Admin only), since payroll is exactly
as sensitive as student fee data, just on the other side of the ledger.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app import models, schemas
from app.core.deps import get_current_user, require_roles

FINANCE_ROLES = ("accountant", "school_admin")

router = APIRouter(prefix="/salary", tags=["salary"])


def _payment_to_out(db: Session, payment: models.SalaryPayment) -> schemas.SalaryPaymentOut:
    staff = db.query(models.User).filter(models.User.id == payment.staff_user_id).first()
    profile = db.query(models.StaffProfile).filter(models.StaffProfile.user_id == payment.staff_user_id).first()
    return schemas.SalaryPaymentOut(
        id=payment.id, staff_user_id=payment.staff_user_id,
        staff_name=staff.full_name if staff else "—",
        designation=profile.designation if profile else (staff.role_name.replace("_", " ").title() if staff and staff.role_name else None),
        month=payment.month, year=payment.year, basic_salary=payment.basic_salary,
        allowances=payment.allowances, deductions=payment.deductions, net_salary=payment.net_salary,
        payment_status=payment.payment_status, payment_date=payment.payment_date, notes=payment.notes,
    )


@router.post(
    "/payments", response_model=schemas.SalaryPaymentOut, status_code=201,
    dependencies=[Depends(require_roles(*FINANCE_ROLES))],
)
def create_salary_payment(school_id: int, payload: schemas.SalaryPaymentCreate, db: Session = Depends(get_db)):
    staff = db.query(models.User).filter(models.User.id == payload.staff_user_id, models.User.school_id == school_id).first()
    if not staff:
        raise HTTPException(status_code=404, detail="Staff member not found")

    existing = db.query(models.SalaryPayment).filter(
        models.SalaryPayment.staff_user_id == payload.staff_user_id,
        models.SalaryPayment.month == payload.month, models.SalaryPayment.year == payload.year,
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="A salary record already exists for this staff member in this month")

    net_salary = payload.basic_salary + payload.allowances - payload.deductions
    payment = models.SalaryPayment(
        school_id=school_id, staff_user_id=payload.staff_user_id, month=payload.month, year=payload.year,
        basic_salary=payload.basic_salary, allowances=payload.allowances, deductions=payload.deductions,
        net_salary=net_salary, notes=payload.notes,
    )
    db.add(payment)
    db.commit()
    db.refresh(payment)
    return _payment_to_out(db, payment)


@router.get("/payments", response_model=list[schemas.SalaryPaymentOut], dependencies=[Depends(require_roles(*FINANCE_ROLES))])
def list_salary_payments(school_id: int, month: int | None = None, year: int | None = None, staff_user_id: int | None = None, db: Session = Depends(get_db)):
    query = db.query(models.SalaryPayment).filter(models.SalaryPayment.school_id == school_id)
    if month is not None:
        query = query.filter(models.SalaryPayment.month == month)
    if year is not None:
        query = query.filter(models.SalaryPayment.year == year)
    if staff_user_id is not None:
        query = query.filter(models.SalaryPayment.staff_user_id == staff_user_id)
    payments = query.order_by(models.SalaryPayment.year.desc(), models.SalaryPayment.month.desc()).all()
    return [_payment_to_out(db, p) for p in payments]


@router.post(
    "/payments/{payment_id}/mark-paid", response_model=schemas.SalaryPaymentOut,
    dependencies=[Depends(require_roles(*FINANCE_ROLES))],
)
def mark_salary_paid(payment_id: int, payload: schemas.SalaryMarkPaidRequest, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    payment = db.query(models.SalaryPayment).filter(models.SalaryPayment.id == payment_id).first()
    if not payment:
        raise HTTPException(status_code=404, detail="Salary record not found")

    payment.payment_status = "paid"
    payment.payment_date = payload.payment_date
    payment.paid_by_user_id = current_user.id
    db.commit()
    db.refresh(payment)
    return _payment_to_out(db, payment)


@router.get("/summary", response_model=schemas.SalarySummaryOut, dependencies=[Depends(require_roles(*FINANCE_ROLES))])
def get_salary_summary(school_id: int, month: int, year: int, db: Session = Depends(get_db)):
    """
    What a School Admin actually wants to see at a glance: how many
    staff are paid vs still pending this month, and the two totals —
    without having to add it up from a raw payment list themselves.
    """
    payments = db.query(models.SalaryPayment).filter(
        models.SalaryPayment.school_id == school_id, models.SalaryPayment.month == month, models.SalaryPayment.year == year,
    ).all()
    paid = [p for p in payments if p.payment_status == "paid"]
    pending = [p for p in payments if p.payment_status == "pending"]

    total_staff = db.query(models.User).join(models.Role).filter(
        models.User.school_id == school_id, models.Role.name != "school_admin", models.User.is_active == True,  # noqa: E712
    ).count()

    return schemas.SalarySummaryOut(
        month=month, year=year, total_staff=total_staff,
        paid_count=len(paid), pending_count=len(pending) + max(total_staff - len(payments), 0),
        total_paid_amount=sum(p.net_salary for p in paid),
        total_pending_amount=sum(p.net_salary for p in pending),
    )

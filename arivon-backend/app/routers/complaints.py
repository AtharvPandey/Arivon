"""
Parent Complaint log — lightweight, not a full ticketing system. See
models.ParentComplaint for the reasoning.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime

from app.database import get_db
from app import models, schemas
from app.core.deps import get_current_user, require_roles

WORKBENCH_ROLES = ("school_admin", "principal", "vice_principal", "administrator", "super_admin")

router = APIRouter(prefix="/complaints", tags=["complaints"])


@router.post("/", response_model=schemas.ParentComplaintOut, status_code=201,
             dependencies=[Depends(require_roles(*WORKBENCH_ROLES))])
def log_complaint(
    payload: schemas.ParentComplaintCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    complaint = models.ParentComplaint(**payload.model_dump(), logged_by_user_id=current_user.id)
    db.add(complaint)
    db.commit()
    db.refresh(complaint)
    return complaint


@router.get("/", response_model=list[schemas.ParentComplaintOut],
            dependencies=[Depends(require_roles(*WORKBENCH_ROLES))])
def list_complaints(school_id: int, status: str | None = None, db: Session = Depends(get_db)):
    query = db.query(models.ParentComplaint).filter(models.ParentComplaint.school_id == school_id)
    if status:
        query = query.filter(models.ParentComplaint.status == status)
    return query.order_by(models.ParentComplaint.created_at.desc()).all()


@router.patch("/{complaint_id}/resolve", response_model=schemas.ParentComplaintOut,
              dependencies=[Depends(require_roles(*WORKBENCH_ROLES))])
def resolve_complaint(
    complaint_id: int,
    payload: schemas.ParentComplaintResolve,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    complaint = db.query(models.ParentComplaint).filter(models.ParentComplaint.id == complaint_id).first()
    if not complaint:
        raise HTTPException(status_code=404, detail="Complaint not found")

    complaint.status = "resolved"
    complaint.resolution_notes = payload.resolution_notes
    complaint.resolved_by_user_id = current_user.id
    complaint.resolved_at = datetime.utcnow()
    db.commit()
    db.refresh(complaint)
    return complaint

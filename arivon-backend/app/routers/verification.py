"""
Verification & Compliance module API — the Verification Queue, the
Verification Screen, Approve/Reject/Resubmit, Document Verification,
the Compliance Dashboard, and the (manually-triggered) Reminder Engine.

All endpoints require Platform Admin authentication, matching every
other Platform-level router — verification and compliance are Platform
Admin responsibilities, not school-staff ones.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app import models, schemas
from app.core.deps import get_current_platform_admin
from app.services.verification_service import VerificationService, VerificationError

router = APIRouter(
    prefix="/platform/verification",
    tags=["verification"],
    dependencies=[Depends(get_current_platform_admin)],
)

compliance_router = APIRouter(
    prefix="/platform/compliance",
    tags=["compliance"],
    dependencies=[Depends(get_current_platform_admin)],
)


def _service(db: Session = Depends(get_db)) -> VerificationService:
    return VerificationService(db)


def _handle(fn):
    try:
        return fn()
    except VerificationError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ---------- Verification Queue ----------

@router.get("/queue", response_model=list[schemas.VerificationQueueItem])
def get_verification_queue(service: VerificationService = Depends(_service)):
    return service.get_queue()


# ---------- Verification Screen ----------

@router.get("/{school_id}", response_model=schemas.VerificationDetailOut)
def get_verification_detail(school_id: int, service: VerificationService = Depends(_service)):
    return _handle(lambda: service.get_verification_detail(school_id))


@router.post("/{school_id}/documents/{document_id}/verify", response_model=schemas.DocumentVerifyResponse)
def verify_document(
    school_id: int,
    document_id: int,
    service: VerificationService = Depends(_service),
    current_admin: models.PlatformAdmin = Depends(get_current_platform_admin),
):
    return _handle(lambda: service.verify_document(document_id, current_admin.id))


# ---------- Approve / Reject / Resubmit ----------

@router.post("/{school_id}/approve", response_model=schemas.ActiveProvisioningResult)
def approve_school(
    school_id: int,
    service: VerificationService = Depends(_service),
    current_admin: models.PlatformAdmin = Depends(get_current_platform_admin),
):
    return _handle(lambda: service.approve(school_id, current_admin.id))


@router.post("/{school_id}/reject", response_model=schemas.VerificationActionResponse)
def reject_school(
    school_id: int,
    payload: schemas.RejectSchoolRequest,
    service: VerificationService = Depends(_service),
    current_admin: models.PlatformAdmin = Depends(get_current_platform_admin),
):
    def action():
        school = service.reject(school_id, payload, current_admin.id)
        return schemas.VerificationActionResponse(
            school_id=school.id, lifecycle_status=school.lifecycle_status,
            message=f"{school.name} rejected: {payload.reason}",
        )
    return _handle(action)


@router.post("/{school_id}/resubmit", response_model=schemas.VerificationActionResponse)
def resubmit_school(
    school_id: int,
    payload: schemas.ResubmitSchoolRequest,
    service: VerificationService = Depends(_service),
    current_admin: models.PlatformAdmin = Depends(get_current_platform_admin),
):
    def action():
        school = service.resubmit(school_id, payload, current_admin.id)
        return schemas.VerificationActionResponse(
            school_id=school.id, lifecycle_status=school.lifecycle_status,
            message=f"{school.name} resubmitted for verification.",
        )
    return _handle(action)


# ---------- Compliance Dashboard ----------

@compliance_router.get("/dashboard", response_model=schemas.ComplianceDashboardOut)
def get_compliance_dashboard(
    school_id: int | None = None,
    within_days: int = 60,
    service: VerificationService = Depends(_service),
):
    return service.get_compliance_dashboard(school_id, within_days)


@compliance_router.post("/reminders/run", response_model=schemas.ReminderRunResult)
def run_reminders(service: VerificationService = Depends(_service)):
    return service.run_reminders()


@compliance_router.get("/documents/{document_id}/history", response_model=list[schemas.DocumentHistoryEntry])
def get_document_history(document_id: int, service: VerificationService = Depends(_service)):
    return _handle(lambda: service.get_document_history(document_id))

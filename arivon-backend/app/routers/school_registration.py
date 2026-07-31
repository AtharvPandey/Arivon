"""
School Registration wizard API — implements the PRD's 10-step flow on
top of the foundation (models/schemas/enums/repositories/services)
built previously. Every endpoint requires Platform Admin authentication,
since registering a school is exclusively a Platform action.

Error handling convention: SchoolRegistrationError and
InvalidLifecycleTransitionError are expected, user-facing failure modes
(bad input, wrong state) and map to 400. Anything else is an unexpected
error and is allowed to propagate to FastAPI's default 500 handler
rather than being silently swallowed.
"""

from datetime import date

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app import models, schemas
from app.core.deps import get_current_platform_admin
from app.services.school_registration_service import SchoolRegistrationService, SchoolRegistrationError
from app.services.school_lifecycle_service import InvalidLifecycleTransitionError

router = APIRouter(
    prefix="/school-registration",
    tags=["school-registration"],
    dependencies=[Depends(get_current_platform_admin)],
)


def _service(db: Session = Depends(get_db)) -> SchoolRegistrationService:
    return SchoolRegistrationService(db)


def _handle(fn):
    """Small helper to keep the expected-error -> 400 mapping consistent
    across every endpoint without repeating the same try/except everywhere."""
    try:
        return fn()
    except SchoolRegistrationError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except InvalidLifecycleTransitionError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ---------- Register School ----------

@router.post("/register", response_model=schemas.SchoolDraftOut, status_code=201)
def register_school(
    payload: schemas.RegisterSchoolRequest,
    service: SchoolRegistrationService = Depends(_service),
):
    return _handle(lambda: service.register(payload))


# ---------- Resume Draft ----------

@router.get("/drafts", response_model=list[schemas.SchoolDraftOut])
def list_drafts(service: SchoolRegistrationService = Depends(_service)):
    return service.list_drafts()


@router.get("/{school_id}", response_model=schemas.SchoolDraftOut)
def resume_draft(school_id: int, service: SchoolRegistrationService = Depends(_service)):
    return _handle(lambda: service.get_draft(school_id))


# ---------- Update Draft ----------

class UpdateDraftRequest(BaseModel):
    identity: schemas.SchoolIdentityUpdate | None = None
    government_recognition: schemas.GovernmentRecognitionUpdate | None = None
    address_contact: schemas.SchoolAddressContactUpdate | None = None


@router.patch("/{school_id}/draft", response_model=schemas.SchoolDraftOut)
def update_draft(
    school_id: int,
    payload: UpdateDraftRequest,
    service: SchoolRegistrationService = Depends(_service),
):
    return _handle(lambda: service.update_draft(
        school_id, payload.identity, payload.government_recognition, payload.address_contact,
    ))


@router.patch("/{school_id}/management", response_model=schemas.SchoolDraftOut)
def update_management(
    school_id: int,
    payload: schemas.ManagementDetailsUpdate,
    service: SchoolRegistrationService = Depends(_service),
):
    return _handle(lambda: service.update_management_details(school_id, payload))


@router.patch("/{school_id}/classes-offered", response_model=schemas.SchoolDraftOut)
def update_classes_offered(
    school_id: int,
    payload: schemas.ClassesOfferedUpdate,
    service: SchoolRegistrationService = Depends(_service),
):
    return _handle(lambda: service.update_classes_offered(school_id, payload))


# ---------- Academic Configuration ----------

@router.patch("/{school_id}/academic-configuration", response_model=schemas.SchoolDraftOut)
def update_academic_configuration(
    school_id: int,
    payload: schemas.SchoolAcademicConfigUpdate,
    service: SchoolRegistrationService = Depends(_service),
):
    return _handle(lambda: service.update_academic_config(school_id, payload))


# ---------- Save Branding ----------

@router.patch("/{school_id}/branding", response_model=schemas.SchoolDraftOut)
def save_branding(
    school_id: int,
    payload: schemas.SchoolBrandingUpdate,
    service: SchoolRegistrationService = Depends(_service),
):
    return _handle(lambda: service.update_branding(school_id, payload))


@router.post("/{school_id}/branding/{asset_type}", response_model=schemas.SchoolDraftOut)
async def upload_branding_asset(
    school_id: int, asset_type: str,
    file: UploadFile = File(...),
    service: SchoolRegistrationService = Depends(_service),
):
    """
    Real file upload for logo/banner/seal/letterhead — asset_type is one
    of those four literal strings, matching the buttons on the wizard's
    Branding step. Replaces pasting an external URL.
    """
    try:
        return await service.upload_branding_asset(school_id, asset_type, file)
    except SchoolRegistrationError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ---------- Organization Settings ----------

@router.patch("/{school_id}/organization-settings", response_model=schemas.SchoolOrganizationSettingsOut)
def update_organization_settings(
    school_id: int,
    payload: schemas.SchoolOrganizationSettingsUpdate,
    service: SchoolRegistrationService = Depends(_service),
):
    return _handle(lambda: service.update_organization_settings(school_id, payload))


# ---------- Infrastructure ----------

@router.patch("/{school_id}/infrastructure", response_model=schemas.SchoolInfrastructureOut)
def update_infrastructure(
    school_id: int,
    payload: schemas.SchoolInfrastructureUpdate,
    service: SchoolRegistrationService = Depends(_service),
):
    return _handle(lambda: service.update_infrastructure(school_id, payload))


# ---------- Subscription ----------

@router.patch("/{school_id}/subscription", response_model=schemas.SchoolDraftOut)
def update_subscription(
    school_id: int,
    payload: schemas.SchoolSubscriptionDetailsUpdate,
    service: SchoolRegistrationService = Depends(_service),
):
    return _handle(lambda: service.update_subscription(school_id, payload))


# ---------- Upload Documents ----------

@router.post("/{school_id}/documents", response_model=schemas.DocumentUploadResultOut, status_code=201)
async def upload_document(
    school_id: int,
    document_type: str = Form(...),
    issue_date: date | None = Form(None),
    expiry_date: date | None = Form(None),
    file: UploadFile = File(...),
    service: SchoolRegistrationService = Depends(_service),
    current_admin: models.PlatformAdmin = Depends(get_current_platform_admin),
):
    try:
        document = await service.upload_document(
            school_id, document_type, issue_date, expiry_date, file,
            uploaded_by_user_id=current_admin.id,
        )
    except SchoolRegistrationError as e:
        raise HTTPException(status_code=400, detail=str(e))

    return schemas.DocumentUploadResultOut(
        id=document.id, document_type=document.document_type,
        original_filename=document.original_filename,
        issue_date=document.issue_date, expiry_date=document.expiry_date,
        computed_status=service.compute_compliance_status(document.expiry_date),
    )


@router.get("/{school_id}/documents", response_model=list[schemas.DocumentUploadResultOut])
def list_documents(school_id: int, service: SchoolRegistrationService = Depends(_service)):
    documents = service.get_documents(school_id)
    return [
        schemas.DocumentUploadResultOut(
            id=d.id, document_type=d.document_type, original_filename=d.original_filename,
            issue_date=d.issue_date, expiry_date=d.expiry_date,
            computed_status=service.compute_compliance_status(d.expiry_date),
        )
        for d in documents
    ]


# ---------- Review ----------

@router.get("/{school_id}/review", response_model=schemas.SchoolReviewOut)
def review_draft(school_id: int, service: SchoolRegistrationService = Depends(_service)):
    return _handle(lambda: service.get_review(school_id))


# ---------- Create School ----------

@router.post("/{school_id}/create", response_model=schemas.CreateSchoolResponse, status_code=201)
def create_school(
    school_id: int,
    payload: schemas.CreateSchoolRequest,
    service: SchoolRegistrationService = Depends(_service),
    current_admin: models.PlatformAdmin = Depends(get_current_platform_admin),
):
    return _handle(lambda: service.create_school(school_id, payload, platform_admin_id=current_admin.id))

"""
Platform Admin School Management module API. Lives at a distinct
/platform/school-management prefix rather than extending the existing
/platform/schools endpoints — those are already relied on by the current
Platform Dashboard with a fixed response shape, and changing them risks
breaking a working feature. This module is additive: richer listing
(search/filter/sort/health score), detail bundles, timeline, bulk
actions, impersonation, and export.
"""

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session

from app.database import get_db
from app import models, schemas
from app.core.deps import get_current_platform_admin
from app.services.school_management_service import SchoolManagementService, SchoolManagementError

router = APIRouter(
    prefix="/platform/school-management",
    tags=["school-management"],
    dependencies=[Depends(get_current_platform_admin)],
)


def _service(db: Session = Depends(get_db)) -> SchoolManagementService:
    return SchoolManagementService(db)


def _handle(fn):
    """Consistent with the same helper in school_registration.py and
    verification.py — found this router doing ad-hoc try/except with a
    repeated inline `from fastapi import HTTPException` in two different
    functions during the review; consolidated to match."""
    try:
        return fn()
    except SchoolManagementError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ---------- Schools Listing: search, filter, sort ----------

@router.get("/schools", response_model=list[schemas.SchoolListItemOut])
def list_schools(
    search: str | None = None,
    lifecycle_status: str | None = None,
    subscription_plan: str | None = None,
    board_type: str | None = None,
    sort_by: str = "created_at",
    sort_dir: str = "desc",
    service: SchoolManagementService = Depends(_service),
):
    return service.list_schools(search, lifecycle_status, subscription_plan, board_type, sort_by, sort_dir)


# ---------- School Details ----------

@router.get("/schools/{school_id}/detail", response_model=schemas.SchoolDetailOut)
def get_school_detail(school_id: int, service: SchoolManagementService = Depends(_service)):
    return service.get_school_detail(school_id)


# ---------- School Timeline ----------

@router.get("/schools/{school_id}/timeline", response_model=list[schemas.TimelineEvent])
def get_school_timeline(school_id: int, service: SchoolManagementService = Depends(_service)):
    return service.get_timeline(school_id)


# ---------- Bulk Actions ----------

@router.post("/schools/bulk-action", response_model=schemas.BulkActionResult)
def bulk_action(
    payload: schemas.BulkActionRequest,
    service: SchoolManagementService = Depends(_service),
    current_admin: models.PlatformAdmin = Depends(get_current_platform_admin),
):
    return _handle(lambda: service.bulk_action(payload.school_ids, payload.action, current_admin.id))


# ---------- Impersonate ----------

@router.post("/schools/{school_id}/impersonate", response_model=schemas.ImpersonateResponse)
def impersonate_school(
    school_id: int,
    service: SchoolManagementService = Depends(_service),
    current_admin: models.PlatformAdmin = Depends(get_current_platform_admin),
):
    return _handle(lambda: service.impersonate(school_id, current_admin.id))


# ---------- Export ----------

@router.get("/schools/export")
def export_schools(service: SchoolManagementService = Depends(_service)):
    csv_content = service.export_schools_csv()
    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=arivon_schools_export.csv"},
    )

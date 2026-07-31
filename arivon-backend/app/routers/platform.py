"""
Platform Super Admin capabilities. Every endpoint here requires a
platform admin token (get_current_platform_admin) — a school's own
school_admin, principal, etc. cannot reach any of this, no matter their
role, because they authenticate through a completely different system.
"""

from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app import models, schemas
from app.core.deps import get_current_platform_admin
from app.core.security import hash_password
from app.core.slug_utils import generate_unique_school_slug

router = APIRouter(
    prefix="/platform",
    tags=["platform"],
    dependencies=[Depends(get_current_platform_admin)],
)


def _log_action(
    db: Session,
    admin: models.PlatformAdmin,
    action: str,
    school_id: int | None = None,
    details: str | None = None,
):
    entry = models.AuditLog(
        platform_admin_id=admin.id, school_id=school_id, action=action, details=details
    )
    db.add(entry)


# ---------- School registration & management ----------

@router.post("/schools", response_model=schemas.SchoolPlatformOut, status_code=201)
def register_school(
    payload: schemas.SchoolRegisterRequest,
    db: Session = Depends(get_db),
    current_admin: models.PlatformAdmin = Depends(get_current_platform_admin),
):
    existing_user = db.query(models.User).filter(models.User.email == payload.admin_email).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="This admin email is already registered")

    school = models.School(
        name=payload.name,
        slug=generate_unique_school_slug(db, payload.name),
        board_type=payload.board_type,
        city=payload.city,
        state=payload.state,
        subscription_plan=payload.subscription_plan,
        subscription_status="trial",
        education_level=payload.education_level,
        # This is the trusted, instant registration path (no
        # verification wizard, no document review) — it goes straight
        # to "active" rather than defaulting to "draft", since nothing
        # in this flow would ever move it out of draft otherwise, and
        # the school's staff would be silently locked out of login
        # (see auth.py's lifecycle-aware login gate).
        lifecycle_status="active",
    )
    db.add(school)
    db.flush()

    school_admin_role = db.query(models.Role).filter(models.Role.name == "school_admin").first()
    if not school_admin_role:
        raise HTTPException(status_code=500, detail="school_admin role not seeded — restart the server once")

    admin_user = models.User(
        school_id=school.id,
        role_id=school_admin_role.id,
        full_name=payload.admin_full_name,
        email=payload.admin_email,
        hashed_password=hash_password(payload.admin_password),
    )
    db.add(admin_user)

    _log_action(db, current_admin, "school_registered", school.id, f"Created with admin {payload.admin_email}")

    db.commit()
    db.refresh(school)
    return school


@router.get("/schools", response_model=list[schemas.SchoolPlatformOut])
def list_schools(db: Session = Depends(get_db)):
    return db.query(models.School).order_by(models.School.created_at.desc()).all()


@router.get("/schools/{school_id}", response_model=schemas.SchoolPlatformOut)
def get_school(school_id: int, db: Session = Depends(get_db)):
    school = db.query(models.School).filter(models.School.id == school_id).first()
    if not school:
        raise HTTPException(status_code=404, detail="School not found")
    return school


@router.patch("/schools/{school_id}/subscription", response_model=schemas.SchoolPlatformOut)
def update_subscription(
    school_id: int,
    payload: schemas.SubscriptionUpdate,
    db: Session = Depends(get_db),
    current_admin: models.PlatformAdmin = Depends(get_current_platform_admin),
):
    school = db.query(models.School).filter(models.School.id == school_id).first()
    if not school:
        raise HTTPException(status_code=404, detail="School not found")

    changes = []
    if payload.subscription_status is not None:
        changes.append(f"status: {school.subscription_status} -> {payload.subscription_status}")
        school.subscription_status = payload.subscription_status
        school.is_active = payload.subscription_status not in ("suspended", "cancelled")
    if payload.subscription_plan is not None:
        changes.append(f"plan: {school.subscription_plan} -> {payload.subscription_plan}")
        school.subscription_plan = payload.subscription_plan

    _log_action(db, current_admin, "subscription_updated", school_id, "; ".join(changes))

    db.commit()
    db.refresh(school)
    return school


@router.patch("/schools/{school_id}/branding", response_model=schemas.SchoolPlatformOut)
def update_branding(
    school_id: int,
    payload: schemas.BrandingUpdate,
    db: Session = Depends(get_db),
    current_admin: models.PlatformAdmin = Depends(get_current_platform_admin),
):
    school = db.query(models.School).filter(models.School.id == school_id).first()
    if not school:
        raise HTTPException(status_code=404, detail="School not found")

    if payload.logo_url is not None:
        school.logo_url = payload.logo_url
    if payload.primary_color is not None:
        school.primary_color = payload.primary_color

    _log_action(db, current_admin, "branding_updated", school_id)

    db.commit()
    db.refresh(school)
    return school


# ---------- Feature flags ----------

@router.put("/schools/{school_id}/features", response_model=schemas.FeatureFlagOut)
def set_feature_flag(
    school_id: int,
    payload: schemas.FeatureFlagUpdate,
    db: Session = Depends(get_db),
    current_admin: models.PlatformAdmin = Depends(get_current_platform_admin),
):
    flag = db.query(models.FeatureFlag).filter(
        models.FeatureFlag.school_id == school_id,
        models.FeatureFlag.feature_key == payload.feature_key,
    ).first()

    if flag:
        flag.is_enabled = payload.is_enabled
    else:
        flag = models.FeatureFlag(
            school_id=school_id, feature_key=payload.feature_key, is_enabled=payload.is_enabled
        )
        db.add(flag)

    _log_action(
        db, current_admin, "feature_flag_updated", school_id,
        f"{payload.feature_key} -> {'enabled' if payload.is_enabled else 'disabled'}",
    )

    db.commit()
    db.refresh(flag)
    return flag


@router.get("/schools/{school_id}/features", response_model=list[schemas.FeatureFlagOut])
def list_feature_flags(school_id: int, db: Session = Depends(get_db)):
    return db.query(models.FeatureFlag).filter(models.FeatureFlag.school_id == school_id).all()


# ---------- Support access ----------

@router.patch("/schools/{school_id}/support-access", response_model=schemas.SchoolPlatformOut)
def set_support_access(
    school_id: int,
    payload: schemas.SupportAccessUpdate,
    db: Session = Depends(get_db),
    current_admin: models.PlatformAdmin = Depends(get_current_platform_admin),
):
    school = db.query(models.School).filter(models.School.id == school_id).first()
    if not school:
        raise HTTPException(status_code=404, detail="School not found")

    school.support_access_enabled = payload.support_access_enabled
    _log_action(
        db, current_admin, "support_access_changed", school_id,
        f"enabled={payload.support_access_enabled}",
    )
    db.commit()
    db.refresh(school)
    return school


@router.get("/schools/{school_id}/support-overview", response_model=schemas.SupportOverview)
def get_support_overview(
    school_id: int,
    db: Session = Depends(get_db),
    current_admin: models.PlatformAdmin = Depends(get_current_platform_admin),
):
    school = db.query(models.School).filter(models.School.id == school_id).first()
    if not school:
        raise HTTPException(status_code=404, detail="School not found")

    if not school.support_access_enabled:
        raise HTTPException(
            status_code=403,
            detail=(
                "Support access is not enabled for this school. Enable it via "
                "PATCH /platform/schools/{id}/support-access before viewing "
                "support diagnostics — Arivon staff cannot see school data by default."
            ),
        )

    _log_action(db, current_admin, "support_overview_viewed", school_id)
    db.commit()

    total_students = db.query(models.Student).filter(models.Student.school_id == school_id).count()
    total_staff = db.query(models.User).filter(models.User.school_id == school_id).count()
    total_classes = db.query(models.SchoolClass).filter(models.SchoolClass.school_id == school_id).count()

    return schemas.SupportOverview(
        school_id=school.id,
        school_name=school.name,
        total_students=total_students,
        total_staff=total_staff,
        total_classes=total_classes,
        subscription_status=school.subscription_status,
        last_activity_note="Read-only diagnostic snapshot — not live operational access.",
    )


# ---------- Platform-wide analytics ----------

@router.get("/analytics", response_model=schemas.PlatformAnalytics)
def get_platform_analytics(db: Session = Depends(get_db)):
    total_schools = db.query(models.School).count()
    active_schools = db.query(models.School).filter(models.School.subscription_status == "active").count()
    trial_schools = db.query(models.School).filter(models.School.subscription_status == "trial").count()
    suspended_schools = db.query(models.School).filter(models.School.subscription_status == "suspended").count()
    total_students = db.query(models.Student).count()
    total_staff = db.query(models.User).count()

    return schemas.PlatformAnalytics(
        total_schools=total_schools,
        active_schools=active_schools,
        trial_schools=trial_schools,
        suspended_schools=suspended_schools,
        total_students_platform_wide=total_students,
        total_staff_platform_wide=total_staff,
    )


# ---------- Audit logs ----------

@router.get("/logs", response_model=list[schemas.AuditLogOut])
def list_audit_logs(school_id: int | None = None, db: Session = Depends(get_db)):
    query = db.query(models.AuditLog)
    if school_id is not None:
        query = query.filter(models.AuditLog.school_id == school_id)
    return query.order_by(models.AuditLog.created_at.desc()).limit(200).all()


# ---------- System health ("database maintenance" visibility) ----------

@router.get("/system/health")
def system_health(db: Session = Depends(get_db)):
    """
    Lightweight ops visibility — NOT automated backup/restore (that's
    infrastructure-level tooling, not an API endpoint). This just confirms
    the database is reachable and reports basic row counts, so the
    Arivon team has a quick sanity check without needing direct DB access.
    """
    try:
        school_count = db.query(models.School).count()
        db_ok = True
    except Exception:
        school_count = None
        db_ok = False

    return {
        "database_reachable": db_ok,
        "schools_table_row_count": school_count,
        "checked_at": datetime.utcnow().isoformat(),
    }

"""
Platform Admin School Management module. Composes existing pieces
(School, PlatformAuditLog, ComplianceService, FeatureFlag, Department)
rather than duplicating them — the only genuinely new logic here is the
Health Score / Organization Completeness formulas, the Timeline merge,
Bulk Actions, and Impersonation.
"""

import csv
import io
from datetime import datetime, timedelta

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app import models, schemas
from app.core.security import create_access_token
from app.services.compliance_service import ComplianceService


class SchoolManagementError(Exception):
    """Expected, user-facing error — maps to 400/403 at the router."""
    pass


# ---------- Health Score ----------
# 0-100, four weighted factors. Deliberately simple and explainable —
# every point is traceable to a specific, real signal, not a black box.
LIFECYCLE_POINTS = {
    "active": 40, "verified": 30, "pending_verification": 15,
    "draft": 5, "rejected": 0, "suspended": 0, "closed": 0,
}


class SchoolManagementService:
    def __init__(self, db: Session):
        self.db = db
        self.compliance = ComplianceService(db)

    # ---------- Listing: search, filter, sort ----------

    def list_schools(
        self,
        search: str | None = None,
        lifecycle_status: str | None = None,
        subscription_plan: str | None = None,
        board_type: str | None = None,
        sort_by: str = "created_at",
        sort_dir: str = "desc",
    ) -> list[schemas.SchoolListItemOut]:
        query = self.db.query(models.School)

        if search:
            like = f"%{search}%"
            query = query.filter(
                (models.School.name.ilike(like))
                | (models.School.city.ilike(like))
                | (models.School.contact_email.ilike(like))
            )
        if lifecycle_status:
            query = query.filter(models.School.lifecycle_status == lifecycle_status)
        if subscription_plan:
            query = query.filter(models.School.subscription_plan == subscription_plan)
        if board_type:
            query = query.filter(models.School.board_type == board_type)

        # Whitelisted, not a raw getattr(model, sort_by) — an
        # unrestricted attribute lookup on a user-supplied string could
        # resolve to a relationship (e.g. "academic_years") instead of a
        # sortable column and throw an unhandled 500, or reach an
        # attribute never intended to be sortable. Found during the
        # production readiness review.
        SORTABLE_COLUMNS = {
            "name": models.School.name,
            "created_at": models.School.created_at,
            "lifecycle_status": models.School.lifecycle_status,
            "subscription_plan": models.School.subscription_plan,
            "city": models.School.city,
        }
        sort_column = SORTABLE_COLUMNS.get(sort_by, models.School.created_at)
        query = query.order_by(sort_column.desc() if sort_dir == "desc" else sort_column.asc())

        schools = query.all()

        # Fixed a real N+1 here during the production readiness review:
        # this used to call compute_health_score(s) per row, and that
        # method alone runs 3 queries — so listing 50 schools meant 151
        # queries. Batch-fetch counts for every school in this result
        # set in exactly 3 queries total, then score using the batch,
        # regardless of how many rows are being listed.
        school_ids = [s.id for s in schools]
        student_counts = self._batch_count(models.Student, school_ids)
        staff_counts = self._batch_count(models.User, school_ids)
        document_rows = self.db.query(models.Document.school_id, models.Document.expiry_date).filter(
            models.Document.entity_type == "school", models.Document.school_id.in_(school_ids),
        ).all() if school_ids else []
        documents_by_school: dict[int, list] = {}
        for school_id, expiry_date in document_rows:
            documents_by_school.setdefault(school_id, []).append(expiry_date)

        return [
            schemas.SchoolListItemOut(
                id=s.id, name=s.name, board_type=s.board_type, city=s.city, state=s.state,
                lifecycle_status=s.lifecycle_status or "draft",
                subscription_plan=s.subscription_plan, subscription_status=s.subscription_status,
                health_score=self._score_from_batch(
                    s, student_counts.get(s.id, 0), staff_counts.get(s.id, 0), documents_by_school.get(s.id, []),
                ),
                created_at=s.created_at,
            )
            for s in schools
        ]

    def _batch_count(self, model, school_ids: list[int]) -> dict[int, int]:
        if not school_ids:
            return {}
        from sqlalchemy import func
        rows = self.db.query(model.school_id, func.count(model.id)).filter(
            model.school_id.in_(school_ids)
        ).group_by(model.school_id).all()
        return dict(rows)

    def _score_from_batch(self, school, student_count: int, staff_count: int, expiry_dates: list) -> int:
        """Same formula as compute_health_score, computed from
        already-fetched batch data instead of firing new queries — the
        single-school detail view still uses compute_health_score
        directly (see below), since a full breakdown is worth the extra
        precision there and it's only ever called once per request."""
        lifecycle_points = LIFECYCLE_POINTS.get(school.lifecycle_status or "draft", 0)
        expired = any(self.compliance.compute_status(d).value == "expired" for d in expiry_dates)
        expiring_soon = any(self.compliance.compute_status(d).value == "expiring_soon" for d in expiry_dates)
        compliance_points = 0 if expired else (10 if expiring_soon else 20)
        engagement_points = (15 if student_count > 0 else 0) + (15 if staff_count > 0 else 0)
        subscription_points = 10 if school.subscription_status == "active" else 0
        return lifecycle_points + compliance_points + engagement_points + subscription_points

    # ---------- Health Score ----------

    def compute_health_score(self, school: models.School) -> schemas.HealthScoreBreakdown:
        factors = []

        lifecycle_points = LIFECYCLE_POINTS.get(school.lifecycle_status or "draft", 0)
        factors.append(schemas.HealthScoreFactor(
            label="Lifecycle Status", points=lifecycle_points, max_points=40,
            detail=(school.lifecycle_status or "draft").replace("_", " "),
        ))

        documents = self.db.query(models.Document).filter(
            models.Document.entity_type == "school", models.Document.entity_id == school.id,
        ).all()
        expired = any(self.compliance.compute_status(d.expiry_date).value == "expired" for d in documents)
        expiring_soon = any(self.compliance.compute_status(d.expiry_date).value == "expiring_soon" for d in documents)
        compliance_points = 0 if expired else (10 if expiring_soon else 20)
        factors.append(schemas.HealthScoreFactor(
            label="Compliance", points=compliance_points, max_points=20,
            detail="Expired document(s)" if expired else "Expiring soon" if expiring_soon else "All valid",
        ))

        student_count = self.db.query(models.Student).filter(models.Student.school_id == school.id).count()
        staff_count = self.db.query(models.User).filter(models.User.school_id == school.id).count()
        engagement_points = (15 if student_count > 0 else 0) + (15 if staff_count > 0 else 0)
        factors.append(schemas.HealthScoreFactor(
            label="Engagement", points=engagement_points, max_points=30,
            detail=f"{student_count} students, {staff_count} staff",
        ))

        subscription_points = 10 if school.subscription_status == "active" else 0
        factors.append(schemas.HealthScoreFactor(
            label="Subscription", points=subscription_points, max_points=10,
            detail=school.subscription_status or "unknown",
        ))

        total = sum(f.points for f in factors)
        return schemas.HealthScoreBreakdown(score=total, factors=factors)

    # ---------- Organization Completeness ----------

    def compute_completeness(self, school: models.School) -> schemas.CompletenessBreakdown:
        checks = []

        # Logo presence is the strongest signal of deliberate branding —
        # color alone is ambiguous once provision_branding_defaults has
        # run (a default color and a chosen-but-identical color are
        # indistinguishable), so this check doesn't try to compare colors.
        checks.append(schemas.CompletenessCheck(
            label="Branding configured", complete=bool(school.logo_url),
        ))
        checks.append(schemas.CompletenessCheck(
            label="Academic configuration set", complete=bool(school.medium_of_instruction),
        ))
        infra = self.db.query(models.SchoolInfrastructure).filter(
            models.SchoolInfrastructure.school_id == school.id
        ).first()
        checks.append(schemas.CompletenessCheck(label="Infrastructure details provided", complete=infra is not None))

        doc_count = self.db.query(models.Document).filter(
            models.Document.entity_type == "school", models.Document.entity_id == school.id,
        ).count()
        checks.append(schemas.CompletenessCheck(label="Compliance documents uploaded", complete=doc_count > 0))

        checks.append(schemas.CompletenessCheck(
            label="Organization fully provisioned", complete=school.lifecycle_status == "active",
        ))

        complete_count = sum(1 for c in checks if c.complete)
        percentage = round((complete_count / len(checks)) * 100)
        return schemas.CompletenessBreakdown(percentage=percentage, checks=checks)

    # ---------- School Details ----------

    def get_school_detail(self, school_id: int) -> schemas.SchoolDetailOut:
        school = self._get_school(school_id)

        department_count = self.db.query(models.Department).filter(models.Department.school_id == school_id).count()
        student_count = self.db.query(models.Student).filter(models.Student.school_id == school_id).count()
        staff_count = self.db.query(models.User).filter(models.User.school_id == school_id).count()
        documents = self.db.query(models.Document).filter(
            models.Document.entity_type == "school", models.Document.entity_id == school_id,
        ).all()
        expiring = [d for d in documents if self.compliance.compute_status(d.expiry_date).value in ("expiring_soon", "expired")]

        return schemas.SchoolDetailOut(
            id=school.id, name=school.name, short_name=school.short_name,
            board_type=school.board_type, school_type=school.school_type, school_category=school.school_category,
            city=school.city, state=school.state, contact_email=school.contact_email, contact_phone=school.contact_phone,
            lifecycle_status=school.lifecycle_status or "draft",
            subscription_plan=school.subscription_plan, subscription_status=school.subscription_status,
            billing_cycle=school.billing_cycle, contract_start_date=school.contract_start_date,
            contract_end_date=school.contract_end_date,
            support_access_enabled=school.support_access_enabled,
            department_count=department_count, student_count=student_count, staff_count=staff_count,
            document_count=len(documents), documents_needing_attention=len(expiring),
            health_score=self.compute_health_score(school),
            completeness=self.compute_completeness(school),
            created_at=school.created_at,
        )

    # ---------- Timeline ----------

    def get_timeline(self, school_id: int) -> list[schemas.TimelineEvent]:
        self._get_school(school_id)  # 404 if missing
        events = []

        audit_entries = self.db.query(models.AuditLog).filter(
            models.AuditLog.school_id == school_id
        ).order_by(models.AuditLog.created_at.asc()).all()
        for entry in audit_entries:
            events.append(schemas.TimelineEvent(
                event_type=entry.action, description=entry.details, occurred_at=entry.created_at,
            ))

        events.sort(key=lambda e: e.occurred_at)
        return events

    # ---------- Bulk Actions ----------

    def bulk_action(self, school_ids: list[int], action: str, platform_admin_id: int) -> schemas.BulkActionResult:
        VALID_ACTIONS = {"suspend", "reactivate", "close"}
        if action not in VALID_ACTIONS:
            raise SchoolManagementError(f"Unknown bulk action '{action}'. Must be one of {VALID_ACTIONS}")

        succeeded = []
        failed = []
        for school_id in school_ids:
            school = self.db.query(models.School).filter(models.School.id == school_id).first()
            if not school:
                failed.append({"school_id": school_id, "reason": "not found"})
                continue

            try:
                if action == "suspend":
                    school.lifecycle_status = "suspended"
                    school.is_active = False
                elif action == "reactivate":
                    if school.lifecycle_status != "suspended":
                        raise SchoolManagementError(f"School {school_id} is not suspended")
                    school.lifecycle_status = "active"
                    school.is_active = True
                elif action == "close":
                    school.lifecycle_status = "closed"
                    school.is_active = False

                self.db.add(models.AuditLog(
                    platform_admin_id=platform_admin_id, school_id=school_id,
                    action=f"bulk_{action}", details=f"Applied via bulk action on {len(school_ids)} school(s)",
                ))
                succeeded.append(school_id)
            except SchoolManagementError as e:
                failed.append({"school_id": school_id, "reason": str(e)})

        self.db.commit()
        return schemas.BulkActionResult(succeeded=succeeded, failed=failed)

    # ---------- Impersonate ----------

    def impersonate(self, school_id: int, platform_admin_id: int) -> schemas.ImpersonateResponse:
        """
        Reuses the EXISTING support_access_enabled gate (same one that
        already guards /support-overview) rather than introducing a
        separate permission concept — a Platform Admin who hasn't
        explicitly enabled support access for this school cannot
        impersonate it either. Every impersonation is audit-logged with
        a distinctly named action so it's never confused with a normal
        support-overview read.
        """
        school = self._get_school(school_id)
        if not school.support_access_enabled:
            raise HTTPException(
                status_code=403,
                detail="Support access is not enabled for this school. Enable it before impersonating.",
            )

        admin_user = self.db.query(models.User).join(models.Role).filter(
            models.User.school_id == school_id, models.Role.name == "school_admin",
        ).first()
        if not admin_user:
            raise SchoolManagementError("No School Admin account exists for this school")

        # Short-lived on purpose — this is a support tool, not a standing
        # credential. Reuses the exact token-creation function every
        # normal login already uses, just with a shorter lifetime and an
        # explicit impersonation flag baked into the token payload so
        # anything downstream CAN distinguish it if it ever needs to.
        token = create_access_token(
            data={
                "user_id": admin_user.id, "school_id": school_id, "role": admin_user.role.name,
                "impersonated_by_platform_admin_id": platform_admin_id,
            },
            expires_delta=timedelta(minutes=30),
        )

        self.db.add(models.AuditLog(
            platform_admin_id=platform_admin_id, school_id=school_id,
            action="school_impersonated", details=f"Impersonated {admin_user.email} for support",
        ))
        self.db.commit()

        return schemas.ImpersonateResponse(
            access_token=token, impersonating_user_email=admin_user.email, expires_in_minutes=30,
        )

    # ---------- Export ----------

    def export_schools_csv(self) -> str:
        schools = self.db.query(models.School).order_by(models.School.created_at.desc()).all()
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow([
            "ID", "Name", "Board", "City", "State", "Lifecycle Status",
            "Subscription Plan", "Subscription Status", "Health Score", "Created At",
        ])
        for s in schools:
            writer.writerow([
                s.id, s.name, s.board_type, s.city or "", s.state or "",
                s.lifecycle_status or "draft", s.subscription_plan, s.subscription_status,
                self.compute_health_score(s).score, s.created_at.isoformat(),
            ])
        return output.getvalue()

    # ---------- Internal ----------

    def _get_school(self, school_id: int) -> models.School:
        school = self.db.query(models.School).filter(models.School.id == school_id).first()
        if not school:
            raise HTTPException(status_code=404, detail="School not found")
        return school

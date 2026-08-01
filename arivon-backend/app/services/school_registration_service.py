"""
Orchestrates the School Registration wizard end-to-end: draft creation,
per-step updates, document uploads, review, and the final atomic
Create School chain.

This is the ONE new "business workflow" piece explicitly requested in
this task (the previous foundation task explicitly excluded workflow
logic — this is where it lives). Everything here composes the
repositories and services already built rather than reimplementing
their logic.
"""

import os
import uuid
from datetime import datetime, date, timedelta

from fastapi import HTTPException, UploadFile
from sqlalchemy.orm import Session

from app import models, schemas
from app.core.security import hash_password
from app.core.slug_utils import generate_unique_school_slug
from app.core.temp_password_utils import generate_temp_password, temp_password_expiry
from app.repositories.school_repository import SchoolRepository
from app.repositories.department_repository import DepartmentRepository
from app.repositories.organization_settings_repository import OrganizationSettingsRepository
from app.services.school_provisioning_service import SchoolProvisioningService
from app.services.school_lifecycle_service import SchoolLifecycleService, InvalidLifecycleTransitionError
from app.services.compliance_service import ComplianceService
from app.routers.academic_years import build_ladder_for_selected_stages
from app.enums import ComplianceStatus

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

VALID_STAGES = {"pre_primary", "primary", "middle", "secondary", "higher_secondary"}

# File upload validation — a real gap found during the production
# readiness review: uploads previously had no size limit and no type
# restriction at all. Compliance documents are legitimately PDFs or
# photos of certificates; nothing else has a reason to be uploaded here.
MAX_UPLOAD_SIZE_BYTES = 10 * 1024 * 1024  # 10MB
ALLOWED_UPLOAD_EXTENSIONS = {".pdf", ".jpg", ".jpeg", ".png"}

# What "ready to create" requires — mirrors the PRD's distinction between
# required and optional wizard steps (Steps 1-4, 6, 9 required;
# Branding/Infrastructure/Org Settings optional with graceful defaults).
REQUIRED_SECTIONS = ["identity", "government_recognition", "address_contact", "management", "classes_offered", "subscription"]


class SchoolRegistrationError(Exception):
    """Raised for any registration-flow error that should map to a 4xx
    response — kept distinct from unexpected 5xx-worthy exceptions."""
    pass


class SchoolRegistrationService:
    def __init__(self, db: Session):
        self.db = db
        self.school_repo = SchoolRepository(db)
        self.department_repo = DepartmentRepository(db)
        self.settings_repo = OrganizationSettingsRepository(db)
        self.provisioning = SchoolProvisioningService(db)
        self.lifecycle = SchoolLifecycleService(db)

    # ---------- Register School (creates the draft) ----------

    def register(self, payload: schemas.RegisterSchoolRequest) -> models.School:
        existing_admin_email = self.db.query(models.User).filter(
            models.User.email == payload.management.admin_email
        ).first()
        if existing_admin_email:
            raise SchoolRegistrationError("This admin email is already registered to another school")

        school = models.School(
            name=payload.identity.name,
            short_name=payload.identity.short_name,
            slug=generate_unique_school_slug(self.db, payload.identity.name, payload.identity.short_name),
            school_type=payload.identity.school_type.value,
            school_category=payload.identity.school_category.value,
            year_established=payload.identity.year_established,
            motto=payload.identity.motto,

            board_type=payload.government_recognition.board_type.value,
            state_board_name=payload.government_recognition.state_board_name,
            udise_code=payload.government_recognition.udise_code,
            affiliation_number=payload.government_recognition.affiliation_number,
            affiliation_valid_from=payload.government_recognition.affiliation_valid_from,
            affiliation_valid_to=payload.government_recognition.affiliation_valid_to,
            recognition_number=payload.government_recognition.recognition_number,
            trust_registration_number=payload.government_recognition.trust_registration_number,
            pan_number=payload.government_recognition.pan_number,
            gst_number=payload.government_recognition.gst_number,

            address=payload.address_contact.address,
            address_line_2=payload.address_contact.address_line_2,
            city=payload.address_contact.city,
            state=payload.address_contact.state,
            pincode=payload.address_contact.pincode,
            contact_phone=payload.address_contact.contact_phone,
            contact_email=payload.address_contact.contact_email,
            website_url=payload.address_contact.website_url,
            google_maps_url=payload.address_contact.google_maps_url,

            trust_name=payload.management.trust_name,
            chairman_name=payload.management.chairman_name,
            managing_director_name=payload.management.managing_director_name,
            pending_admin_full_name=payload.management.admin_full_name,
            pending_admin_email=payload.management.admin_email,

            lifecycle_status="draft",
            subscription_status="trial",
        )
        self.db.add(school)
        self.db.commit()
        self.db.refresh(school)
        return school

    # ---------- Resume Draft ----------

    def get_draft(self, school_id: int) -> models.School:
        school = self.school_repo.get_by_id(school_id)
        if not school:
            raise SchoolRegistrationError(f"Draft {school_id} not found")
        return school

    def list_drafts(self) -> list[models.School]:
        return self.school_repo.get_by_lifecycle_status("draft")

    # ---------- Update Draft (Steps 1-3, re-editable) ----------

    def update_draft(
        self,
        school_id: int,
        identity: schemas.SchoolIdentityUpdate | None = None,
        government_recognition: schemas.GovernmentRecognitionUpdate | None = None,
        address_contact: schemas.SchoolAddressContactUpdate | None = None,
    ) -> models.School:
        school = self._get_editable_draft(school_id)

        if identity:
            school.name = identity.name
            school.short_name = identity.short_name
            school.school_type = identity.school_type.value
            school.school_category = identity.school_category.value
            school.year_established = identity.year_established
            school.motto = identity.motto

        if government_recognition:
            school.board_type = government_recognition.board_type.value
            school.state_board_name = government_recognition.state_board_name
            school.udise_code = government_recognition.udise_code
            school.affiliation_number = government_recognition.affiliation_number
            school.affiliation_valid_from = government_recognition.affiliation_valid_from
            school.affiliation_valid_to = government_recognition.affiliation_valid_to
            school.recognition_number = government_recognition.recognition_number
            school.trust_registration_number = government_recognition.trust_registration_number
            school.pan_number = government_recognition.pan_number
            school.gst_number = government_recognition.gst_number

        if address_contact:
            school.address = address_contact.address
            school.address_line_2 = address_contact.address_line_2
            school.city = address_contact.city
            school.state = address_contact.state
            school.pincode = address_contact.pincode
            school.contact_phone = address_contact.contact_phone
            school.contact_email = address_contact.contact_email
            school.website_url = address_contact.website_url
            school.google_maps_url = address_contact.google_maps_url

        self.db.commit()
        self.db.refresh(school)
        return school

    def update_management_details(self, school_id: int, payload: schemas.ManagementDetailsUpdate) -> models.School:
        school = self._get_editable_draft(school_id)

        other_user = self.db.query(models.User).filter(
            models.User.email == payload.admin_email,
        ).first()
        if other_user:
            raise SchoolRegistrationError("This admin email is already registered to another school")

        school.trust_name = payload.trust_name
        school.chairman_name = payload.chairman_name
        school.managing_director_name = payload.managing_director_name
        school.pending_admin_full_name = payload.admin_full_name
        school.pending_admin_email = payload.admin_email
        self.db.commit()
        self.db.refresh(school)
        return school

    def update_classes_offered(self, school_id: int, payload: schemas.ClassesOfferedUpdate) -> models.School:
        school = self._get_editable_draft(school_id)
        school.selected_stages = ",".join(payload.stages)
        self.db.commit()
        self.db.refresh(school)
        return school

    def update_academic_config(self, school_id: int, payload: schemas.SchoolAcademicConfigUpdate) -> models.School:
        school = self._get_editable_draft(school_id)
        if payload.school_timing_start is not None:
            school.school_timing_start = payload.school_timing_start
        if payload.school_timing_end is not None:
            school.school_timing_end = payload.school_timing_end
        if payload.working_days is not None:
            school.working_days = ",".join(payload.working_days)
        if payload.medium_of_instruction is not None:
            school.medium_of_instruction = payload.medium_of_instruction.value
        if payload.grading_system is not None:
            school.grading_system = payload.grading_system.value
        if payload.attendance_min_percentage is not None:
            school.attendance_min_percentage = payload.attendance_min_percentage
        if payload.promotion_policy is not None:
            school.promotion_policy = payload.promotion_policy.value
        self.db.commit()
        self.db.refresh(school)
        return school

    def update_branding(self, school_id: int, payload: schemas.SchoolBrandingUpdate) -> models.School:
        school = self._get_editable_draft(school_id)
        for field, value in payload.model_dump(exclude_unset=True).items():
            setattr(school, field, value)
        self.db.commit()
        self.db.refresh(school)
        return school

    ASSET_FIELD_MAP = {
        "logo": "logo_url",
        "banner": "banner_url",
        "seal": "seal_url",
        "letterhead": "letterhead_url",
    }
    # A JPG has no transparency channel at all — uploading one as a seal
    # would silently flatten it onto a white or black square, defeating
    # the entire point of "transparent background". PNG-only for that
    # one; the others are more forgiving since they're rendered as
    # solid rectangles anyway.
    ASSET_ALLOWED_EXTENSIONS = {
        "logo": {".jpg", ".jpeg", ".png"},
        "banner": {".jpg", ".jpeg", ".png"},
        "seal": {".png"},
        "letterhead": {".pdf", ".png"},
    }

    async def upload_branding_asset(self, school_id: int, asset_type: str, file: UploadFile) -> models.School:
        """
        Actual file upload for logo/banner/seal/letterhead — replaces
        the old "paste a URL" fields. A school's official seal and
        letterhead in particular need to be the real file the school
        provided, not a link to wherever they happened to host it
        online (which breaks the moment that external host goes away,
        and doesn't work at all for a PDF letterhead).
        """
        school = self._get_editable_draft(school_id)

        if asset_type not in self.ASSET_FIELD_MAP:
            raise SchoolRegistrationError(f"Unknown asset type '{asset_type}'. Must be one of: {', '.join(self.ASSET_FIELD_MAP)}.")

        ext = os.path.splitext(file.filename)[1].lower()
        allowed_for_this_asset = self.ASSET_ALLOWED_EXTENSIONS[asset_type]
        if ext not in allowed_for_this_asset:
            raise SchoolRegistrationError(
                f"'{ext}' isn't allowed for {asset_type}. Use: {', '.join(sorted(allowed_for_this_asset))}."
            )

        contents = await file.read()
        if len(contents) > MAX_UPLOAD_SIZE_BYTES:
            raise SchoolRegistrationError(f"File is too large ({len(contents) / 1024 / 1024:.1f}MB). Maximum size is 10MB.")

        # Branding assets specifically need to be PUBLICLY visible — the
        # logo shows on the unauthenticated /{slug}/login page. Only
        # "uploads/photos" is actually mounted as a public static route
        # (see main.py) — the bare "uploads/" used for compliance
        # documents is not, since those are only ever fetched through an
        # authenticated download endpoint. Reuse the public directory
        # here, matching the same pattern the working School Profile
        # logo upload already uses.
        photos_dir = "uploads/photos"
        os.makedirs(photos_dir, exist_ok=True)
        stored_filename = f"{uuid.uuid4().hex}{ext}"
        stored_path = os.path.join(photos_dir, stored_filename)
        with open(stored_path, "wb") as f:
            f.write(contents)

        setattr(school, self.ASSET_FIELD_MAP[asset_type], f"/uploads/photos/{stored_filename}")
        self.db.commit()
        self.db.refresh(school)
        return school

    def update_organization_settings(
        self, school_id: int, payload: schemas.SchoolOrganizationSettingsUpdate
    ) -> models.SchoolOrganizationSettings:
        self._get_editable_draft(school_id)  # validates school exists and is editable
        existing = self.settings_repo.get_by_school(school_id)
        if existing:
            for field, value in payload.model_dump().items():
                setattr(existing, field, value)
            self.db.commit()
            self.db.refresh(existing)
            return existing

        settings = models.SchoolOrganizationSettings(school_id=school_id, **payload.model_dump())
        self.db.add(settings)
        self.db.commit()
        self.db.refresh(settings)
        return settings

    def update_infrastructure(
        self, school_id: int, payload: schemas.SchoolInfrastructureUpdate
    ) -> models.SchoolInfrastructure:
        """PRD Step 7 — entirely optional, informational snapshot. Not in
        REQUIRED_SECTIONS, so a school with no row here is still ready_to_create."""
        self._get_editable_draft(school_id)
        from app.repositories.infrastructure_repository import InfrastructureRepository
        infra_repo = InfrastructureRepository(self.db)

        existing = infra_repo.get_by_school(school_id)
        if existing:
            for field, value in payload.model_dump().items():
                setattr(existing, field, value)
            self.db.commit()
            self.db.refresh(existing)
            return existing

        infrastructure = models.SchoolInfrastructure(school_id=school_id, **payload.model_dump())
        self.db.add(infrastructure)
        self.db.commit()
        self.db.refresh(infrastructure)
        return infrastructure

    def update_subscription(self, school_id: int, payload: schemas.SchoolSubscriptionDetailsUpdate) -> models.School:
        school = self._get_editable_draft(school_id)
        school.subscription_plan = payload.subscription_plan
        school.billing_cycle = payload.billing_cycle.value
        school.pricing_model = payload.pricing_model.value
        school.contract_start_date = payload.contract_start_date
        school.contract_end_date = payload.contract_end_date
        school.trial_ends_at = payload.trial_ends_at
        self.db.commit()
        self.db.refresh(school)
        return school

    # ---------- Upload Documents ----------

    async def upload_document(
        self, school_id: int, document_type: str, issue_date: date | None,
        expiry_date: date | None, file: UploadFile, uploaded_by_user_id: int,
    ) -> models.Document:
        self._get_editable_draft(school_id)

        ext = os.path.splitext(file.filename)[1].lower()
        if ext not in ALLOWED_UPLOAD_EXTENSIONS:
            raise SchoolRegistrationError(
                f"'{ext}' is not an allowed file type. Upload a PDF, JPG, or PNG."
            )

        contents = await file.read()
        if len(contents) > MAX_UPLOAD_SIZE_BYTES:
            raise SchoolRegistrationError(
                f"File is too large ({len(contents) / 1024 / 1024:.1f}MB). Maximum size is 10MB."
            )

        stored_filename = f"{uuid.uuid4().hex}{ext}"
        stored_path = os.path.join(UPLOAD_DIR, stored_filename)

        with open(stored_path, "wb") as f:
            f.write(contents)

        document = models.Document(
            school_id=school_id,
            entity_type="school",
            entity_id=school_id,
            document_type=document_type,
            original_filename=file.filename,
            stored_filename=stored_filename,
            uploaded_by_user_id=uploaded_by_user_id,
            issue_date=issue_date,
            expiry_date=expiry_date,
        )
        self.db.add(document)
        self.db.commit()
        self.db.refresh(document)
        return document

    def get_documents(self, school_id: int) -> list[models.Document]:
        from app.repositories.document_repository import DocumentRepository
        return DocumentRepository(self.db).get_school_documents(school_id)

    def compute_compliance_status(self, expiry: date | None, today: date | None = None) -> ComplianceStatus:
        """Delegates to ComplianceService — this used to be a duplicated
        static method here; now there's exactly one place that knows how
        to compute compliance status."""
        return ComplianceService(self.db).compute_status(expiry, today)

    # ---------- Review ----------

    def get_review(self, school_id: int) -> dict:
        school = self.get_draft(school_id)
        documents = self.get_documents(school_id)

        sections = [
            schemas.SchoolReviewSection(
                section="identity", complete=bool(school.name and school.school_type),
                data={"name": school.name, "short_name": school.short_name, "school_type": school.school_type, "school_category": school.school_category},
            ),
            schemas.SchoolReviewSection(
                section="government_recognition", complete=bool(school.board_type and school.udise_code),
                data={"board_type": school.board_type, "udise_code": school.udise_code, "affiliation_number": school.affiliation_number},
            ),
            schemas.SchoolReviewSection(
                section="address_contact", complete=bool(school.city and school.state and school.contact_email),
                data={"city": school.city, "state": school.state, "contact_email": school.contact_email},
            ),
            schemas.SchoolReviewSection(
                section="management", complete=bool(school.pending_admin_email),
                data={"admin_full_name": school.pending_admin_full_name, "admin_email": school.pending_admin_email},
            ),
            schemas.SchoolReviewSection(
                section="classes_offered", complete=bool(school.selected_stages),
                data={"stages": school.selected_stages.split(",") if school.selected_stages else []},
            ),
            schemas.SchoolReviewSection(
                section="branding", complete=bool(school.logo_url or school.primary_color),
                data={"logo_url": school.logo_url, "primary_color": school.primary_color},
            ),
            schemas.SchoolReviewSection(
                section="subscription", complete=bool(school.subscription_plan and school.billing_cycle),
                data={"plan": school.subscription_plan, "billing_cycle": school.billing_cycle},
            ),
        ]

        blocking_issues = []
        for section in sections:
            if section.section in REQUIRED_SECTIONS and not section.complete:
                blocking_issues.append(f"'{section.section}' is required but incomplete")
        if not documents:
            blocking_issues.append("No documents uploaded — Affiliation Certificate is strongly recommended before verification")

        selected_stages = school.selected_stages.split(",") if school.selected_stages else []
        ladder = build_ladder_for_selected_stages(selected_stages) if selected_stages else []

        return {
            "draft_id": school.id,
            "lifecycle_status": school.lifecycle_status,
            "sections": sections,
            "documents": [
                schemas.DocumentUploadResultOut(
                    id=d.id, document_type=d.document_type, original_filename=d.original_filename,
                    issue_date=d.issue_date, expiry_date=d.expiry_date,
                    computed_status=self.compute_compliance_status(d.expiry_date),
                )
                for d in documents
            ],
            "classes_to_be_created": [name for name, _ in ladder],
            "ready_to_create": len(blocking_issues) == 0,
            "blocking_issues": blocking_issues,
        }

    # ---------- Create School (the atomic chain) ----------

    def create_school(self, school_id: int, payload: schemas.CreateSchoolRequest, platform_admin_id: int) -> dict:
        """
        Creates the School Admin login and moves the school into the
        Verification Queue. Deliberately lean — this used to also
        provision the academic session, classes, departments, templates,
        etc. right here, but that ran BEFORE any human had reviewed the
        school, which defeated the entire point of a Verification Queue
        (nothing would ever wait there for review). All of that now
        happens exactly once, atomically, when a Platform Admin Approves
        the school — see SchoolProvisioningService.provision_full_organization,
        called from VerificationService.approve.

        Any failure here still rolls back everything — no orphaned User
        with no School to belong to.
        """
        review = self.get_review(school_id)
        if not review["ready_to_create"]:
            raise SchoolRegistrationError(
                f"Cannot create school — blocking issues: {review['blocking_issues']}"
            )

        school = self.get_draft(school_id)
        if school.lifecycle_status != "draft":
            raise SchoolRegistrationError(
                f"School {school_id} is already '{school.lifecycle_status}', not a draft"
            )

        steps: list[schemas.ProvisioningStepResult] = []

        try:
            # --- Create School Admin (login only — no organization
            # provisioning yet; that waits for Approval) ---
            school_admin_role = self.db.query(models.Role).filter(models.Role.name == "school_admin").first()
            if not school_admin_role:
                raise SchoolRegistrationError("school_admin role not seeded — restart the server once")

            temp_password = generate_temp_password()
            expires_at = temp_password_expiry()

            admin_user = models.User(
                school_id=school.id,
                role_id=school_admin_role.id,
                full_name=school.pending_admin_full_name,
                email=school.pending_admin_email,
                hashed_password=hash_password(temp_password),
                must_change_password=True,
                temp_password_expires_at=expires_at,
            )
            self.db.add(admin_user)
            self.db.flush()
            steps.append(schemas.ProvisioningStepResult(step="create_school_admin", status="success"))

            # --- Move into the verification queue ---
            self.lifecycle.transition(school.id, "pending_verification", platform_admin_id=platform_admin_id)
            steps.append(schemas.ProvisioningStepResult(step="ready_for_verification", status="success"))

            # --- Audit log ---
            audit_entry = models.AuditLog(
                platform_admin_id=platform_admin_id,
                school_id=school.id,
                action="school_created_via_wizard",
                details=f"School '{school.name}' submitted for verification, admin {admin_user.email}",
            )
            self.db.add(audit_entry)

            self.db.commit()

        except Exception:
            self.db.rollback()
            raise

        self.db.refresh(school)
        return {
            "school_id": school.id,
            "school_name": school.name,
            "lifecycle_status": school.lifecycle_status,
            "admin_login_email": admin_user.email,
            "provisioning_steps": steps,
            "temporary_password": temp_password,
            "temp_password_expires_at": expires_at,
            "login_url_path": f"/{school.slug}/login" if school.slug else "/login",
        }

    # ---------- Internal helpers ----------

    def _get_editable_draft(self, school_id: int) -> models.School:
        school = self.get_draft(school_id)
        if school.lifecycle_status != "draft":
            raise SchoolRegistrationError(
                f"School {school_id} is '{school.lifecycle_status}' and can no longer be edited as a draft"
            )
        return school

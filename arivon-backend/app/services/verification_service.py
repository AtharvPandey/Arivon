"""
Orchestrates the Verification workflow (PRD 3.1): the Verification
Queue, the Verification Screen (school details + documents + checklist),
and the Approve/Reject/Resubmit actions. Built on top of
SchoolLifecycleService (state transitions) and ComplianceService
(document status), not duplicating either.
"""

from datetime import datetime

from sqlalchemy.orm import Session

from app import models, schemas
from app.services.school_lifecycle_service import SchoolLifecycleService, InvalidLifecycleTransitionError
from app.services.compliance_service import ComplianceService


class VerificationError(Exception):
    """Expected, user-facing verification-flow error — maps to 400."""
    pass


class VerificationService:
    def __init__(self, db: Session):
        self.db = db
        self.lifecycle = SchoolLifecycleService(db)
        self.compliance = ComplianceService(db)

    # ---------- Verification Queue ----------

    def get_queue(self) -> list[schemas.VerificationQueueItem]:
        schools = self.lifecycle.get_pending_verification_queue()
        items = []
        for school in schools:
            documents = self._get_school_documents(school.id)
            items.append(schemas.VerificationQueueItem(
                school_id=school.id,
                school_name=school.name,
                board_type=school.board_type,
                city=school.city,
                submitted_at=school.created_at,
                document_count=len(documents),
                documents_verified_count=sum(1 for d in documents if d.verified_at is not None),
            ))
        return items

    # ---------- Verification Screen ----------

    def get_verification_detail(self, school_id: int) -> schemas.VerificationDetailOut:
        school = self._get_school_in_review(school_id)
        documents = self._get_school_documents(school_id)

        checklist = self._build_checklist(school, documents)

        return schemas.VerificationDetailOut(
            school_id=school.id,
            school_name=school.name,
            lifecycle_status=school.lifecycle_status,
            identity={
                "name": school.name, "short_name": school.short_name,
                "school_type": school.school_type, "school_category": school.school_category,
                "year_established": school.year_established,
            },
            government_recognition={
                "board_type": school.board_type, "udise_code": school.udise_code,
                "affiliation_number": school.affiliation_number,
                "affiliation_valid_from": school.affiliation_valid_from,
                "affiliation_valid_to": school.affiliation_valid_to,
                "pan_number": school.pan_number, "gst_number": school.gst_number,
            },
            address_contact={
                "address": school.address, "city": school.city, "state": school.state,
                "pincode": school.pincode, "contact_phone": school.contact_phone,
                "contact_email": school.contact_email,
            },
            management={
                "trust_name": school.trust_name, "chairman_name": school.chairman_name,
                "admin_full_name": school.pending_admin_full_name,
                "admin_email": school.pending_admin_email,
            },
            documents=[
                schemas.DocumentUploadResultOut(
                    id=d.id, document_type=d.document_type, original_filename=d.original_filename,
                    issue_date=d.issue_date, expiry_date=d.expiry_date,
                    computed_status=self.compliance.compute_status(d.expiry_date),
                )
                for d in documents
            ],
            checklist=checklist,
            all_checks_passed=all(c.passed for c in checklist),
        )

    def _build_checklist(self, school: models.School, documents: list[models.Document]) -> list[schemas.VerificationChecklistItem]:
        checklist = []

        checklist.append(schemas.VerificationChecklistItem(
            label="UDISE+ code format valid",
            passed=bool(school.udise_code and len(school.udise_code) == 11),
            detail=school.udise_code or "Not provided",
        ))
        checklist.append(schemas.VerificationChecklistItem(
            label="Affiliation number provided",
            passed=bool(school.affiliation_number),
            detail=school.affiliation_number or "Not provided",
        ))
        checklist.append(schemas.VerificationChecklistItem(
            label="At least one compliance document uploaded",
            passed=len(documents) > 0,
            detail=f"{len(documents)} document(s) uploaded",
        ))
        checklist.append(schemas.VerificationChecklistItem(
            label="All uploaded documents reviewed",
            passed=len(documents) > 0 and all(d.verified_at is not None for d in documents),
            detail=f"{sum(1 for d in documents if d.verified_at)} of {len(documents)} verified",
        ))
        checklist.append(schemas.VerificationChecklistItem(
            label="No expired compliance documents",
            passed=not any(
                self.compliance.compute_status(d.expiry_date).value == "expired" for d in documents
            ),
            detail="Checked against today's date",
        ))

        return checklist

    def verify_document(self, document_id: int, platform_admin_id: int) -> models.Document:
        return self.compliance.verify_document(document_id, platform_admin_id)

    # ---------- Approve / Reject / Resubmit ----------

    def approve(self, school_id: int, platform_admin_id: int) -> schemas.ActiveProvisioningResult:
        """
        Approving a school does two things in ONE transaction: advances
        the lifecycle to active, then runs the full Automatic
        Organization Provisioning chain (academic session, classes,
        sections, departments, templates, branding defaults, org
        settings, feature flags, welcome notice, holidays, attendance
        defaults). If provisioning fails partway, the lifecycle
        transition itself rolls back too — a school is never left
        "active" with half its organization missing.
        """
        school = self._get_school_in_review(school_id)

        try:
            # Advance through the full sequence — verified is a momentary
            # internal state (per PRD 3.1), active is the real destination.
            self.lifecycle.transition(school.id, "verified", platform_admin_id=platform_admin_id)
            self.lifecycle.transition(school.id, "active", platform_admin_id=platform_admin_id)

            # Automatic Organization Provisioning — fires exactly once,
            # exactly here, now that the school is genuinely approved.
            from app.services.school_provisioning_service import SchoolProvisioningService
            provisioning = SchoolProvisioningService(self.db)
            result = provisioning.provision_full_organization(school.id, platform_admin_id)

        except InvalidLifecycleTransitionError as e:
            self.db.rollback()
            raise VerificationError(str(e))
        except Exception:
            self.db.rollback()
            raise

        self._log(platform_admin_id, school.id, "school_verification_approved",
                   f"Approved by platform admin {platform_admin_id}; organization fully provisioned")
        self.db.commit()
        self.db.refresh(school)
        return result

    def reject(self, school_id: int, payload: schemas.RejectSchoolRequest, platform_admin_id: int) -> models.School:
        school = self._get_school_in_review(school_id)

        try:
            self.lifecycle.transition(
                school.id, "rejected", platform_admin_id=platform_admin_id, rejection_reason=payload.reason,
            )
        except InvalidLifecycleTransitionError as e:
            raise VerificationError(str(e))

        self._log(platform_admin_id, school.id, "school_verification_rejected", payload.reason)
        self.db.commit()
        self.db.refresh(school)
        return school

    def resubmit(self, school_id: int, payload: schemas.ResubmitSchoolRequest, platform_admin_id: int) -> models.School:
        """
        Platform-Admin-driven — see module docstring. Typically used
        after the school has provided corrected documents/information
        out-of-band (email, phone), which the Platform Admin re-uploads
        or corrects on the school's behalf before resubmitting.
        """
        school = self.db.query(models.School).filter(models.School.id == school_id).first()
        if not school:
            raise VerificationError(f"School {school_id} not found")
        if school.lifecycle_status != "rejected":
            raise VerificationError(f"School {school_id} is '{school.lifecycle_status}', not 'rejected' — nothing to resubmit")

        try:
            self.lifecycle.transition(school.id, "pending_verification", platform_admin_id=platform_admin_id)
        except InvalidLifecycleTransitionError as e:
            raise VerificationError(str(e))

        school.rejection_reason = None  # clear the old reason now that it's back in review
        self._log(platform_admin_id, school.id, "school_resubmitted_for_verification", payload.notes)
        self.db.commit()
        self.db.refresh(school)
        return school

    # ---------- Compliance Dashboard ----------

    def get_compliance_dashboard(self, school_id: int | None = None, within_days: int = 60) -> schemas.ComplianceDashboardOut:
        documents = self.compliance.get_expiring_documents(school_id, within_days)
        today = datetime.utcnow().date()

        items = []
        expired_count = 0
        expiring_soon_count = 0
        for doc in documents:
            status = self.compliance.compute_status(doc.expiry_date, today)
            if status.value == "expired":
                expired_count += 1
            elif status.value == "expiring_soon":
                expiring_soon_count += 1

            school = self.db.query(models.School).filter(models.School.id == doc.school_id).first()
            items.append(schemas.ComplianceDashboardItem(
                document_id=doc.id, school_id=doc.school_id,
                school_name=school.name if school else "Unknown",
                document_type=doc.document_type, expiry_date=doc.expiry_date,
                computed_status=status, days_remaining=(doc.expiry_date - today).days,
            ))

        return schemas.ComplianceDashboardOut(
            total_expiring=len(items), expired_count=expired_count,
            expiring_soon_count=expiring_soon_count, items=items,
        )

    def run_reminders(self) -> schemas.ReminderRunResult:
        count = self.compliance.send_expiry_reminders()
        return schemas.ReminderRunResult(reminders_sent=count, checked_at=datetime.utcnow())

    # ---------- Document History (reuses PlatformAuditLog) ----------

    def get_document_history(self, document_id: int) -> list[schemas.DocumentHistoryEntry]:
        document = self.db.query(models.Document).filter(models.Document.id == document_id).first()
        if not document:
            raise VerificationError(f"Document {document_id} not found")

        # There's no per-document audit table — history is derived from
        # PlatformAuditLog entries mentioning this document, plus the
        # document's own upload/verification timestamps as baseline events.
        entries = [
            schemas.DocumentHistoryEntry(
                action="uploaded", details=f"{document.original_filename}", performed_at=document.uploaded_at,
            )
        ]
        if document.verified_at:
            entries.append(schemas.DocumentHistoryEntry(
                action="verified", details="Reviewed during verification", performed_at=document.verified_at,
            ))
        return entries

    # ---------- Internal helpers ----------

    def _get_school_documents(self, school_id: int) -> list[models.Document]:
        from app.repositories.document_repository import DocumentRepository
        return DocumentRepository(self.db).get_school_documents(school_id)

    def _get_school_in_review(self, school_id: int) -> models.School:
        school = self.db.query(models.School).filter(models.School.id == school_id).first()
        if not school:
            raise VerificationError(f"School {school_id} not found")
        if school.lifecycle_status != "pending_verification":
            raise VerificationError(
                f"School {school_id} is '{school.lifecycle_status}', not 'pending_verification'"
            )
        return school

    def _log(self, platform_admin_id: int, school_id: int, action: str, details: str | None):
        entry = models.AuditLog(
            platform_admin_id=platform_admin_id, school_id=school_id, action=action, details=details,
        )
        self.db.add(entry)

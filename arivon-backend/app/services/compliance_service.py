"""
Service interface for compliance document expiry tracking (PRD 3.3).
"""

from abc import ABC, abstractmethod
from datetime import date, datetime, timedelta

from sqlalchemy.orm import Session

from app import models
from app.enums import ComplianceStatus


class ComplianceServiceInterface(ABC):

    @abstractmethod
    def compute_status(self, expiry_date: date | None, today: date | None = None) -> ComplianceStatus:
        """
        Pure function: given a document's expiry_date (or None),
        returns NO_EXPIRY / VALID / EXPIRING_SOON (within 60 days) /
        EXPIRED. Never stored — always computed at read time, so a
        document's status is always accurate without a background job
        needing to "flip" a stored flag at exactly midnight.
        """
        raise NotImplementedError

    @abstractmethod
    def get_expiring_documents(self, school_id: int | None = None, within_days: int = 60) -> list[models.Document]:
        """
        Documents expiring within the window, optionally scoped to one
        school (Platform Admin's cross-school compliance dashboard
        passes school_id=None; a School Admin's own view passes theirs).
        """
        raise NotImplementedError

    @abstractmethod
    def send_expiry_reminders(self) -> int:
        """
        Intended to run as a scheduled background job (daily). For each
        expiring document, checks the 60/30/7-day thresholds against
        the reminder_60_day_sent/reminder_30_day_sent/reminder_7_day_sent
        flags on Document, sends the appropriate email if not already
        sent, and marks the flag. Returns the count of reminders sent.
        """
        raise NotImplementedError

    @abstractmethod
    def verify_document(self, document_id: int, verified_by_platform_admin_id: int) -> models.Document:
        """Marks a document as reviewed during the school verification
        workflow (PRD 3.1's review screen checklist). Platform Admin,
        not a school User — see models.Document's two separate verifier
        fields and the comment explaining why."""
        raise NotImplementedError


# =========================================================================
# Concrete implementation.
# =========================================================================

class ComplianceService(ComplianceServiceInterface):
    def __init__(self, db: Session):
        self.db = db

    def compute_status(self, expiry_date: date | None, today: date | None = None) -> ComplianceStatus:
        if expiry_date is None:
            return ComplianceStatus.NO_EXPIRY
        today = today or date.today()
        if expiry_date < today:
            return ComplianceStatus.EXPIRED
        if expiry_date <= today + timedelta(days=60):
            return ComplianceStatus.EXPIRING_SOON
        return ComplianceStatus.VALID

    def get_expiring_documents(self, school_id: int | None = None, within_days: int = 60) -> list[models.Document]:
        query = self.db.query(models.Document).filter(
            models.Document.entity_type == "school",
            models.Document.expiry_date.isnot(None),
            models.Document.expiry_date <= date.today() + timedelta(days=within_days),
        )
        if school_id is not None:
            query = query.filter(models.Document.school_id == school_id)
        return query.order_by(models.Document.expiry_date).all()

    def send_expiry_reminders(self) -> int:
        """
        Intended to run as a daily scheduled job in production (e.g. a
        cron-triggered call to this method, or a Celery/APScheduler task
        — no scheduler infrastructure exists in Arivon yet, so this is
        exposed as a manually-triggerable Platform Admin action instead).

        Reuses the exact "dry run" convention already established in
        app/core/notifications.py for WhatsApp — no email-sending
        infrastructure exists yet either, so reminders are logged, not
        actually sent, until that's built. The 60/30/7-day thresholds
        and the sent-flags are real and functional; only the delivery
        mechanism is a placeholder.
        """
        today = date.today()
        sent_count = 0

        all_expiring = self.db.query(models.Document).filter(
            models.Document.entity_type == "school",
            models.Document.expiry_date.isnot(None),
            models.Document.expiry_date >= today,  # not yet expired
            models.Document.expiry_date <= today + timedelta(days=60),
        ).all()

        for doc in all_expiring:
            days_remaining = (doc.expiry_date - today).days
            school = self.db.query(models.School).filter(models.School.id == doc.school_id).first()

            if days_remaining <= 7 and not doc.reminder_7_day_sent:
                self._send_reminder(school, doc, days_remaining)
                doc.reminder_7_day_sent = True
                sent_count += 1
            elif days_remaining <= 30 and not doc.reminder_30_day_sent:
                self._send_reminder(school, doc, days_remaining)
                doc.reminder_30_day_sent = True
                sent_count += 1
            elif days_remaining <= 60 and not doc.reminder_60_day_sent:
                self._send_reminder(school, doc, days_remaining)
                doc.reminder_60_day_sent = True
                sent_count += 1

        self.db.commit()
        return sent_count

    def _send_reminder(self, school: models.School, document: models.Document, days_remaining: int):
        # Dry-run — see docstring above. Once real email sending exists,
        # this is the one place that needs to change.
        print(
            f"[COMPLIANCE REMINDER — DRY RUN] To {school.contact_email or school.name}: "
            f"Your {document.document_type.replace('_', ' ')} expires in {days_remaining} day(s) "
            f"(on {document.expiry_date}). Please renew and re-upload before it lapses."
        )

    def verify_document(self, document_id: int, verified_by_platform_admin_id: int) -> models.Document:
        document = self.db.query(models.Document).filter(models.Document.id == document_id).first()
        if not document:
            raise ValueError(f"Document {document_id} not found")
        document.verified_by_platform_admin_id = verified_by_platform_admin_id
        document.verified_at = datetime.utcnow()
        self.db.commit()
        self.db.refresh(document)
        return document

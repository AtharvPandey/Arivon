"""
Service interface owning the School Lifecycle & Verification state
machine (PRD 3.1). See app/enums.py:SchoolLifecycleStatus for the full
state list and app/models.py:School for the fields this operates on
(lifecycle_status, verified_by_platform_admin_id, verified_at,
rejection_reason).
"""

from abc import ABC, abstractmethod
from datetime import datetime

from sqlalchemy.orm import Session

from app import models


# The allowed-transitions table this interface's implementation must
# enforce — defined here (not buried in a future implementation file)
# so the state machine is reviewable as part of the foundation itself.
ALLOWED_LIFECYCLE_TRANSITIONS: dict[str, set[str]] = {
    "draft": {"pending_verification"},
    "pending_verification": {"verified", "rejected"},
    "verified": {"active"},  # momentary internal state, auto-advances
    "active": {"suspended", "closed"},
    "rejected": {"pending_verification"},  # resubmission after fixing documents
    "suspended": {"active", "closed"},
    "closed": set(),  # terminal
}


class SchoolLifecycleServiceInterface(ABC):

    @abstractmethod
    def transition(
        self,
        school_id: int,
        new_status: str,
        platform_admin_id: int | None = None,
        rejection_reason: str | None = None,
    ) -> models.School:
        """
        Validates the requested transition against
        ALLOWED_LIFECYCLE_TRANSITIONS and raises if it isn't permitted
        from the school's current state. On success:
          - Updates School.lifecycle_status
          - Sets verified_by_platform_admin_id + verified_at when
            transitioning to "verified"
          - Requires and stores rejection_reason when transitioning to
            "rejected" (should raise if reason is missing)
          - Triggers a notification (email) to the School Admin —
            actual notification sending is a separate concern (see
            app/core/notifications.py's existing WhatsApp pattern for
            the established convention to follow)
        """
        raise NotImplementedError

    @abstractmethod
    def get_pending_verification_queue(self) -> list[models.School]:
        """Every school currently in `pending_verification` status, for the
        Platform Admin's verification review screen."""
        raise NotImplementedError

    @abstractmethod
    def can_login(self, school_id: int) -> bool:
        """
        Whether staff at this school should be allowed to authenticate
        at all. Per PRD 3.1: True only for "active" (and arguably
        "verified", as a momentary pass-through state); False for
        "draft", "pending_verification", "rejected", "suspended",
        "closed". This is the enforcement point a future auth
        dependency would call — not implemented here, but this is the
        exact question that dependency needs answered.
        """
        raise NotImplementedError


# =========================================================================
# Concrete implementation.
# =========================================================================

class InvalidLifecycleTransitionError(Exception):
    """Raised when a transition isn't allowed from the school's current state."""
    pass


class SchoolLifecycleService(SchoolLifecycleServiceInterface):
    def __init__(self, db: Session):
        self.db = db

    def transition(
        self,
        school_id: int,
        new_status: str,
        platform_admin_id: int | None = None,
        rejection_reason: str | None = None,
    ) -> models.School:
        school = self.db.query(models.School).filter(models.School.id == school_id).first()
        if not school:
            raise ValueError(f"School {school_id} not found")

        current = school.lifecycle_status or "draft"
        allowed_next = ALLOWED_LIFECYCLE_TRANSITIONS.get(current, set())
        if new_status not in allowed_next:
            raise InvalidLifecycleTransitionError(
                f"Cannot move from '{current}' to '{new_status}'. "
                f"Allowed next steps: {sorted(allowed_next) or 'none — this is a final status'}"
            )

        if new_status == "rejected" and not rejection_reason:
            raise ValueError("rejection_reason is required when transitioning to 'rejected'")

        school.lifecycle_status = new_status
        if new_status == "verified":
            school.verified_by_platform_admin_id = platform_admin_id
            school.verified_at = datetime.utcnow()
        if new_status == "rejected":
            school.rejection_reason = rejection_reason
        if new_status == "active":
            school.is_active = True  # keep the legacy boolean in sync, per its documented "derived" role
        if new_status in ("suspended", "closed"):
            school.is_active = False

        self.db.flush()
        return school

    def get_pending_verification_queue(self) -> list[models.School]:
        return self.db.query(models.School).filter(
            models.School.lifecycle_status == "pending_verification"
        ).all()

    def can_login(self, school_id: int) -> bool:
        school = self.db.query(models.School).filter(models.School.id == school_id).first()
        if not school:
            return False
        return school.lifecycle_status in ("active", "verified")

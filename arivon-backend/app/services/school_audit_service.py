"""
Service interface for the school-level audit trail (PRD 3.5). Parallel
in spirit to the existing PlatformAuditLog pattern already used in
app/routers/platform.py, but for actions taken INSIDE a school rather
than actions Platform Admin takes on schools.
"""

from abc import ABC, abstractmethod

from app import models
from app.enums import SchoolAuditActionType


class SchoolAuditServiceInterface(ABC):

    @abstractmethod
    def log(
        self,
        school_id: int,
        actor_user_id: int,
        action_type: SchoolAuditActionType,
        entity_type: str | None = None,
        entity_id: int | None = None,
        before: dict | None = None,
        after: dict | None = None,
        ip_address: str | None = None,
    ) -> models.SchoolAuditLog:
        """
        Records one audit entry. `before`/`after` are plain dicts here;
        the implementation is responsible for JSON-serializing them into
        SchoolAuditLog.before_snapshot/after_snapshot. Call sites for
        this (future work, not part of this foundation piece) are each
        of the actions listed in PRD 3.5 — fee waivers, marks edits,
        staff deactivation, etc. — wired in at the point those features
        are themselves built or revisited.
        """
        raise NotImplementedError

    @abstractmethod
    def get_school_trail(self, school_id: int, limit: int = 100) -> list[models.SchoolAuditLog]:
        """Full audit trail for one school, most recent first — powers
        the School Admin/Principal-facing audit log view."""
        raise NotImplementedError

    @abstractmethod
    def get_entity_history(self, entity_type: str, entity_id: int) -> list[models.SchoolAuditLog]:
        """Every audit entry for one specific record, e.g. the full edit
        history of a single invoice."""
        raise NotImplementedError

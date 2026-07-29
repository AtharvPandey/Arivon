"""
Repository for the School entity itself. Extends BaseRepository with
queries specific to the Register School PRD — particularly lifecycle
state lookups, which the (not-yet-built) verification workflow service
will depend on heavily.
"""

from sqlalchemy.orm import Session

from app import models
from app.repositories.base import BaseRepository


class SchoolRepository(BaseRepository[models.School]):
    def __init__(self, db: Session):
        super().__init__(models.School, db)

    def get_by_lifecycle_status(self, status: str) -> list[models.School]:
        """e.g. every school currently awaiting Platform Admin review."""
        return self.db.query(models.School).filter(
            models.School.lifecycle_status == status
        ).all()

    def get_expiring_affiliations(self, within_days: int = 60):
        """
        Schools whose board affiliation expires within the given window —
        feeds the compliance reminder mechanism (PRD 3.3). Returns raw
        School rows; the caller computes exact day-counts and reminder
        thresholds (60/30/7 day cadence lives in the service layer, not
        the repository).
        """
        from datetime import date, timedelta
        cutoff = date.today() + timedelta(days=within_days)
        return self.db.query(models.School).filter(
            models.School.affiliation_valid_to.isnot(None),
            models.School.affiliation_valid_to <= cutoff,
        ).all()

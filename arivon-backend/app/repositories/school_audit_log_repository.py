from sqlalchemy.orm import Session

from app import models
from app.repositories.base import BaseRepository


class SchoolAuditLogRepository(BaseRepository[models.SchoolAuditLog]):
    def __init__(self, db: Session):
        super().__init__(models.SchoolAuditLog, db)

    def get_by_school(self, school_id: int, limit: int = 100) -> list[models.SchoolAuditLog]:
        return self.db.query(models.SchoolAuditLog).filter(
            models.SchoolAuditLog.school_id == school_id
        ).order_by(models.SchoolAuditLog.created_at.desc()).limit(limit).all()

    def get_by_entity(self, entity_type: str, entity_id: int) -> list[models.SchoolAuditLog]:
        """Full history for one specific record, e.g. every audit entry for invoice #1042."""
        return self.db.query(models.SchoolAuditLog).filter(
            models.SchoolAuditLog.entity_type == entity_type,
            models.SchoolAuditLog.entity_id == entity_id,
        ).order_by(models.SchoolAuditLog.created_at.desc()).all()

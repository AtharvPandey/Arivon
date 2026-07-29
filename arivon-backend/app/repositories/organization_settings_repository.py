from sqlalchemy.orm import Session

from app import models
from app.repositories.base import BaseRepository


class OrganizationSettingsRepository(BaseRepository[models.SchoolOrganizationSettings]):
    def __init__(self, db: Session):
        super().__init__(models.SchoolOrganizationSettings, db)

    def get_by_school(self, school_id: int) -> models.SchoolOrganizationSettings | None:
        return self.db.query(models.SchoolOrganizationSettings).filter(
            models.SchoolOrganizationSettings.school_id == school_id
        ).first()

from sqlalchemy.orm import Session

from app import models
from app.repositories.base import BaseRepository


class InfrastructureRepository(BaseRepository[models.SchoolInfrastructure]):
    def __init__(self, db: Session):
        super().__init__(models.SchoolInfrastructure, db)

    def get_by_school(self, school_id: int) -> models.SchoolInfrastructure | None:
        return self.db.query(models.SchoolInfrastructure).filter(
            models.SchoolInfrastructure.school_id == school_id
        ).first()

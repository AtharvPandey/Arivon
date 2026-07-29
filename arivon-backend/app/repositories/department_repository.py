from sqlalchemy.orm import Session

from app import models
from app.repositories.base import BaseRepository


class DepartmentRepository(BaseRepository[models.Department]):
    def __init__(self, db: Session):
        super().__init__(models.Department, db)

    def get_by_school(self, school_id: int) -> list[models.Department]:
        return self.db.query(models.Department).filter(
            models.Department.school_id == school_id
        ).all()

    def get_by_name(self, school_id: int, name: str) -> models.Department | None:
        return self.db.query(models.Department).filter(
            models.Department.school_id == school_id,
            models.Department.name == name,
        ).first()

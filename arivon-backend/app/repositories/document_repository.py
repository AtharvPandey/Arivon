from sqlalchemy.orm import Session

from app import models
from app.repositories.base import BaseRepository


class DocumentRepository(BaseRepository[models.Document]):
    """
    Extracted during the production readiness review — the "get a
    school's compliance documents" query was independently duplicated in
    both SchoolRegistrationService and VerificationService. One
    definition now, used by both.
    """
    def __init__(self, db: Session):
        super().__init__(models.Document, db)

    def get_school_documents(self, school_id: int) -> list[models.Document]:
        return self.db.query(models.Document).filter(
            models.Document.entity_type == "school",
            models.Document.entity_id == school_id,
        ).all()

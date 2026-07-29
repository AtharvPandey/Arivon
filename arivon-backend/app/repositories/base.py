"""
Generic base repository — the data-access layer sitting between routers
and raw SQLAlchemy queries.

This is a NEW pattern in Arivon's codebase. Every router built so far
calls `db.query(...)` directly, which has been fine while each router
owns one clear concern. It stops being fine here: School Lifecycle,
Verification, and Compliance logic all need to read/write the School
entity and its related tables from MULTIPLE places (a future
registration wizard API, a verification review API, a compliance
reminder background job) — without a repository layer, that query
logic would get copy-pasted across all of them. This layer exists so
there is exactly one place that knows how to fetch/persist each entity.

Existing routers are NOT being refactored to use this — that would be
a large, risky change unrelated to this PRD. This layer is additive,
for the new School Registration domain going forward.
"""

from typing import Generic, TypeVar, Type
from sqlalchemy.orm import Session

ModelType = TypeVar("ModelType")


class BaseRepository(Generic[ModelType]):
    def __init__(self, model: Type[ModelType], db: Session):
        self.model = model
        self.db = db

    def get_by_id(self, id: int) -> ModelType | None:
        return self.db.query(self.model).filter(self.model.id == id).first()

    def list_all(self, **filters) -> list[ModelType]:
        query = self.db.query(self.model)
        for field, value in filters.items():
            query = query.filter(getattr(self.model, field) == value)
        return query.all()

    def create(self, **fields) -> ModelType:
        instance = self.model(**fields)
        self.db.add(instance)
        self.db.commit()
        self.db.refresh(instance)
        return instance

    def update(self, instance: ModelType, **fields) -> ModelType:
        for key, value in fields.items():
            setattr(instance, key, value)
        self.db.commit()
        self.db.refresh(instance)
        return instance

    def delete(self, instance: ModelType) -> None:
        self.db.delete(instance)
        self.db.commit()

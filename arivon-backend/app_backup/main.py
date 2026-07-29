"""
The entry point. This is what `uvicorn app.main:app` runs.
"""

from fastapi import FastAPI
from sqlalchemy.orm import Session

from app.database import Base, engine, SessionLocal
from app import models
from app.routers import auth, schools

app = FastAPI(
    title="Arivon API",
    description="School Operating System — core API",
    version="0.1.0",
)

app.include_router(auth.router)
app.include_router(schools.router)


@app.on_event("startup")
def on_startup():
    # Creates all tables if they don't already exist. Fine for now —
    # once the schema stabilizes, we'll switch to Alembic migrations
    # so schema changes are tracked and reversible instead of implicit.
    Base.metadata.create_all(bind=engine)
    seed_roles()


def seed_roles():
    """
    Make sure the basic roles always exist. Without this, /auth/register
    would fail the first time because there'd be no Role rows to look up.
    """
    db: Session = SessionLocal()
    try:
        default_roles = [
            ("super_admin", "Platform-level administrator"),
            ("principal", "School principal"),
            ("vice_principal", "Vice principal"),
            ("administrator", "School administrator"),
            ("teacher", "Teaching staff"),
            ("accountant", "Handles fees and finance"),
            ("receptionist", "Front office"),
        ]
        for name, description in default_roles:
            exists = db.query(models.Role).filter(models.Role.name == name).first()
            if not exists:
                db.add(models.Role(name=name, description=description))
        db.commit()
    finally:
        db.close()


@app.get("/health", tags=["health"])
def health_check():
    return {"status": "ok", "service": "arivon-api"}

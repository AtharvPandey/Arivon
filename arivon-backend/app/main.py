"""
The entry point. This is what `uvicorn app.main:app` runs.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from app.database import Base, engine, SessionLocal
from app import models
from app.routers import auth, schools, academic_years, classes, students, staff, attendance, staff_attendance, dashboard, fees, announcements, guardians, admissions, documents, academics, platform_auth, platform, roles, events, houses, school_registration, verification, school_management, morning_briefing, complaints, substitutions, leave, homework, syllabus, exams, communication, transport, certificates, salary, reports

app = FastAPI(
    title="Arivon API",
    description="School Operating System — core API",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Deliberately a SEPARATE, unauthenticated static mount — used ONLY for
# student profile photos. Everything else uploaded (birth certificates,
# Aadhaar, transfer certificates, compliance documents) stays behind the
# authenticated /documents/{id}/download endpoint; a profile photo is
# low-sensitivity enough to need plain <img src> compatibility across
# the UI (avatar in the directory list, profile card, future ID cards)
# without every image tag needing an Authorization header.
import os
from fastapi.staticfiles import StaticFiles
os.makedirs("uploads/photos", exist_ok=True)
app.mount("/uploads/photos", StaticFiles(directory="uploads/photos"), name="photos")

app.include_router(auth.router)
app.include_router(schools.router)
app.include_router(academic_years.router)
app.include_router(classes.router)
app.include_router(students.router)
app.include_router(staff.router)
app.include_router(attendance.router)
app.include_router(staff_attendance.router)
app.include_router(dashboard.router)
app.include_router(fees.router)
app.include_router(announcements.router)
app.include_router(guardians.router)
app.include_router(admissions.router)
app.include_router(documents.router)
app.include_router(academics.router)
app.include_router(platform_auth.router)
app.include_router(platform.router)
app.include_router(roles.router)
app.include_router(houses.router)
app.include_router(school_registration.router)
app.include_router(verification.router)
app.include_router(verification.compliance_router)
app.include_router(school_management.router)
app.include_router(morning_briefing.router)
app.include_router(complaints.router)
app.include_router(substitutions.router)
app.include_router(leave.router)
app.include_router(homework.router)
app.include_router(syllabus.router)
app.include_router(exams.router)
app.include_router(communication.router)
app.include_router(transport.router)
app.include_router(certificates.router)
app.include_router(salary.router)
app.include_router(reports.router)
app.include_router(events.router)


@app.on_event("startup")
def on_startup():
    # Table creation is now handled by Alembic migrations (run
    # `alembic upgrade head` before starting the app), NOT by
    # Base.metadata.create_all() — that approach silently can't handle
    # adding new tables/columns to an existing database without data loss.
    seed_roles()


def seed_roles():
    """
    Make sure the basic roles always exist. Without this, /auth/register
    would fail the first time because there'd be no Role rows to look up.
    """
    db: Session = SessionLocal()
    try:
        default_roles = [
            ("school_admin", "School owner/administrator — the sole top authority within a school's own hierarchy"),
            ("principal", "School principal"),
            ("vice_principal", "Vice principal"),
            ("administrator", "General school administrator"),
            ("teacher", "Teaching staff"),
            ("accountant", "Handles fees and finance"),
            ("receptionist", "Front office"),
            ("admissions_officer", "Handles admission applications and enrollment"),
            ("academic_coordinator", "Manages subjects, class structure, and timetable"),
            ("librarian", "Manages library — role seeded now, module coming in a future sprint"),
            ("transport_manager", "Manages transport — role seeded now, module coming in a future sprint"),
            ("driver", "Bus/vehicle driver"),
            ("support_staff", "Non-teaching support staff — cleaners, peons, security, and similar roles"),
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

"""
Certificates & ID Cards. Transfer Certificate already lived in
students.py (tied tightly to the re-admission/leaving workflow); every
other certificate type lives here instead, since they're all
independent, repeatable requests rather than part of a student
lifecycle event — a Bonafide Certificate can be generated any number of
times for any reason, unlike a TC which is a one-time leaving event.
"""

from datetime import date as date_type

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app import models, schemas
from app.core.deps import get_current_user, require_roles
from app.core.certificates import (
    generate_text_certificate_pdf, generate_achievement_certificate_pdf,
    generate_student_id_card_pdf, generate_staff_id_card_pdf, _generate_number,
)

CERTIFICATE_ROLES = ("school_admin", "administrator", "principal", "vice_principal", "academic_coordinator", "super_admin")

router = APIRouter(tags=["certificates"])


def _get_student_context(db: Session, student_id: int):
    student = db.query(models.Student).filter(models.Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    school = db.query(models.School).filter(models.School.id == student.school_id).first()
    section = db.query(models.Section).filter(models.Section.id == student.section_id).first() if student.section_id else None
    school_class = db.query(models.SchoolClass).filter(models.SchoolClass.id == section.school_class_id).first() if section else None
    return student, school, section, school_class


def _store_document(db: Session, student, current_user, document_type: str, stored_filename: str, label: str) -> models.Document:
    document = models.Document(
        school_id=student.school_id, entity_type="student", entity_id=student.id,
        document_type=document_type, original_filename=f"{label}_{student.full_name.replace(' ', '_')}.pdf",
        stored_filename=stored_filename, uploaded_by_user_id=current_user.id,
    )
    db.add(document)
    db.commit()
    db.refresh(document)
    return document


# ---------- Character / Bonafide / Study / Migration Certificates ----------

@router.post(
    "/students/{student_id}/character-certificate", response_model=schemas.CertificateGenerateResponse,
    dependencies=[Depends(require_roles(*CERTIFICATE_ROLES))],
)
def generate_character_certificate(student_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    student, school, section, school_class = _get_student_context(db, student_id)
    class_label = f"{school_class.name} - {section.name}" if school_class and section else "—"
    number = _generate_number("CHAR")

    body = [
        f"This is to certify that <b>{student.full_name}</b>, {'son' if student.gender == 'Male' else 'daughter' if student.gender == 'Female' else 'child'} of "
        f"{student.father_name or student.guardian_name}, Admission Number <b>{student.admission_number}</b>, is/was a student of this "
        f"school, studying in Class {class_label} during the academic session.",
        "During the period of study at this institution, his/her conduct and moral character have been found to be good.",
        "This certificate is issued on request for whatever purpose it may serve.",
    ]
    stored_filename = generate_text_certificate_pdf(student, school, "Character Certificate", body, number)
    document = _store_document(db, student, current_user, "character_certificate", stored_filename, "CharacterCertificate")
    return schemas.CertificateGenerateResponse(document_id=document.id, download_url=f"/documents/{document.id}/download")


@router.post(
    "/students/{student_id}/bonafide-certificate", response_model=schemas.CertificateGenerateResponse,
    dependencies=[Depends(require_roles(*CERTIFICATE_ROLES))],
)
def generate_bonafide_certificate(student_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    student, school, section, school_class = _get_student_context(db, student_id)
    class_label = f"{school_class.name} - {section.name}" if school_class and section else "—"
    number = _generate_number("BONA")

    body = [
        f"This is to certify that <b>{student.full_name}</b>, Admission Number <b>{student.admission_number}</b>, "
        f"is a bonafide student of this school, currently studying in Class {class_label}.",
        f"Date of Birth as per school records: {student.date_of_birth.strftime('%d-%m-%Y') if student.date_of_birth else '—'}.",
        "This certificate is issued on request for whatever purpose it may serve.",
    ]
    stored_filename = generate_text_certificate_pdf(student, school, "Bonafide Certificate", body, number)
    document = _store_document(db, student, current_user, "bonafide_certificate", stored_filename, "BonafideCertificate")
    return schemas.CertificateGenerateResponse(document_id=document.id, download_url=f"/documents/{document.id}/download")


@router.post(
    "/students/{student_id}/study-certificate", response_model=schemas.CertificateGenerateResponse,
    dependencies=[Depends(require_roles(*CERTIFICATE_ROLES))],
)
def generate_study_certificate(student_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    student, school, section, school_class = _get_student_context(db, student_id)
    class_label = f"{school_class.name} - {section.name}" if school_class and section else "—"
    number = _generate_number("STUDY")

    body = [
        f"This is to certify that <b>{student.full_name}</b>, Admission Number <b>{student.admission_number}</b>, "
        f"has been studying / has studied at this school, and is presently in Class {class_label}.",
        "This Study Certificate is issued on request for whatever purpose it may serve, including admission to another institution.",
    ]
    stored_filename = generate_text_certificate_pdf(student, school, "Study Certificate", body, number)
    document = _store_document(db, student, current_user, "study_certificate", stored_filename, "StudyCertificate")
    return schemas.CertificateGenerateResponse(document_id=document.id, download_url=f"/documents/{document.id}/download")


@router.post(
    "/students/{student_id}/migration-certificate", response_model=schemas.CertificateGenerateResponse,
    dependencies=[Depends(require_roles(*CERTIFICATE_ROLES))],
)
def generate_migration_certificate(student_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    student, school, section, school_class = _get_student_context(db, student_id)
    class_label = f"{school_class.name} - {section.name}" if school_class and section else "—"
    number = _generate_number("MIG")

    body = [
        f"This is to certify that <b>{student.full_name}</b>, Admission Number <b>{student.admission_number}</b>, "
        f"was a student of this school, last studying in Class {class_label}.",
        "He/She is hereby granted this Migration Certificate and is eligible to seek admission to any other recognized "
        "educational institution or board.",
        "No objection is raised by this institution to the said migration.",
    ]
    stored_filename = generate_text_certificate_pdf(student, school, "Migration Certificate", body, number)
    document = _store_document(db, student, current_user, "migration_certificate", stored_filename, "MigrationCertificate")
    return schemas.CertificateGenerateResponse(document_id=document.id, download_url=f"/documents/{document.id}/download")


# ---------- Achievement Certificates ----------

@router.post("/students/{student_id}/achievements", response_model=schemas.AchievementOut, status_code=201)
def create_achievement(student_id: int, payload: schemas.AchievementCreate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    student = db.query(models.Student).filter(models.Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    achievement = models.AchievementRecord(student_id=student_id, issued_by_user_id=current_user.id, **payload.model_dump())
    db.add(achievement)
    db.commit()
    db.refresh(achievement)
    return achievement


@router.get("/students/{student_id}/achievements", response_model=list[schemas.AchievementOut])
def list_achievements(student_id: int, db: Session = Depends(get_db)):
    return db.query(models.AchievementRecord).filter(
        models.AchievementRecord.student_id == student_id
    ).order_by(models.AchievementRecord.achievement_date.desc()).all()


@router.post(
    "/achievements/{achievement_id}/certificate", response_model=schemas.CertificateGenerateResponse,
    dependencies=[Depends(require_roles(*CERTIFICATE_ROLES))],
)
def generate_achievement_certificate(achievement_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    achievement = db.query(models.AchievementRecord).filter(models.AchievementRecord.id == achievement_id).first()
    if not achievement:
        raise HTTPException(status_code=404, detail="Achievement not found")
    student, school, _, _ = _get_student_context(db, achievement.student_id)

    stored_filename = generate_achievement_certificate_pdf(student, school, achievement)
    document = _store_document(db, student, current_user, "achievement_certificate", stored_filename, f"Achievement_{achievement.title[:20]}")
    return schemas.CertificateGenerateResponse(document_id=document.id, download_url=f"/documents/{document.id}/download")


# ---------- ID Cards ----------

@router.post(
    "/students/{student_id}/id-card", response_model=schemas.CertificateGenerateResponse,
    dependencies=[Depends(require_roles(*CERTIFICATE_ROLES))],
)
def generate_student_id_card(student_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    student, school, section, school_class = _get_student_context(db, student_id)
    class_label = school_class.name if school_class else "—"
    section_label = section.name if section else "—"

    stored_filename = generate_student_id_card_pdf(student, school, class_label, section_label)
    document = _store_document(db, student, current_user, "id_card", stored_filename, "IDCard")
    return schemas.CertificateGenerateResponse(document_id=document.id, download_url=f"/documents/{document.id}/download")


@router.post(
    "/staff/{user_id}/id-card", response_model=schemas.CertificateGenerateResponse,
    dependencies=[Depends(require_roles(*CERTIFICATE_ROLES))],
)
def generate_staff_id_card(user_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    staff_user = db.query(models.User).filter(models.User.id == user_id).first()
    if not staff_user:
        raise HTTPException(status_code=404, detail="Staff member not found")
    staff_profile = db.query(models.StaffProfile).filter(models.StaffProfile.user_id == user_id).first()
    school = db.query(models.School).filter(models.School.id == staff_user.school_id).first()

    stored_filename = generate_staff_id_card_pdf(staff_user, staff_profile, school)
    document = models.Document(
        school_id=staff_user.school_id, entity_type="staff", entity_id=staff_user.id,
        document_type="id_card", original_filename=f"IDCard_{staff_user.full_name.replace(' ', '_')}.pdf",
        stored_filename=stored_filename, uploaded_by_user_id=current_user.id,
    )
    db.add(document)
    db.commit()
    db.refresh(document)
    return schemas.CertificateGenerateResponse(document_id=document.id, download_url=f"/documents/{document.id}/download")

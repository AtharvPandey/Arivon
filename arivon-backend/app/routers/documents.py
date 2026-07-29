"""
Document uploads — attaches files to a student, an admission application,
or (later) a staff member, using entity_type + entity_id rather than a
separate table per type.

Files are stored on local disk under ./uploads/ for now — this works
fine for local development, but before deploying for real, swap this
for cloud storage (S3, or a managed equivalent), since local disk storage
doesn't survive redeploys on most hosting platforms and doesn't scale
across multiple server instances.
"""

import os
import uuid
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.database import get_db
from app import models, schemas
from app.core.deps import get_document_downloader
from app.core.deps import get_current_user

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

router = APIRouter(prefix="/documents", tags=["documents"])


@router.post("/upload", response_model=schemas.DocumentOut, status_code=201)
async def upload_document(
    school_id: int = Form(...),
    entity_type: str = Form(...),  # "student", "admission_application", "staff"
    entity_id: int = Form(...),
    document_type: str = Form(...),  # "birth_certificate", "photo", "transfer_certificate", etc.
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    valid_entity_types = {"student", "admission_application", "staff"}
    if entity_type not in valid_entity_types:
        raise HTTPException(
            status_code=400,
            detail=f"entity_type must be one of {valid_entity_types}",
        )

    ext = os.path.splitext(file.filename)[1]
    stored_filename = f"{uuid.uuid4().hex}{ext}"
    stored_path = os.path.join(UPLOAD_DIR, stored_filename)

    contents = await file.read()
    with open(stored_path, "wb") as f:
        f.write(contents)

    document = models.Document(
        school_id=school_id,
        entity_type=entity_type,
        entity_id=entity_id,
        document_type=document_type,
        original_filename=file.filename,
        stored_filename=stored_filename,
        uploaded_by_user_id=current_user.id,
    )
    db.add(document)
    db.commit()
    db.refresh(document)
    return document


@router.get("/", response_model=list[schemas.DocumentOut])
def list_documents(
    school_id: int,
    entity_type: str | None = None,
    entity_id: int | None = None,
    db: Session = Depends(get_db),
):
    """
    entity_type + entity_id together scope to ONE record (e.g. one
    student's documents — used by the student detail page). Omitting
    both browses every document for the school — used by the school-wide
    Documents page.
    """
    query = db.query(models.Document).filter(models.Document.school_id == school_id)
    if entity_type is not None:
        query = query.filter(models.Document.entity_type == entity_type)
    if entity_id is not None:
        query = query.filter(models.Document.entity_id == entity_id)
    return query.order_by(models.Document.uploaded_at.desc()).all()


@router.get("/{document_id}/download")
def download_document(
    document_id: int,
    db: Session = Depends(get_db),
    actor: tuple = Depends(get_document_downloader),
):
    actor_type, actor_obj = actor

    document = db.query(models.Document).filter(models.Document.id == document_id).first()
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")

    # Platform Admins can access any school's documents (matches the
    # existing pattern used everywhere else in the Verification/
    # Compliance modules — Platform Admin explicitly manages compliance
    # documents across schools). A school user, however, may ONLY
    # download documents belonging to their own school — this is the
    # actual multi-tenant isolation check that was previously missing
    # entirely.
    if actor_type == "user" and document.school_id != actor_obj.school_id:
        raise HTTPException(status_code=403, detail="You do not have access to this document")

    stored_path = os.path.join(UPLOAD_DIR, document.stored_filename)
    if not os.path.exists(stored_path):
        raise HTTPException(status_code=404, detail="File missing from storage")

    return FileResponse(stored_path, filename=document.original_filename)


@router.post("/{document_id}/verify", response_model=schemas.DocumentOut)
def verify_document(
    document_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Marks a document as physically checked against the original — e.g.
    front office confirming an uploaded birth certificate photo matches
    the paper original a parent brought in. School-scoped (not the
    Platform Admin compliance-verify endpoint, which is a separate,
    platform-level concern for a different kind of document entirely).
    """
    from datetime import datetime

    document = db.query(models.Document).filter(models.Document.id == document_id).first()
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    if document.school_id != current_user.school_id:
        raise HTTPException(status_code=403, detail="You do not have access to this document")

    document.verified_by_user_id = current_user.id
    document.verified_at = datetime.utcnow()
    db.commit()
    db.refresh(document)
    return document

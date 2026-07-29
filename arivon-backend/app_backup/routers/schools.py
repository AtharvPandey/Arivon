"""
Basic School CRUD. Deliberately open (no auth) for now, ONLY because
you need to be able to create a school before any user can register
under it. Once we have a proper Super Admin role, this will be locked
down so only a platform-level admin can create new schools.
"""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app import models, schemas

router = APIRouter(prefix="/schools", tags=["schools"])


@router.post("/", response_model=schemas.SchoolOut, status_code=201)
def create_school(payload: schemas.SchoolCreate, db: Session = Depends(get_db)):
    school = models.School(**payload.model_dump())
    db.add(school)
    db.commit()
    db.refresh(school)
    return school


@router.get("/", response_model=list[schemas.SchoolOut])
def list_schools(db: Session = Depends(get_db)):
    return db.query(models.School).all()

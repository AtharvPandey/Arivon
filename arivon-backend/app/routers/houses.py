"""
School Houses (Red/Blue/Green/Yellow-style) — used for inter-house
competitions, sports day, and merit/discipline points. Creation is
restricted to School Admin/Principal tier; any logged-in staff can view
the list (a teacher assigning a student to a house needs to see options).
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app import models, schemas
from app.core.deps import require_roles

HOUSE_MANAGEMENT_ROLES = ("school_admin", "principal", "administrator", "super_admin")

router = APIRouter(prefix="/houses", tags=["houses"])


@router.post(
    "/",
    response_model=schemas.HouseOut,
    status_code=201,
    dependencies=[Depends(require_roles(*HOUSE_MANAGEMENT_ROLES))],
)
def create_house(payload: schemas.HouseCreate, db: Session = Depends(get_db)):
    existing = db.query(models.House).filter(
        models.House.school_id == payload.school_id,
        models.House.name == payload.name,
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="A house with this name already exists")

    house = models.House(**payload.model_dump())
    db.add(house)
    db.commit()
    db.refresh(house)
    return _house_to_out(db, house)


@router.get("/", response_model=list[schemas.HouseOut])
def list_houses(school_id: int, db: Session = Depends(get_db)):
    houses = db.query(models.House).filter(models.House.school_id == school_id).all()
    return [_house_to_out(db, h) for h in houses]


@router.patch(
    "/{house_id}", response_model=schemas.HouseOut,
    dependencies=[Depends(require_roles(*HOUSE_MANAGEMENT_ROLES))],
)
def update_house(house_id: int, payload: schemas.HouseUpdate, db: Session = Depends(get_db)):
    """The piece that was missing: a house's slogan or color could only
    ever be set once, at creation, with no way to update it afterward."""
    house = db.query(models.House).filter(models.House.id == house_id).first()
    if not house:
        raise HTTPException(status_code=404, detail="House not found")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(house, field, value)

    db.commit()
    db.refresh(house)
    return _house_to_out(db, house)


@router.get("/{house_id}", response_model=schemas.HouseOut)
def get_house(house_id: int, db: Session = Depends(get_db)):
    house = db.query(models.House).filter(models.House.id == house_id).first()
    if not house:
        raise HTTPException(status_code=404, detail="House not found")
    return _house_to_out(db, house)


def _house_to_out(db: Session, house: models.House) -> schemas.HouseOut:
    student_count = db.query(models.Student).filter(
        models.Student.house_id == house.id, models.Student.is_active == True,  # noqa: E712
    ).count()
    return schemas.HouseOut(
        id=house.id, school_id=house.school_id, name=house.name, color=house.color,
        slogan=house.slogan, student_count=student_count,
    )


# ---------- House Leadership Positions ----------

@router.post(
    "/{house_id}/positions", response_model=schemas.HousePositionOut, status_code=201,
    dependencies=[Depends(require_roles(*HOUSE_MANAGEMENT_ROLES))],
)
def create_house_position(house_id: int, payload: schemas.HousePositionCreate, db: Session = Depends(get_db)):
    house = db.query(models.House).filter(models.House.id == house_id).first()
    if not house:
        raise HTTPException(status_code=404, detail="House not found")
    if payload.student_id and payload.staff_user_id:
        raise HTTPException(status_code=400, detail="A position is held by a student OR a staff member, not both")

    position = models.HousePosition(house_id=house_id, **payload.model_dump())
    db.add(position)
    db.commit()
    db.refresh(position)
    return _position_to_out(db, position)


@router.get("/{house_id}/positions", response_model=list[schemas.HousePositionOut])
def list_house_positions(house_id: int, db: Session = Depends(get_db)):
    positions = db.query(models.HousePosition).filter(models.HousePosition.house_id == house_id).all()
    return [_position_to_out(db, p) for p in positions]


@router.delete(
    "/positions/{position_id}", status_code=204,
    dependencies=[Depends(require_roles(*HOUSE_MANAGEMENT_ROLES))],
)
def delete_house_position(position_id: int, db: Session = Depends(get_db)):
    position = db.query(models.HousePosition).filter(models.HousePosition.id == position_id).first()
    if not position:
        raise HTTPException(status_code=404, detail="Position not found")
    db.delete(position)
    db.commit()


def _position_to_out(db: Session, position: models.HousePosition) -> schemas.HousePositionOut:
    holder_name, holder_type, holder_photo = None, None, None
    if position.student_id:
        student = db.query(models.Student).filter(models.Student.id == position.student_id).first()
        if student:
            holder_name, holder_type, holder_photo = student.full_name, "student", student.photo_url
    elif position.staff_user_id:
        staff = db.query(models.User).filter(models.User.id == position.staff_user_id).first()
        if staff:
            profile = db.query(models.StaffProfile).filter(models.StaffProfile.user_id == staff.id).first()
            holder_name, holder_type = staff.full_name, "staff"
            holder_photo = profile.photo_url if profile else None

    return schemas.HousePositionOut(
        id=position.id, house_id=position.house_id, position_title=position.position_title,
        student_id=position.student_id, staff_user_id=position.staff_user_id,
        holder_name=holder_name, holder_type=holder_type, holder_photo_url=holder_photo,
    )

"""
Transport — bus routes and stops, student assignment, and the
route-wise student list a driver/conductor actually uses each morning.
Route/stop management is Admin-tier; any staff member can view the
route-wise list (a teacher assigning a student to transport, or just
checking who's on a given bus, doesn't need Admin rights for that).
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app import models, schemas
from app.core.deps import require_roles

TRANSPORT_ROLES = ("school_admin", "principal", "vice_principal", "administrator", "super_admin")

router = APIRouter(prefix="/transport", tags=["transport"])


# ---------- Bus Routes ----------

@router.post("/routes", response_model=schemas.BusRouteOut, status_code=201, dependencies=[Depends(require_roles(*TRANSPORT_ROLES))])
def create_route(payload: schemas.BusRouteCreate, db: Session = Depends(get_db)):
    route = models.BusRoute(**payload.model_dump())
    db.add(route)
    db.commit()
    db.refresh(route)
    return _route_to_out(db, route)


@router.get("/routes", response_model=list[schemas.BusRouteOut])
def list_routes(school_id: int, include_inactive: bool = False, db: Session = Depends(get_db)):
    query = db.query(models.BusRoute).filter(models.BusRoute.school_id == school_id)
    if not include_inactive:
        query = query.filter(models.BusRoute.is_active == True)  # noqa: E712
    return [_route_to_out(db, r) for r in query.all()]


@router.patch("/routes/{route_id}", response_model=schemas.BusRouteOut, dependencies=[Depends(require_roles(*TRANSPORT_ROLES))])
def update_route(route_id: int, payload: schemas.BusRouteUpdate, db: Session = Depends(get_db)):
    route = db.query(models.BusRoute).filter(models.BusRoute.id == route_id).first()
    if not route:
        raise HTTPException(status_code=404, detail="Route not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(route, field, value)
    db.commit()
    db.refresh(route)
    return _route_to_out(db, route)


@router.delete("/routes/{route_id}", status_code=204, dependencies=[Depends(require_roles(*TRANSPORT_ROLES))])
def deactivate_route(route_id: int, db: Session = Depends(get_db)):
    """Soft delete — a route with students still assigned to it
    shouldn't just vanish; deactivating keeps history and prevents new
    assignments without breaking anything already pointing at it."""
    route = db.query(models.BusRoute).filter(models.BusRoute.id == route_id).first()
    if not route:
        raise HTTPException(status_code=404, detail="Route not found")
    route.is_active = False
    db.commit()


def _route_to_out(db: Session, route: models.BusRoute) -> schemas.BusRouteOut:
    student_count = db.query(models.Student).filter(
        models.Student.bus_route_id == route.id, models.Student.is_active == True,  # noqa: E712
    ).count()
    return schemas.BusRouteOut(
        id=route.id, school_id=route.school_id, route_name=route.route_name, route_number=route.route_number,
        vehicle_number=route.vehicle_number, driver_name=route.driver_name, driver_phone=route.driver_phone,
        conductor_name=route.conductor_name, conductor_phone=route.conductor_phone, is_active=route.is_active,
        student_count=student_count,
    )


# ---------- Bus Stops ----------

@router.post("/stops", response_model=schemas.BusStopOut, status_code=201, dependencies=[Depends(require_roles(*TRANSPORT_ROLES))])
def create_stop(payload: schemas.BusStopCreate, db: Session = Depends(get_db)):
    route = db.query(models.BusRoute).filter(models.BusRoute.id == payload.route_id).first()
    if not route:
        raise HTTPException(status_code=404, detail="Route not found")
    stop = models.BusStop(**payload.model_dump())
    db.add(stop)
    db.commit()
    db.refresh(stop)
    return _stop_to_out(db, stop)


@router.get("/routes/{route_id}/stops", response_model=list[schemas.BusStopOut])
def list_stops(route_id: int, db: Session = Depends(get_db)):
    stops = db.query(models.BusStop).filter(models.BusStop.route_id == route_id).order_by(models.BusStop.stop_order).all()
    return [_stop_to_out(db, s) for s in stops]


@router.delete("/stops/{stop_id}", status_code=204, dependencies=[Depends(require_roles(*TRANSPORT_ROLES))])
def delete_stop(stop_id: int, db: Session = Depends(get_db)):
    stop = db.query(models.BusStop).filter(models.BusStop.id == stop_id).first()
    if not stop:
        raise HTTPException(status_code=404, detail="Stop not found")
    students_using_stop = db.query(models.Student).filter(models.Student.bus_stop_id == stop_id).first()
    if students_using_stop:
        raise HTTPException(status_code=400, detail="Cannot remove a stop that students are currently assigned to")
    db.delete(stop)
    db.commit()


def _stop_to_out(db: Session, stop: models.BusStop) -> schemas.BusStopOut:
    student_count = db.query(models.Student).filter(
        models.Student.bus_stop_id == stop.id, models.Student.is_active == True,  # noqa: E712
    ).count()
    return schemas.BusStopOut(
        id=stop.id, route_id=stop.route_id, stop_name=stop.stop_name, stop_order=stop.stop_order,
        latitude=stop.latitude, longitude=stop.longitude,
        pickup_time=stop.pickup_time, drop_time=stop.drop_time, student_count=student_count,
    )


# ---------- Student Assignment & Route-wise List ----------

@router.patch("/students/{student_id}/assign", response_model=schemas.RouteStudentListItem)
def assign_student_transport(student_id: int, payload: schemas.AssignStudentTransportRequest, db: Session = Depends(get_db)):
    student = db.query(models.Student).filter(models.Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    if payload.bus_stop_id is not None:
        stop = db.query(models.BusStop).filter(models.BusStop.id == payload.bus_stop_id).first()
        if not stop:
            raise HTTPException(status_code=404, detail="Bus stop not found")
        if payload.bus_route_id is not None and stop.route_id != payload.bus_route_id:
            raise HTTPException(status_code=400, detail="This stop does not belong to the given route")

    student.bus_route_id = payload.bus_route_id
    student.bus_stop_id = payload.bus_stop_id
    db.commit()
    db.refresh(student)
    return _student_to_route_item(db, student)


@router.get("/routes/{route_id}/students", response_model=list[schemas.RouteStudentListItem])
def get_route_student_list(route_id: int, db: Session = Depends(get_db)):
    """
    The list a driver/conductor actually works from each morning —
    every student assigned to this route, with their stop, class, and a
    guardian contact number on hand.
    """
    students = db.query(models.Student).filter(
        models.Student.bus_route_id == route_id, models.Student.is_active == True,  # noqa: E712
    ).all()
    return [_student_to_route_item(db, s) for s in students]


def _student_to_route_item(db: Session, student: models.Student) -> schemas.RouteStudentListItem:
    section = db.query(models.Section).filter(models.Section.id == student.section_id).first()
    school_class = db.query(models.SchoolClass).filter(models.SchoolClass.id == section.school_class_id).first() if section else None
    stop = db.query(models.BusStop).filter(models.BusStop.id == student.bus_stop_id).first() if student.bus_stop_id else None
    return schemas.RouteStudentListItem(
        student_id=student.id, full_name=student.full_name, admission_number=student.admission_number,
        class_name=school_class.name if school_class else "—", section_name=section.name if section else "—",
        stop_name=stop.stop_name if stop else None, guardian_phone=student.guardian_phone,
    )

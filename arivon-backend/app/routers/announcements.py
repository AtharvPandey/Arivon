"""
Notice board. Anyone logged in can READ announcements meant for them —
it's a shared channel — but only Principal/Vice Principal/Administrator
can POST one. Now targetable: school-wide (both school_class_id and
section_id left null), an entire class (school_class_id set, section_id
null), or one specific section (both set) — mirroring the same nullable
targeting pattern used for PTM scheduling.
"""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app import models, schemas
from app.core.deps import get_current_user, require_roles

router = APIRouter(prefix="/announcements", tags=["announcements"])


def _announcement_to_out(db: Session, a: models.Announcement) -> schemas.AnnouncementOut:
    school_class = db.query(models.SchoolClass).filter(models.SchoolClass.id == a.school_class_id).first() if a.school_class_id else None
    section = db.query(models.Section).filter(models.Section.id == a.section_id).first() if a.section_id else None
    return schemas.AnnouncementOut(
        id=a.id, school_id=a.school_id, title=a.title, content=a.content, category=a.category,
        school_class_id=a.school_class_id, section_id=a.section_id,
        class_name=school_class.name if school_class else None, section_name=section.name if section else None,
        created_by_user_id=a.created_by_user_id, created_at=a.created_at,
    )


@router.post(
    "/",
    response_model=schemas.AnnouncementOut,
    status_code=201,
    dependencies=[Depends(require_roles("school_admin", "principal", "vice_principal", "administrator", "super_admin"))],
)
def create_announcement(
    payload: schemas.AnnouncementCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    announcement = models.Announcement(
        school_id=payload.school_id,
        title=payload.title,
        content=payload.content,
        category=payload.category,
        school_class_id=payload.school_class_id,
        section_id=payload.section_id,
        created_by_user_id=current_user.id,
    )
    db.add(announcement)
    db.commit()
    db.refresh(announcement)
    return _announcement_to_out(db, announcement)


@router.get("/", response_model=list[schemas.AnnouncementOut])
def list_announcements(
    school_id: int,
    category: str | None = None,
    school_class_id: int | None = None,
    section_id: int | None = None,
    db: Session = Depends(get_db),
):
    """
    Without school_class_id/section_id filters, returns everything (the
    Admin's full management view). Pass school_class_id and/or
    section_id to see what a specific class or section would actually
    see: school-wide notices, PLUS notices targeted at that class,
    PLUS notices targeted at that specific section.
    """
    query = db.query(models.Announcement).filter(models.Announcement.school_id == school_id)
    if category is not None:
        query = query.filter(models.Announcement.category == category)

    if section_id is not None:
        query = query.filter(
            (models.Announcement.school_class_id.is_(None)) |
            ((models.Announcement.school_class_id == school_class_id) & (models.Announcement.section_id.is_(None))) |
            (models.Announcement.section_id == section_id)
        )
    elif school_class_id is not None:
        query = query.filter(
            (models.Announcement.school_class_id.is_(None)) | (models.Announcement.school_class_id == school_class_id)
        )

    announcements = query.order_by(models.Announcement.created_at.desc()).all()
    return [_announcement_to_out(db, a) for a in announcements]

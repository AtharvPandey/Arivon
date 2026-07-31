"""
School slugs — the URL-safe identifier that gives each school its own
login URL (/{slug}/login) and, from there, every authenticated page
under that school (/{slug}/admin/dashboard, /{slug}/principal/dashboard,
etc). Generated once at school creation, never changed afterward (the
URL a school's staff bookmark and share should stay stable).
"""

import re

from sqlalchemy.orm import Session
from app import models


def _slugify(text: str) -> str:
    """'Green Valley International School' -> 'green-valley-international-school'"""
    text = text.strip().lower()
    text = re.sub(r"[^a-z0-9]+", "-", text)
    text = re.sub(r"-+", "-", text).strip("-")
    return text or "school"


def generate_unique_school_slug(db: Session, name: str, short_name: str | None = None) -> str:
    """
    Prefer the short name if one was given — that's usually already
    close to what a school would want as its URL ("GIS" for "Green
    Valley International School"), and produces a much shorter, more
    memorable URL than slugifying the full name. Falls back to the full
    name otherwise. Appends -2, -3, ... on collision, since two schools
    can genuinely share a short name or initials.
    """
    base = _slugify(short_name) if short_name else _slugify(name)
    slug = base
    suffix = 2
    while db.query(models.School).filter(models.School.slug == slug).first() is not None:
        slug = f"{base}-{suffix}"
        suffix += 1
    return slug

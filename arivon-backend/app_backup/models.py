"""
Core entities for Arivon Phase 0.

Why these 4 tables first, and in this order:

- School:        the tenant. EVERYTHING else belongs to a school. This is
                  what makes Arivon multi-school from day one instead of
                  bolting it on later (which is painful and error-prone).
- AcademicYear:  schools operate in yearly cycles (2026-27, 2027-28...).
                  Almost every future feature (attendance, fees, exams,
                  promotions) will be scoped to "this school, this year."
- Role:          defines WHAT a user can do (Principal, Teacher, Accountant,
                  etc). Kept as its own table (not a hardcoded string) so
                  you can add new roles later without a code change.
- User:          WHO is logged in. Belongs to exactly one School and has
                  exactly one Role (for now — later a user could have
                  multiple roles, but let's not over-engineer yet).
"""

from datetime import datetime
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Date
from sqlalchemy.orm import relationship
from app.database import Base


class School(Base):
    __tablename__ = "schools"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    board_type = Column(String, nullable=False)  # CBSE / ICSE / State Board
    city = Column(String)
    state = Column(String)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    academic_years = relationship("AcademicYear", back_populates="school")
    users = relationship("User", back_populates="school")


class AcademicYear(Base):
    __tablename__ = "academic_years"

    id = Column(Integer, primary_key=True, index=True)
    school_id = Column(Integer, ForeignKey("schools.id"), nullable=False)
    label = Column(String, nullable=False)  # e.g. "2026-2027"
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)
    is_current = Column(Boolean, default=False)  # only one should be True per school

    school = relationship("School", back_populates="academic_years")


class Role(Base):
    __tablename__ = "roles"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, nullable=False)  # e.g. "principal", "teacher"
    description = Column(String)


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    school_id = Column(Integer, ForeignKey("schools.id"), nullable=False)
    role_id = Column(Integer, ForeignKey("roles.id"), nullable=False)

    full_name = Column(String, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    school = relationship("School", back_populates="users")
    role = relationship("Role")

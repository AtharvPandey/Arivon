"""
Pydantic schemas: define the shape of data going IN and OUT of the API.

Rule of thumb: models.py = what's in the database.
              schemas.py = what the outside world is allowed to see/send.
This is why UserOut below has no password field, even though the User
model does — we never want a password hash going out in an API response.
"""

from datetime import date, datetime
from pydantic import BaseModel, EmailStr


# ---------- School ----------

class SchoolCreate(BaseModel):
    name: str
    board_type: str
    city: str | None = None
    state: str | None = None


class SchoolOut(BaseModel):
    id: int
    name: str
    board_type: str
    city: str | None
    state: str | None
    is_active: bool

    class Config:
        from_attributes = True  # lets Pydantic read data straight off SQLAlchemy objects


# ---------- Academic Year ----------

class AcademicYearCreate(BaseModel):
    school_id: int
    label: str
    start_date: date
    end_date: date
    is_current: bool = False


class AcademicYearOut(BaseModel):
    id: int
    school_id: int
    label: str
    start_date: date
    end_date: date
    is_current: bool

    class Config:
        from_attributes = True


# ---------- Auth / User ----------

class UserRegister(BaseModel):
    school_id: int
    role_name: str  # e.g. "principal", "teacher" — looked up against Role table
    full_name: str
    email: EmailStr
    password: str


class UserOut(BaseModel):
    id: int
    school_id: int
    full_name: str
    email: EmailStr
    is_active: bool

    class Config:
        from_attributes = True


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class LoginRequest(BaseModel):
    email: EmailStr
    password: str

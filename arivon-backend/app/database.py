"""
Sets up the database connection.

Why SQLite for now: it needs zero setup (no server to install), so you can
run the whole app today with one command. When you're ready to deploy for
real, you just change DATABASE_URL in .env to a Postgres URL (e.g. from
Supabase or Railway) — nothing else in the code changes, because SQLAlchemy
abstracts the database engine away from your model code.
"""

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from app.core.config import settings

# Render, Heroku, and Railway all hand out connection strings starting
# with "postgres://" — a legacy scheme SQLAlchemy 2.0 refuses outright
# ("Could not parse rfc1738 URL"). Normalize it here so DATABASE_URL can
# be pasted directly from any of those providers without edits.
_database_url = settings.database_url
if _database_url.startswith("postgres://"):
    _database_url = _database_url.replace("postgres://", "postgresql://", 1)

# check_same_thread is only needed for SQLite (not Postgres) because SQLite
# by default only allows the thread that created the connection to use it.
connect_args = (
    {"check_same_thread": False} if _database_url.startswith("sqlite") else {}
)

engine = create_engine(_database_url, connect_args=connect_args)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# All our model classes (School, User, etc.) will inherit from this Base.
Base = declarative_base()


def get_db():
    """
    FastAPI dependency: gives each request its own DB session,
    and always closes it afterward, even if an error happens.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

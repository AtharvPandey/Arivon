"""
One-time bootstrap script to create a Platform Admin account.

There's no API endpoint for this on purpose — "only we have this access"
means platform admin accounts are provisioned out-of-band, by someone
with direct access to the server/database, not through anything exposed
to the internet.

Usage (interactive, for local dev):
    python3 scripts/create_platform_admin.py

Usage (non-interactive, for hosts with no shell access like Render's
free tier): set these three environment variables before running —
    PLATFORM_ADMIN_NAME, PLATFORM_ADMIN_EMAIL, PLATFORM_ADMIN_PASSWORD
The script checks env vars first and only falls back to interactive
prompts if they're not set, so local usage is completely unchanged.
Safe to run on every boot — it skips creating a duplicate if an admin
with that email already exists.
"""

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import SessionLocal, Base, engine
from app import models
from app.core.security import hash_password


def main():
    Base.metadata.create_all(bind=engine)  # harmless if tables already exist via Alembic

    full_name = os.environ.get("PLATFORM_ADMIN_NAME") or input("Full name: ").strip()
    email = os.environ.get("PLATFORM_ADMIN_EMAIL") or input("Email: ").strip()
    password = os.environ.get("PLATFORM_ADMIN_PASSWORD") or input("Password: ").strip()

    db = SessionLocal()
    try:
        existing = db.query(models.PlatformAdmin).filter(models.PlatformAdmin.email == email).first()
        if existing:
            print(f"A platform admin with email {email} already exists.")
            return

        admin = models.PlatformAdmin(
            full_name=full_name,
            email=email,
            hashed_password=hash_password(password),
        )
        db.add(admin)
        db.commit()
        print(f"Platform admin '{full_name}' <{email}> created successfully.")
    finally:
        db.close()


if __name__ == "__main__":
    main()

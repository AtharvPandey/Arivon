"""
Temporary passwords — every account created BY someone else (School
Admin creating staff, Platform Admin creating a School Admin) gets a
system-generated temporary password rather than the creator typing one
in. This is generated here rather than left to whoever's filling out
the form, since a human-chosen "temporary" password tends to be weak
("temp123") in exactly the scenario where it matters most — before the
real account holder has set anything of their own.
"""

import secrets
import string
from datetime import datetime, timedelta

TEMP_PASSWORD_VALIDITY_DAYS = 3

# Excludes visually ambiguous characters (0/O, 1/l/I) since these get
# read off a screen and typed by hand far more often than a normal
# password — a temp password that's hard to transcribe correctly
# defeats its own purpose.
_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789"


def generate_temp_password(length: int = 10) -> str:
    return "".join(secrets.choice(_ALPHABET) for _ in range(length))


def temp_password_expiry() -> datetime:
    return datetime.utcnow() + timedelta(days=TEMP_PASSWORD_VALIDITY_DAYS)

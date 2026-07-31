#!/usr/bin/env bash
# Render's Start Command box truncated a long inline command before
# ("alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port
# $PORT" got cut off mid-way). Keeping the actual startup logic in a
# committed script avoids relying on a UI text field to hold it intact,
# and is easier to read/modify later than a one-liner.
set -e

echo "Running database migrations..."
alembic upgrade head

# One-time bootstrap: Render's free tier has no Shell access to run this
# manually, so it can run here instead. Guarded by SEED_PLATFORM_ADMIN so
# it doesn't fire on every normal boot — set it to "true" along with
# PLATFORM_ADMIN_NAME/EMAIL/PASSWORD for one deploy, then remove it
# (or just leave it: the script is idempotent and skips creating a
# duplicate if that email already exists).
if [ "$SEED_PLATFORM_ADMIN" = "true" ]; then
  echo "Seeding platform admin..."
  python scripts/create_platform_admin.py
fi

echo "Starting server..."
exec uvicorn app.main:app --host 0.0.0.0 --port "$PORT"

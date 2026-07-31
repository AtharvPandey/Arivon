#!/usr/bin/env bash
# Render's Start Command box truncated a long inline command before
# ("alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port
# $PORT" got cut off mid-way). Keeping the actual startup logic in a
# committed script avoids relying on a UI text field to hold it intact,
# and is easier to read/modify later than a one-liner.
set -e

echo "Running database migrations..."
alembic upgrade head

echo "Starting server..."
exec uvicorn app.main:app --host 0.0.0.0 --port "$PORT"

#!/usr/bin/env bash
# apply-migrations.sh — apply backend SQL migrations to the running Postgres container.
#
# Why this exists: docker-entrypoint-initdb.d only runs on a FRESH database volume.
# For an existing database, new migration files must be applied manually. This script
# applies every backend/sql/migrations/*.sql file in filename order, tracking which
# have already run in a schema_migrations table so each is applied exactly once.
#
# Usage (from repo root):
#   ./backend/scripts/apply-migrations.sh
# Optional env overrides:
#   PG_CONTAINER (default indiestack-postgres)  PG_USER (default indiestack)  PG_DB (default indiestack)

set -euo pipefail

PG_CONTAINER="${PG_CONTAINER:-indiestack-postgres}"
PG_USER="${PG_USER:-indiestack}"
PG_DB="${PG_DB:-indiestack}"
MIGRATIONS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../sql/migrations" && pwd)"

if ! docker ps --format '{{.Names}}' | grep -qx "$PG_CONTAINER"; then
  echo "ERROR: container '$PG_CONTAINER' is not running." >&2
  exit 1
fi

# Tracking table: one row per applied migration file.
docker exec -i "$PG_CONTAINER" psql -U "$PG_USER" -d "$PG_DB" <<'SQL'
CREATE TABLE IF NOT EXISTS schema_migrations (
  filename TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
SQL

shopt -s nullglob
for file in "$MIGRATIONS_DIR"/*.sql; do
  name="$(basename "$file")"
  already=$(docker exec -i "$PG_CONTAINER" psql -U "$PG_USER" -d "$PG_DB" -t -A \
    -c "SELECT COUNT(1) FROM schema_migrations WHERE filename = '$name';")
  if [ "$already" = "1" ]; then
    echo "skip  $name (already applied)"
    continue
  fi
  echo "apply $name ..."
  if docker exec -i "$PG_CONTAINER" psql -U "$PG_USER" -d "$PG_DB" -v ON_ERROR_STOP=1 < "$file"; then
    docker exec -i "$PG_CONTAINER" psql -U "$PG_USER" -d "$PG_DB" \
      -c "INSERT INTO schema_migrations (filename) VALUES ('$name');" >/dev/null
    echo "done  $name"
  else
    echo "ERROR applying $name — stopping." >&2
    exit 1
  fi
done

echo "All migrations up to date."

# apply-migrations.ps1 - apply backend SQL migrations to the running Postgres container.
#
# Why this exists: docker-entrypoint-initdb.d only runs on a FRESH database volume.
# For an existing database, new migration files must be applied manually. This script
# applies every backend/sql/migrations/*.sql file in filename order, tracking which
# have already run in a schema_migrations table so each is applied exactly once.
#
# Usage (from repo root):
#   ./backend/scripts/apply-migrations.ps1
# Optional env overrides:
#   $env:PG_CONTAINER (default indiestack-postgres)  $env:PG_USER (default indiestack)  $env:PG_DB (default indiestack)

# Use Continue (not Stop) because psql writes harmless NOTICEs to stderr, which
# PowerShell would otherwise surface as NativeCommandError and abort the loop.
$ErrorActionPreference = 'Continue'

$PG_CONTAINER = if ($env:PG_CONTAINER) { $env:PG_CONTAINER } else { 'indiestack-postgres' }
$PG_USER      = if ($env:PG_USER)      { $env:PG_USER }      else { 'indiestack' }
$PG_DB        = if ($env:PG_DB)        { $env:PG_DB }        else { 'indiestack' }
$MigrationsDir = Join-Path $PSScriptRoot '..\sql\migrations'

$running = docker ps --format '{{.Names}}'
if ($running -notcontains $PG_CONTAINER) {
  Write-Error "container '$PG_CONTAINER' is not running."
  exit 1
}

# Tracking table: one row per applied migration file.
$create = @'
CREATE TABLE IF NOT EXISTS schema_migrations (
  filename TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
'@
$create | docker exec -i $PG_CONTAINER psql -U $PG_USER -d $PG_DB | Out-Null

Get-ChildItem -Path $MigrationsDir -Filter *.sql | Sort-Object Name | ForEach-Object {
  $name = $_.Name
  $already = (docker exec -i $PG_CONTAINER psql -U $PG_USER -d $PG_DB -t -A `
    -c "SELECT COUNT(1) FROM schema_migrations WHERE filename = '$name';").Trim()
  if ($already -eq '1') {
    Write-Host "skip  $name (already applied)"
    return
  }
  Write-Host "apply $name ..."
  Get-Content $_.FullName | docker exec -i $PG_CONTAINER psql -U $PG_USER -d $PG_DB -v ON_ERROR_STOP=1
  if ($LASTEXITCODE -eq 0) {
    docker exec -i $PG_CONTAINER psql -U $PG_USER -d $PG_DB `
      -c "INSERT INTO schema_migrations (filename) VALUES ('$name');" | Out-Null
    Write-Host "done  $name"
  } else {
    Write-Error "ERROR applying $name - stopping."
    exit 1
  }
}

Write-Host "All migrations up to date."

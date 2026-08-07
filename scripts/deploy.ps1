# deploy.ps1 - one-command deploy of the local source to the remote VM.
#
# Local source is the SINGLE SOURCE OF TRUTH. This script packages the project
# (excluding junk + secrets), copies it to the VM, rebuilds/restarts services,
# and applies any new database migrations.
#
# Usage:
#   .\scripts\deploy.ps1                      # full deploy (build + up + migrate)
#   .\scripts\deploy.ps1 -Target 10.1.77.16   # override host
#   .\scripts\deploy.ps1 -Services nextjs     # rebuild only specific service(s)
#
# Config (edit or set env vars):
#   $env:DEPLOY_HOST (default 10.1.77.16)
#   $env:DEPLOY_USER (default student)

param(
  [string]$Target = $(if ($env:DEPLOY_HOST) { $env:DEPLOY_HOST } else { "10.1.77.16" }),
  [string]$User   = $(if ($env:DEPLOY_USER) { $env:DEPLOY_USER } else { "student" }),
  [string]$Services = ""   # e.g. "nextjs" or "go-api nextjs"; empty = all
)

$ErrorActionPreference = 'Stop'
$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
$SshTarget = "$User@$Target"
$Work = Join-Path $env:TEMP "indiestack-deploy-work"

Write-Host "==> Packaging local source (excluding junk + secrets)..." -ForegroundColor Cyan
if (Test-Path $Work) { Remove-Item $Work -Recurse -Force }
New-Item -ItemType Directory -Path $Work -Force | Out-Null

$include = @(
  "frontend","backend","landing","scripts","k8s","load-tests",
  "docker-compose.yml","Caddyfile",".env.example","README.md","ARCHITECTURE.md"
)
foreach ($item in $include) {
  $p = Join-Path $RepoRoot $item
  if (Test-Path $p) { Copy-Item $p $Work -Recurse -Force }
}

# Prune build artifacts / VCS / secrets / local-only files.
Get-ChildItem $Work -Recurse -Directory -Force -ErrorAction SilentlyContinue |
  Where-Object { $_.Name -in @('node_modules','.next','.git') } |
  Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
Get-ChildItem $Work -Recurse -Force -ErrorAction SilentlyContinue |
  Where-Object { $_.Name -in @('tsconfig.tsbuildinfo','PRIVATE_TRACKING.md','token.txt','login.json','login-response.json','.env') -or $_.Name -match '\.log$' } |
  Remove-Item -Force -ErrorAction SilentlyContinue

# Sanity check: never ship secrets.
$bad = Get-ChildItem $Work -Recurse -Force -ErrorAction SilentlyContinue |
  Where-Object { $_.Name -match 'PRIVATE_TRACKING|token\.txt|login\.json|login-response|\.env$|node_modules' }
if ($bad) {
  Write-Host "ABORT: sensitive files would be packaged:" -ForegroundColor Red
  $bad | ForEach-Object { Write-Host "  $($_.FullName)" -ForegroundColor Red }
  exit 1
}

$Zip = Join-Path $env:TEMP "indiestack-deploy.tar.gz"
if (Test-Path $Zip) { Remove-Item $Zip -Force }
# Use tar (built into Windows 10+) so paths use forward slashes — PowerShell's
# Compress-Archive writes backslash separators that make Linux unzip warn+exit 1.
Push-Location $Work
tar -czf $Zip *
if ($LASTEXITCODE -ne 0) { Pop-Location; Write-Host "tar failed" -ForegroundColor Red; exit 1 }
Pop-Location
$mb = [math]::Round((Get-Item $Zip).Length / 1MB, 2)
Write-Host "    packaged $mb MB -> $Zip" -ForegroundColor Green

Write-Host "==> Copying to $SshTarget ..." -ForegroundColor Cyan
scp -o BatchMode=yes $Zip "${SshTarget}:/tmp/indiestack-deploy.tar.gz"
if ($LASTEXITCODE -ne 0) { Write-Host "scp failed" -ForegroundColor Red; exit 1 }

# Build the remote command script (LF-only) and run it.
$remote = @"
set -e
mkdir -p ~/indiestack
cd ~/indiestack
tar -xzf /tmp/indiestack-deploy.tar.gz -C ~/indiestack
sudo chown -R `$USER:`$USER ~/indiestack 2>/dev/null || true
chmod -R u+rwX ~/indiestack
echo '==> Building services...'
if [ -n "$Services" ]; then
  sudo docker compose build $Services
  sudo docker compose up -d $Services
else
  sudo docker compose build
  sudo docker compose up -d
fi
echo '==> Waiting for postgres...'
for i in `$(seq 1 30); do
  if sudo docker ps --filter name=indiestack-postgres --format '{{.Status}}' | grep -q healthy; then break; fi
  sleep 2
done
echo '==> Applying migrations...'
sudo docker exec -i indiestack-postgres psql -U indiestack -d indiestack -c "CREATE TABLE IF NOT EXISTS schema_migrations (filename TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW());" >/dev/null 2>&1 || true
for f in backend/sql/migrations/*.sql; do
  name=`$(basename "`$f")
  already=`$(sudo docker exec -i indiestack-postgres psql -U indiestack -d indiestack -t -A -c "SELECT COUNT(1) FROM schema_migrations WHERE filename='`$name';" 2>/dev/null | tr -d '[:space:]')
  if [ "`$already" = "1" ]; then echo "skip  `$name"; continue; fi
  if sudo docker exec -i indiestack-postgres psql -U indiestack -d indiestack -v ON_ERROR_STOP=1 < "`$f" >/dev/null 2>&1; then
    sudo docker exec -i indiestack-postgres psql -U indiestack -d indiestack -c "INSERT INTO schema_migrations (filename) VALUES ('`$name');" >/dev/null 2>&1
    echo "done  `$name"
  else
    echo "ERR   `$name"
  fi
done
echo '==> Status:'
sudo docker ps --format 'table {{.Names}}\t{{.Status}}'
echo 'DEPLOY_DONE'
"@

$remoteLf = $remote -replace "`r`n", "`n"
$remoteScript = Join-Path $env:TEMP "indiestack-remote-deploy.sh"
[System.IO.File]::WriteAllText($remoteScript, $remoteLf, (New-Object System.Text.UTF8Encoding($false)))

Write-Host "==> Running build + migrate on the VM (this can take a few minutes)..." -ForegroundColor Cyan
scp -o BatchMode=yes $remoteScript "${SshTarget}:/tmp/indiestack-remote-deploy.sh"
ssh -o BatchMode=yes $SshTarget "bash /tmp/indiestack-remote-deploy.sh"
if ($LASTEXITCODE -ne 0) { Write-Host "remote deploy failed" -ForegroundColor Red; exit 1 }

Write-Host "==> Verifying app responds..." -ForegroundColor Cyan
ssh -o BatchMode=yes $SshTarget "curl -sS -m 20 -o /dev/null -w 'health: HTTP %{http_code}\n' http://localhost/health; curl -sS -m 25 -o /dev/null -w 'frontend: HTTP %{http_code}\n' http://localhost/"

Write-Host ""
Write-Host "DEPLOY COMPLETE -> http://${Target}" -ForegroundColor Green

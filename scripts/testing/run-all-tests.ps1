# IndieStack Test Runner (PowerShell)
# Runs the backend unit/integration tests and live API tests.

param(
    [string]$TestDbUrl = "postgres://indiestack:indiestack_secret@localhost:5432/indiestack_test?sslmode=disable",
    [string]$TestApiUrl = "http://localhost:8080/api/v1"
)

$env:TEST_DATABASE_URL = if ($env:TEST_DATABASE_URL) { $env:TEST_DATABASE_URL } else { $TestDbUrl }
$env:DATABASE_URL = if ($env:DATABASE_URL) { $env:DATABASE_URL } else { $TestDbUrl }
$env:TEST_API_URL = $TestApiUrl

$Pass = 0
$Fail = 0
$Warn = 0

function Invoke-Step {
    param([string]$Name, [scriptblock]$Script)
    Write-Host "--- Running: $Name ---"
    try {
        & $Script
        Write-Host "PASS: $Name"
        $script:Pass++
    } catch {
        Write-Host "FAIL: $Name"
        Write-Host $_
        $script:Fail++
    }
    Write-Host ""
}

Write-Host "=========================================="
Write-Host "IndieStack Test Suite"
Write-Host "=========================================="
Write-Host ""

Set-Location "$PSScriptRoot\..\..\backend"

Invoke-Step -Name "Static Analysis (go vet)" -Script {
    & go vet ./...
}

Invoke-Step -Name "Backend Unit Tests" -Script {
    & go test ./internal/... ./internal/testutil/...
}

Invoke-Step -Name "Database Integration Tests" -Script {
    & go test -v ./tests/integration/... -run 'TestDatabaseSchema|TestUserLifecycle|TestPostLifecycle|TestFollowRelationship|TestAPIKeyScopes|TestNewsletterSubscription|TestForeignKeyConstraints'
}

Invoke-Step -Name "Live API Tests" -Script {
    try {
        $status = (Invoke-WebRequest -Uri "$TestApiUrl/health" -UseBasicParsing -TimeoutSec 5).StatusCode
        if ($status -eq 200) {
            & go test -v ./tests/integration/... -run 'TestAPI|TestPublic|TestRegister|TestLogin'
        } else {
            throw "API health returned $status"
        }
    } catch {
        Write-Host "SKIP: Live API tests (API not reachable at $TestApiUrl)"
        $script:Warn++
    }
}

Invoke-Step -Name "Coverage Report" -Script {
    & go test -coverprofile=coverage.out ./internal/... ./tests/integration/...
}

Set-Location ..

Write-Host "=========================================="
Write-Host "Test Suite Summary"
Write-Host "=========================================="
Write-Host "Passed steps: $Pass"
Write-Host "Failed steps: $Fail"
Write-Host "Warnings: $Warn"
Write-Host ""

if ($Fail -gt 0) {
    Write-Host "Test suite completed with failures"
    exit 1
}

Write-Host "Test suite completed successfully"
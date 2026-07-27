# Infrastructure Connectivity Check Script for Windows
# Usage: .\infrastructure-check.ps1

# Colors
$Green = "`e[32m"
$Red = "`e[31m"
$Yellow = "`e[33m"
$Reset = "`e[0m"

# Counters
$script:Passed = 0
$script:Failed = 0
$script:Warnings = 0

function Write-Pass($message) {
    Write-Host "$Green✅ PASS$Reset`: $message"
    $script:Passed++
}

function Write-Fail($message) {
    Write-Host "$Red❌ FAIL$Reset`: $message"
    $script:Failed++
}

function Write-Warn($message) {
    Write-Host "$Yellow⚠️  WARN$Reset`: $message"
    $script:Warnings++
}

Write-Host "=========================================="
Write-Host "IndieStack Infrastructure Health Check"
Write-Host "=========================================="
Write-Host ""

# Check PostgreSQL
Write-Host "🔍 Checking PostgreSQL..."
try {
    $pgResult = & pg_isready -h localhost -p 5432 -U indiestack 2>&1
    if ($pgResult -match "accepting connections") {
        Write-Pass "PostgreSQL is accepting connections"
        
        try {
            $tableCount = & psql -h localhost -p 5432 -U indiestack -d indiestack -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public'" 2>$null
            $tableCount = $tableCount.Trim()
            if ([int]$tableCount -gt 0) {
                Write-Pass "Database has $tableCount tables"
            } else {
                Write-Warn "Database has no tables - migrations may not have run"
            }
        } catch {
            Write-Warn "Could not query table count"
        }
    } else {
        Write-Fail "PostgreSQL is not accepting connections"
    }
} catch {
    Write-Fail "PostgreSQL check failed: $_"
}
Write-Host ""

# Check Redis
Write-Host "🔍 Checking Redis..."
try {
    $redisResult = & redis-cli ping 2>$null
    if ($redisResult -eq "PONG") {
        Write-Pass "Redis is responding to PING"
        
        $memory = & redis-cli INFO memory 2>$null | Select-String "used_memory_human"
        if ($memory) {
            Write-Pass "Redis memory: $($memory.ToString().Split(':')[1])"
        }
        
        $clients = & redis-cli INFO clients 2>$null | Select-String "connected_clients"
        if ($clients) {
            Write-Pass "Redis connected clients: $($clients.ToString().Split(':')[1])"
        }
    } else {
        Write-Fail "Redis is not responding"
    }
} catch {
    Write-Fail "Redis check failed: $_"
}
Write-Host ""

# Check NATS
Write-Host "🔍 Checking NATS..."
try {
    $natsConnection = Test-NetConnection -ComputerName localhost -Port 4222 -WarningAction SilentlyContinue
    if ($natsConnection.TcpTestSucceeded) {
        Write-Pass "NATS port 4222 is open"
    } else {
        Write-Fail "NATS port 4222 is not accessible"
    }
} catch {
    Write-Fail "NATS check failed: $_"
}
Write-Host ""

# Check Meilisearch
Write-Host "🔍 Checking Meilisearch..."
try {
    $response = Invoke-WebRequest -Uri "http://localhost:7700/health" -UseBasicParsing -TimeoutSec 5
    if ($response.StatusCode -eq 200) {
        Write-Pass "Meilisearch health endpoint is responding"
    } else {
        Write-Fail "Meilisearch returned HTTP $($response.StatusCode)"
    }
} catch {
    Write-Fail "Meilisearch is not responding on port 7700"
}
Write-Host ""

# Check Caddy
Write-Host "🔍 Checking Caddy Proxy..."
try {
    $response = Invoke-WebRequest -Uri "http://localhost:8080/health" -UseBasicParsing -TimeoutSec 5
    if ($response.StatusCode -eq 200) {
        Write-Pass "Caddy proxy is responding on port 8080"
    } else {
        Write-Fail "Caddy returned HTTP $($response.StatusCode)"
    }
} catch {
    Write-Fail "Caddy proxy is not responding on port 8080"
}
Write-Host ""

# Summary
Write-Host "=========================================="
Write-Host "Health Check Summary"
Write-Host "=========================================="
Write-Host "$GreenPassed: $script:Passed$Reset"
Write-Host "$RedFailed: $script:Failed$Reset"
Write-Host "$YellowWarnings: $script:Warnings$Reset"
Write-Host ""

if ($script:Failed -eq 0) {
    Write-Host "$Green✅ All critical checks passed!$Reset"
    exit 0
} else {
    Write-Host "$Red❌ Some critical checks failed. Please review.$Reset"
    exit 1
}

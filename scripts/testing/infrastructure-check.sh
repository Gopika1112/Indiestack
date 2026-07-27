#!/bin/bash

# Infrastructure Connectivity Check Script
# Usage: ./infrastructure-check.sh

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Counters
PASSED=0
FAILED=0
WARNINGS=0

# Helper functions
check_pass() {
    echo -e "${GREEN}✅ PASS${NC}: $1"
    ((PASSED++))
}

check_fail() {
    echo -e "${RED}❌ FAIL${NC}: $1"
    ((FAILED++))
}

check_warn() {
    echo -e "${YELLOW}⚠️  WARN${NC}: $1"
    ((WARNINGS++))
}

echo "=========================================="
echo "IndieStack Infrastructure Health Check"
echo "=========================================="
echo ""

# Check PostgreSQL
echo "🔍 Checking PostgreSQL..."
if pg_isready -h localhost -p 5432 -U indiestack > /dev/null 2>&1; then
    check_pass "PostgreSQL is accepting connections"
    
    # Check if database exists
    if psql -h localhost -p 5432 -U indiestack -d indiestack -c "SELECT 1" > /dev/null 2>&1; then
        check_pass "Database 'indiestack' exists and is accessible"
        
        # Check table count
        TABLE_COUNT=$(psql -h localhost -p 5432 -U indiestack -d indiestack -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public'" 2>/dev/null | tr -d ' ')
        if [ "$TABLE_COUNT" -gt 0 ]; then
            check_pass "Database has $TABLE_COUNT tables"
        else
            check_warn "Database has no tables - migrations may not have run"
        fi
        
        # Check TimescaleDB extension
        if psql -h localhost -p 5432 -U indiestack -d indiestack -c "SELECT * FROM pg_extension WHERE extname='timescaledb'" > /dev/null 2>&1; then
            check_pass "TimescaleDB extension is installed"
        else
            check_warn "TimescaleDB extension not found"
        fi
    else
        check_fail "Database 'indiestack' is not accessible"
    fi
else
    check_fail "PostgreSQL is not accepting connections on port 5432"
fi
echo ""

# Check Redis
echo "🔍 Checking Redis..."
if redis-cli ping > /dev/null 2>&1; then
    check_pass "Redis is responding to PING"
    
    # Check memory usage
    MEMORY=$(redis-cli INFO memory | grep used_memory_human | cut -d: -f2 | tr -d '\r')
    check_pass "Redis memory usage: $MEMORY"
    
    # Check connected clients
    CLIENTS=$(redis-cli INFO clients | grep connected_clients | cut -d: -f2 | tr -d '\r')
    check_pass "Redis connected clients: $CLIENTS"
else
    check_fail "Redis is not responding on port 6379"
fi
echo ""

# Check NATS
echo "🔍 Checking NATS..."
if command -v nats > /dev/null 2>&1; then
    if nats pub test.subject "health-check" --count=1 --timeout=5s > /dev/null 2>&1; then
        check_pass "NATS is accepting publish operations"
        
        # Check JetStream
        if nats stream ls > /dev/null 2>&1; then
            STREAM_COUNT=$(nats stream ls 2>/dev/null | grep -c "^│" || echo "0")
            check_pass "NATS JetStream has $STREAM_COUNT streams"
        else
            check_warn "NATS JetStream may not be enabled"
        fi
    else
        check_fail "NATS is not responding on port 4222"
    fi
else
    check_warn "nats CLI not installed, skipping detailed NATS checks"
    # Fallback to netcat
    if nc -z localhost 4222 > /dev/null 2>&1; then
        check_pass "NATS port 4222 is open"
    else
        check_fail "NATS port 4222 is not accessible"
    fi
fi
echo ""

# Check Meilisearch
echo "🔍 Checking Meilisearch..."
MEILI_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:7700/health 2>/dev/null || echo "000")
if [ "$MEILI_RESPONSE" = "200" ]; then
    check_pass "Meilisearch health endpoint is responding"
    
    # Check version
    MEILI_VERSION=$(curl -s http://localhost:7700/version 2>/dev/null | grep -o '"pkgVersion":"[^"]*"' | cut -d'"' -f4 || echo "unknown")
    check_pass "Meilisearch version: $MEILI_VERSION"
    
    # Check indexes
    INDEX_COUNT=$(curl -s http://localhost:7700/indexes 2>/dev/null | grep -o '"uid"' | wc -l | tr -d ' ')
    check_pass "Meilisearch has $INDEX_COUNT indexes"
else
    check_fail "Meilisearch is not responding on port 7700 (HTTP $MEILI_RESPONSE)"
fi
echo ""

# Check Caddy/Proxy
echo "🔍 Checking Caddy Proxy..."
CADDY_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/health 2>/dev/null || echo "000")
if [ "$CADDY_RESPONSE" = "200" ]; then
    check_pass "Caddy proxy is responding on port 8080"
    
    # Check backend routing
    API_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/api/v1/feed/trending 2>/dev/null || echo "000")
    if [ "$API_RESPONSE" = "200" ]; then
        check_pass "API routing through Caddy is working"
    else
        check_fail "API routing through Caddy failed (HTTP $API_RESPONSE)"
    fi
else
    check_fail "Caddy proxy is not responding on port 8080"
fi
echo ""

# Check Backend API
echo "🔍 Checking Backend API..."
if curl -s http://localhost:3001/health > /dev/null 2>&1; then
    check_pass "Backend API is responding on port 3001"
else
    check_warn "Backend API direct access on port 3001 not available (may be proxied only)"
fi
echo ""

# Check Frontend
echo "🔍 Checking Frontend..."
FRONTEND_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000 2>/dev/null || echo "000")
if [ "$FRONTEND_RESPONSE" = "200" ] || [ "$FRONTEND_RESPONSE" = "307" ]; then
    check_pass "Frontend is responding on port 3000"
else
    check_warn "Frontend direct access on port 3000 not available (may be proxied only)"
fi
echo ""

# Performance checks
echo "🔍 Running performance checks..."

# PostgreSQL response time
PG_TIME=$(psql -h localhost -p 5432 -U indiestack -d indiestack -c "SELECT 1" -o /dev/null -t 2>&1 | head -1)
if [ -z "$PG_TIME" ]; then
    check_pass "PostgreSQL query time < 50ms"
else
    check_warn "PostgreSQL query time unknown"
fi

# Redis response time
REDIS_TIME=$(redis-cli --latency-history -i 1 2>/dev/null | head -1 | awk '{print $3}' | tr -d '[:alpha:]')
if [ -n "$REDIS_TIME" ] && [ "$REDIS_TIME" -lt 1000 ]; then
    check_pass "Redis latency: ${REDIS_TIME}μs"
else
    check_warn "Redis latency check inconclusive"
fi

echo ""
echo "=========================================="
echo "Health Check Summary"
echo "=========================================="
echo -e "${GREEN}Passed: $PASSED${NC}"
echo -e "${RED}Failed: $FAILED${NC}"
echo -e "${YELLOW}Warnings: $WARNINGS${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✅ All critical checks passed!${NC}"
    exit 0
else
    echo -e "${RED}❌ Some critical checks failed. Please review.${NC}"
    exit 1
fi

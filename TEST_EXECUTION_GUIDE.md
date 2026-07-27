# IndieStack Test Execution Guide

## Overview

This guide provides step-by-step instructions for executing the complete test suite for IndieStack, covering E2E wiring, security, load testing, and production readiness validation.

## Prerequisites

### Required Tools

```bash
# Go toolchain
go version  # 1.21+

# Node.js
node --version  # 20+
npm --version   # 9+

# Docker & Docker Compose
docker --version
docker-compose --version

# k6 for load testing
k6 version

# PostgreSQL client
psql --version

# Redis client
redis-cli --version
```

### Install Missing Tools

```bash
# macOS
brew install go node k6 postgresql redis

# Ubuntu/Debian
sudo apt-get update
sudo apt-get install -y golang-go nodejs postgresql-client redis-tools

# Install k6
sudo apt-key adv --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update
sudo apt-get install k6
```

---

## Test Categories

### 1. Infrastructure Connectivity Tests

**Purpose:** Verify all services are running and accessible.

**Execution:**

```bash
# Make script executable
chmod +x scripts/testing/infrastructure-check.sh

# Run health check
./scripts/testing/infrastructure-check.sh

# Or on Windows
.\scripts\testing\infrastructure-check.ps1
```

**Expected Output:**
```
==========================================
IndieStack Infrastructure Health Check
==========================================

🔍 Checking PostgreSQL...
✅ PASS: PostgreSQL is accepting connections
✅ PASS: Database 'indiestack' exists and is accessible
✅ PASS: Database has 12 tables

🔍 Checking Redis...
✅ PASS: Redis is responding to PING
✅ PASS: Redis memory usage: 2.5M
✅ PASS: Redis connected clients: 5

...
==========================================
Health Check Summary
==========================================
Passed: 15
Failed: 0
Warnings: 0

✅ All critical checks passed!
```

**Troubleshooting:**
- PostgreSQL not responding: `docker-compose restart postgres`
- Redis not responding: `docker-compose restart redis`
- Missing tables: Run migrations with `goose up`

---

### 2. Unit Tests

**Purpose:** Test individual functions and components in isolation.

**Execution:**

```bash
cd backend

# Run all unit tests
go test -v ./internal/... ./pkg/...

# Run with race detection
go test -race ./internal/...

# Run with coverage
go test -coverprofile=coverage.out ./...
go tool cover -html=coverage.out

# Run specific package
go test -v ./internal/handlers/...
```

**Expected Output:**
```
=== RUN   TestAuthHandler
=== RUN   TestAuthHandler/Register
=== RUN   TestAuthHandler/Login
--- PASS: TestAuthHandler (0.05s)
PASS
coverage: 85.3% of statements
```

**Coverage Requirements:**
- Minimum: 70%
- Target: 80%
- Excellent: 90%+

---

### 3. E2E Integration Tests

**Purpose:** Test complete user flows across the entire stack.

**Execution:**

```bash
# Start test infrastructure
docker-compose up -d postgres redis

# Wait for services
sleep 10

# Run migrations
cd backend
goose -dir sql/migrations postgres "postgres://indiestack:indiestack_secret@localhost:5432/indiestack_test?sslmode=disable" up

# Generate sqlc code
sqlc generate

# Run E2E tests
go test -v ./tests/e2e/...

# Run with custom test database
TEST_DATABASE_URL="postgres://indiestack:indiestack_secret@localhost:5432/indiestack_test?sslmode=disable" go test -v ./tests/e2e/...
```

**Test Scenarios Covered:**
- User registration → login → token refresh
- Post creation → update → publish → view
- Feed generation and retrieval
- Social features (follow/unfollow)

**Expected Duration:** 30-60 seconds

---

### 4. Security Tests

**Purpose:** Validate security controls and vulnerability protections.

**Execution:**

```bash
cd backend

# Run security test suite
go test -v ./tests/security/...

# Run with gosec scanner
gosec -fmt sarif -out security.sarif ./...

# Review security scan
cat security.sarif
```

**Security Tests Cover:**
- JWT token validation and tampering
- SQL injection prevention
- XSS payload handling
- Rate limiting effectiveness
- Authentication bypass attempts

**Critical Checks:**
- ✅ No `none` algorithm accepted
- ✅ Expired tokens rejected
- ✅ Tampered tokens rejected
- ✅ SQL injection sanitized
- ✅ XSS payloads escaped

---

### 5. Performance Benchmarks

**Purpose:** Measure database query performance and identify bottlenecks.

**Execution:**

```bash
cd backend

# Run all benchmarks
go test -bench=. -benchmem ./tests/performance/...

# Run specific benchmark
go test -bench=BenchmarkFeedGeneration -benchtime=10s

# Run with memory profiling
go test -bench=. -memprofile=mem.prof
go tool pprof mem.prof

# Run with CPU profiling
go test -bench=. -cpuprofile=cpu.prof
go tool pprof cpu.prof
```

**Expected Benchmark Results:**

| Benchmark | Target | Acceptable |
|-----------|--------|------------|
| FeedGeneration | < 10ms | < 50ms |
| PostCreation | < 50ms | < 100ms |
| UserLookup | < 5ms | < 20ms |
| TrendingPosts | < 20ms | < 100ms |

**Example Output:**
```
BenchmarkFeedGeneration-8    10000    10520 ns/op    2048 B/op    35 allocs/op
BenchmarkPostCreation-8       5000    45230 ns/op    8192 B/op    89 allocs/op
```

---

### 6. Load Tests

**Purpose:** Validate system behavior under 10k concurrent users.

#### Normal Load Test (500 users)

```bash
# Start the full stack
docker-compose up -d

# Wait for services
sleep 30

# Run normal load test
k6 run load-tests/normal-load.js

# With custom base URL
BASE_URL=http://localhost:8080 k6 run load-tests/normal-load.js

# With authentication
BASE_URL=http://localhost:8080 AUTH_TOKEN=your-jwt-token k6 run load-tests/normal-load.js
```

**Expected Results:**
- p95 latency < 500ms
- Error rate < 0.1%
- Feed load time < 100ms
- Post load time < 200ms

#### Peak Load Test (10k users)

```bash
# Run peak load test (warning: resource intensive)
k6 run load-tests/peak-load.js

# Run with distributed execution
k6 run --out influxdb=http://localhost:8086/k6 load-tests/peak-load.js
```

**Duration:** ~27 minutes

**Success Criteria:**
- System remains stable at 10k users
- p95 latency < 1000ms
- p99 latency < 2000ms
- Error rate < 5%
- No service crashes

#### Image Upload Stress Test

```bash
# Get auth token first
export AUTH_TOKEN=$(curl -s -X POST http://localhost:8080/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"testpass"}' | jq -r '.data.tokens.access_token')

# Run image upload test
k6 run load-tests/image-upload-stress.js
```

**Expected Throughput:**
- 55 images/minute average
- 200 images/minute peak
- Upload time < 3s (p95)

---

### 7. Rate Limiting Tests

**Purpose:** Verify rate limiting protects against abuse.

```bash
k6 run load-tests/rate-limit-test.js
```

**Expected Behavior:**
- 5 login attempts per minute per IP
- 100 API requests per minute per user
- 429 status code with Retry-After header when exceeded

---

### 8. Frontend E2E Tests

**Purpose:** Test complete user journeys in the browser.

```bash
cd frontend

# Install dependencies
npm install

# Run Cypress tests (interactive)
npx cypress open

# Run Cypress tests (headless)
npx cypress run

# Run with specific browser
npx cypress run --browser chrome
```

**Test Scenarios:**
- User registration and onboarding
- Post creation with editor
- Feed navigation and interaction
- Profile management

---

## Test Execution Timeline

### Pre-Deployment Testing (Every Release)

```bash
# 1. Infrastructure (2 minutes)
./scripts/testing/infrastructure-check.sh

# 2. Unit Tests (5 minutes)
cd backend && go test ./internal/... ./pkg/...

# 3. Security Tests (3 minutes)
cd backend && go test ./tests/security/...
gosec ./...

# 4. E2E Tests (10 minutes)
cd backend && go test -v ./tests/e2e/...

# 5. Performance Benchmarks (5 minutes)
cd backend && go test -bench=. ./tests/performance/...

# Total: ~25 minutes
```

### Weekly Load Testing

```bash
# Full load test suite
k6 run load-tests/normal-load.js
k6 run load-tests/peak-load.js
k6 run load-tests/rate-limit-test.js

# Total: ~45 minutes
```

### Monthly Chaos Testing

```bash
# Test resilience
./scripts/testing/chaos-test.sh

# Includes:
# - Database failover
# - Redis failure
# - Network partitions
# - Service restarts
```

---

## Interpreting Results

### Load Test Metrics

```
http_req_duration..............: avg=125ms  min=10ms   med=95ms   max=2.5s   p(90)=200ms  p(95)=350ms
http_req_failed................: 0.05%   ✓ 45       ✗ 89955
http_reqs......................: 90000   1666.67/s

iteration_duration.............: avg=1.2s   min=1s     med=1.15s  max=3.5s
iterations.....................: 30000   555.56/s
```

**Analysis:**
- ✅ Average response time good (125ms)
- ⚠️ p95 slightly high (350ms) - investigate
- ✅ Error rate acceptable (0.05%)
- ✅ Throughput healthy (1666 req/s)

### Benchmark Analysis

```
BenchmarkFeedGeneration-8    10000    10520 ns/op    2048 B/op    35 allocs/op
```

**Interpretation:**
- 10,000 iterations
- 10.52 microseconds per operation
- 2,048 bytes allocated per operation
- 35 heap allocations per operation

**Optimization Targets:**
- Reduce allocations (currently 35)
- Consider pooling for high-frequency operations

---

## Troubleshooting Common Issues

### Database Connection Errors

```
dial tcp localhost:5432: connect: connection refused
```

**Solution:**
```bash
docker-compose up -d postgres
# Wait 10 seconds
sleep 10
# Verify
pg_isready -h localhost -p 5432
```

### Migration Failures

```
ERROR: relation "users" already exists
```

**Solution:**
```bash
# Reset test database
docker-compose exec postgres dropdb -U indiestack indiestack_test
docker-compose exec postgres createdb -U indiestack indiestack_test

# Re-run migrations
cd backend
goose -dir sql/migrations postgres "postgres://indiestack:indiestack_secret@localhost:5432/indiestack_test?sslmode=disable" up
```

### Rate Limit Test Failures

```
rate limited correctly: failed
```

**Solution:**
```bash
# Clear Redis
redis-cli FLUSHALL

# Restart rate limiting
```

### Load Test Connection Errors

```
connection reset by peer
```

**Solution:**
```bash
# Increase system limits
ulimit -n 65535

# Check Docker resource limits
docker system info | grep -i memory
```

---

## Test Data Management

### Seeding Test Data

```bash
cd backend

# Run seed script
go run scripts/seed.go

# Or use SQL
psql -h localhost -U indiestack -d indiestack_test < scripts/seed.sql
```

### Cleaning Test Data

```bash
# Clean specific tables
psql -h localhost -U indiestack -d indiestack_test -c "TRUNCATE posts, follows CASCADE;"

# Clean all test data
psql -h localhost -U indiestack -d indiestack_test -c "TRUNCATE users, posts, follows, newsletter_subscriptions CASCADE;"
```

---

## CI/CD Integration

### GitHub Actions

Tests run automatically on:
- Push to `main` or `develop`
- Pull requests to `main`
- Daily at 2 AM UTC (scheduled)

### Local Pre-commit Hook

```bash
#!/bin/bash
# .git/hooks/pre-commit

echo "Running pre-commit tests..."

# Quick unit tests
cd backend && go test ./internal/... || exit 1

# Type check
cd frontend && npm run type-check || exit 1

echo "Pre-commit tests passed!"
```

---

## Test Coverage Reporting

### Generate Coverage Report

```bash
cd backend

# Run tests with coverage
go test -coverprofile=coverage.out ./...

# View HTML report
go tool cover -html=coverage.out -o coverage.html
open coverage.html

# View function coverage
go tool cover -func=coverage.out
```

### Coverage Thresholds

| Package | Minimum | Target |
|---------|---------|--------|
| handlers | 80% | 90% |
| services | 75% | 85% |
| repository | 70% | 80% |
| middleware | 85% | 95% |

---

## Continuous Monitoring

### Production Health Checks

```bash
# Run continuously in production
while true; do
  ./scripts/testing/infrastructure-check.sh
  sleep 300  # Every 5 minutes
done
```

### Performance Regression Detection

```bash
# Compare benchmark results
benchcmp old.txt new.txt

# Alert if degradation > 10%
```

---

## Summary

**Quick Reference Commands:**

```bash
# Full test suite
./scripts/testing/run-all-tests.sh

# Quick smoke test
./scripts/testing/infrastructure-check.sh && go test ./backend/internal/...

# Load test
k6 run load-tests/normal-load.js

# Security scan
gosec ./backend/...
```

**Emergency Contacts:**
- On-call Engineer: [TBD]
- Engineering Lead: [TBD]
- Infrastructure: [TBD]

---

*Last Updated: 2024*
*Version: 1.0*

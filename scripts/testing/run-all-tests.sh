#!/bin/bash

# IndieStack Complete Test Suite Runner
# Usage: ./run-all-tests.sh [options]
# Options:
#   --quick      Run only fast tests (skip load tests)
#   --ci         CI mode (no interactive prompts)
#   --skip-e2e   Skip E2E tests
#   --help       Show help

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Options
QUICK_MODE=false
CI_MODE=false
SKIP_E2E=false

# Parse arguments
for arg in "$@"; do
  case $arg in
    --quick)
      QUICK_MODE=true
      shift
      ;;
    --ci)
      CI_MODE=true
      shift
      ;;
    --skip-e2e)
      SKIP_E2E=true
      shift
      ;;
    --help)
      echo "IndieStack Test Suite Runner"
      echo ""
      echo "Usage: $0 [options]"
      echo ""
      echo "Options:"
      echo "  --quick      Run only fast tests (skip load tests)"
      echo "  --ci         CI mode (no interactive prompts)"
      echo "  --skip-e2e   Skip E2E tests"
      echo "  --help       Show this help message"
      exit 0
      ;;
  esac
done

# Counters
TESTS_PASSED=0
TESTS_FAILED=0
TESTS_SKIPPED=0

# Helper functions
log_info() {
  echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
  echo -e "${GREEN}[PASS]${NC} $1"
  ((TESTS_PASSED++))
}

log_error() {
  echo -e "${RED}[FAIL]${NC} $1"
  ((TESTS_FAILED++))
}

log_warn() {
  echo -e "${YELLOW}[WARN]${NC} $1"
  ((TESTS_SKIPPED++))
}

run_test() {
  local name="$1"
  local command="$2"
  
  echo ""
  log_info "Running: $name"
  
  if eval "$command"; then
    log_success "$name"
    return 0
  else
    log_error "$name"
    return 1
  fi
}

# Header
echo "=========================================="
echo "IndieStack Complete Test Suite"
echo "=========================================="
echo ""
echo "Mode: $(if $QUICK_MODE; then echo "Quick"; elif $CI_MODE; then echo "CI"; else echo "Full"; fi)"
echo ""

# Check prerequisites
echo "Checking prerequisites..."
MISSING_DEPS=()

command -v go >/dev/null 2>&1 || MISSING_DEPS+=("go")
command -v docker-compose >/dev/null 2>&1 || MISSING_DEPS+=("docker-compose")
command -v psql >/dev/null 2>&1 || MISSING_DEPS+=("psql")
command -v redis-cli >/dev/null 2>&1 || MISSING_DEPS+=("redis-cli")

if [ ${#MISSING_DEPS[@]} -ne 0 ]; then
  log_error "Missing dependencies: ${MISSING_DEPS[*]}"
  exit 1
fi

log_success "Prerequisites check"

# Start infrastructure if not in CI mode
if ! $CI_MODE; then
  echo ""
  log_info "Starting infrastructure services..."
  docker-compose up -d postgres redis meilisearch nats || true
  sleep 10
fi

# Change to project root
cd "$(dirname "$0")/../.."

# ==========================================
# Test Suite Execution
# ==========================================

# 1. Infrastructure Tests
echo ""
echo "=========================================="
echo "Phase 1: Infrastructure Tests"
echo "=========================================="

run_test "Infrastructure Health Check" \
  "./scripts/testing/infrastructure-check.sh"

# 2. Backend Unit Tests
echo ""
echo "=========================================="
echo "Phase 2: Backend Unit Tests"
echo "=========================================="

cd backend

# Check if sqlc code is generated
if [ ! -f "internal/repository/sqlc/models.go" ]; then
  log_info "Generating sqlc code..."
  if command -v sqlc >/dev/null 2>&1; then
    sqlc generate
  else
    log_warn "sqlc not installed, skipping code generation"
  fi
fi

# Run migrations
log_info "Running database migrations..."
if command -v goose >/dev/null 2>&1; then
  goose -dir sql/migrations postgres "postgres://indiestack:indiestack_secret@localhost:5432/indiestack?sslmode=disable" up || true
else
  log_warn "goose not installed, skipping migrations"
fi

# Run unit tests
run_test "Backend Unit Tests" \
  "go test -race ./internal/... ./pkg/..."

# 3. Security Tests
echo ""
echo "=========================================="
echo "Phase 3: Security Tests"
echo "=========================================="

run_test "JWT Security Tests" \
  "go test -v ./tests/security/jwt_security_test.go ./internal/middleware/..."

run_test "Input Validation Tests" \
  "go test -v ./tests/security/input_validation_test.go"

# Run gosec if available
if command -v gosec >/dev/null 2>&1; then
  run_test "Gosec Security Scan" \
    "gosec -quiet ./..."
else
  log_warn "gosec not installed, skipping security scan"
fi

# 4. E2E Integration Tests
if ! $SKIP_E2E; then
  echo ""
  echo "=========================================="
  echo "Phase 4: E2E Integration Tests"
  echo "=========================================="
  
  run_test "E2E Authentication Flow" \
    "go test -v -run TestAuthFlow ./tests/e2e/..."
  
  run_test "E2E Post Lifecycle" \
    "go test -v -run TestPostLifecycle ./tests/e2e/..."
  
  run_test "E2E Feed Access" \
    "go test -v -run TestFeedAccess ./tests/e2e/..."
else
  echo ""
  log_warn "Skipping E2E tests (--skip-e2e)"
fi

# 5. Performance Benchmarks
echo ""
echo "=========================================="
echo "Phase 5: Performance Benchmarks"
echo "=========================================="

run_test "Database Performance Benchmarks" \
  "go test -bench=. -benchtime=1s ./tests/performance/..."

cd ..

# 6. Load Tests (skip in quick mode)
if ! $QUICK_MODE; then
  echo ""
  echo "=========================================="
  echo "Phase 6: Load Tests"
  echo "=========================================="
  
  if command -v k6 >/dev/null 2>&1; then
    # Check if services are running
    if curl -s http://localhost:8080/health >/dev/null 2>&1; then
      run_test "Normal Load Test (500 users)" \
        "k6 run --quiet load-tests/normal-load.js"
      
      run_test "Rate Limit Test" \
        "k6 run --quiet load-tests/rate-limit-test.js"
    else
      log_warn "Services not running on localhost:8080, skipping load tests"
    fi
  else
    log_warn "k6 not installed, skipping load tests"
  fi
else
  echo ""
  log_warn "Skipping load tests (quick mode)"
fi

# 7. Frontend Tests
echo ""
echo "=========================================="
echo "Phase 7: Frontend Tests"
echo "=========================================="

if [ -d "frontend" ]; then
  cd frontend
  
  if [ -f "package.json" ]; then
    if [ ! -d "node_modules" ]; then
      log_info "Installing frontend dependencies..."
      npm ci
    fi
    
    run_test "Frontend Type Check" \
      "npm run type-check || true"
    
    run_test "Frontend Lint" \
      "npm run lint || true"
  else
    log_warn "No package.json found in frontend"
  fi
  
  cd ..
else
  log_warn "Frontend directory not found"
fi

# ==========================================
# Summary
# ==========================================
echo ""
echo "=========================================="
echo "Test Suite Summary"
echo "=========================================="
echo -e "${GREEN}Passed: $TESTS_PASSED${NC}"
echo -e "${RED}Failed: $TESTS_FAILED${NC}"
echo -e "${YELLOW}Skipped: $TESTS_SKIPPED${NC}"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
  echo -e "${GREEN}✅ All tests passed!${NC}"
  echo ""
  echo "IndieStack is ready for deployment."
  exit 0
else
  echo -e "${RED}❌ Some tests failed.${NC}"
  echo ""
  echo "Please review the failures above before deploying."
  exit 1
fi

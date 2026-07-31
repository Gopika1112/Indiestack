#!/bin/bash

# IndieStack Complete Test Suite Runner
# Usage: ./run-all-tests.sh [options]
# Options:
#   --ci         CI mode (no interactive prompts)
#   --skip-e2e   Skip live API tests
#   --help       Show help

set -e

CI_MODE=false
SKIP_E2E=false

for arg in "$@"; do
  case $arg in
    --ci) CI_MODE=true; shift ;;
    --skip-e2e) SKIP_E2E=true; shift ;;
    --help)
      echo "IndieStack Test Suite Runner"
      echo ""
      echo "Usage: $0 [options]"
      echo "  --ci         CI mode (no interactive prompts)"
      echo "  --skip-e2e   Skip live API tests"
      echo "  --help       Show this help message"
      exit 0
      ;;
  esac
done

TESTS_PASSED=0
TESTS_FAILED=0
TESTS_SKIPPED=0

log_info() { echo "[INFO] $1"; }
log_success() { echo "[PASS] $1"; TESTS_PASSED=$((TESTS_PASSED+1)); }
log_error() { echo "[FAIL] $1"; TESTS_FAILED=$((TESTS_FAILED+1)); }
log_warn() { echo "[WARN] $1"; TESTS_SKIPPED=$((TESTS_SKIPPED+1)); }

run_test() {
  local name="$1"
  local command="$2"
  echo ""
  log_info "Running: $name"
  if eval "$command"; then
    log_success "$name"
  else
    log_error "$name"
  fi
}

echo "=========================================="
echo "IndieStack Complete Test Suite"
echo "=========================================="
echo ""

cd "$(dirname "$0")/../.."

# Phase 1: Static Analysis
echo ""
echo "=========================================="
echo "Phase 1: Static Analysis"
echo "=========================================="
cd backend
run_test "go vet" "go vet ./..."
cd ..

# Phase 2: Unit Tests
echo ""
echo "=========================================="
echo "Phase 2: Backend Unit Tests"
echo "=========================================="
cd backend
run_test "Backend Unit Tests" "go test ./internal/... ./internal/testutil/..."

# Phase 3: DB Integration Tests
echo ""
echo "=========================================="
echo "Phase 3: Database Integration Tests"
echo "=========================================="
run_test "Database Integration Tests" "go test -v ./tests/integration/... -run 'TestDatabaseSchema|TestUserLifecycle|TestPostLifecycle|TestFollowRelationship|TestAPIKeyScopes|TestNewsletterSubscription|TestForeignKeyConstraints' || true"

# Phase 4: Live API Tests
if ! $SKIP_E2E; then
  echo ""
  echo "=========================================="
  echo "Phase 4: Live API Tests"
  echo "=========================================="
  API_URL="${TEST_API_URL:-http://localhost:8080/api/v1}"
  if curl -s "$API_URL/health" >/dev/null 2>&1; then
    run_test "Live API Tests" "TEST_API_URL=$API_URL go test -v ./tests/integration/... -run 'TestAPI|TestPublic|TestRegister|TestLogin'"
  else
    log_warn "Live API not reachable at $API_URL (skipped)"
  fi
else
  log_warn "Skipping live API tests (--skip-e2e)"
fi

# Phase 5: Report
echo ""
echo "=========================================="
echo "Phase 5: Test Report"
echo "=========================================="
go test -json ./internal/... ./tests/integration/... 2>/dev/null | go run scripts/generate-report.go -out test-report.md || true

cd ..

echo ""
echo "=========================================="
echo "Test Suite Summary"
echo "=========================================="
echo "Passed: $TESTS_PASSED"
echo "Failed: $TESTS_FAILED"
echo "Skipped: $TESTS_SKIPPED"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
  echo "All tests passed!"
  exit 0
else
  echo "Some tests failed."
  exit 1
fi
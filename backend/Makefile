# Makefile for IndieStack backend testing and quality assurance

.PHONY: test unit integration coverage clean lint security report

GO := go
TEST_DB_URL ?= postgres://indiestack:indiestack_secret@localhost:5432/indiestack_test?sslmode=disable
TEST_API_URL ?= http://localhost:8080/api/v1

## Run all backend tests
unit:
	$(GO) test -v ./internal/... ./internal/testutil/...

## Run integration tests (requires PostgreSQL on TEST_DB_URL)
integration:
	DATABASE_URL=$(TEST_DB_URL) TEST_DATABASE_URL=$(TEST_DB_URL) $(GO) test -v ./tests/integration/...

## Run API tests (requires running API server)
api:
	TEST_API_URL=http://localhost:8080/api/v1 $(GO) test -v ./tests/integration/... -run 'TestAPI|TestPublic|TestRegister|TestLogin'

## Run the full backend test suite
test: unit integration

## Generate per-package coverage summary
coverage:
	$(GO) test -cover ./internal/... ./tests/integration/...

## Run go vet
lint:
	$(GO) vet ./...

## Run tests with race detector
race:
	$(GO) test -race ./internal/... ./tests/integration/...

## Clean test artifacts
clean:
	rm -f coverage.out coverage.html test-report.md

## Generate markdown test report
report:
	DATABASE_URL=$(TEST_DB_URL) TEST_DATABASE_URL=$(TEST_DB_URL) TEST_API_URL=$(TEST_API_URL) \
	$(GO) test -json ./internal/validate/... ./internal/auth/... ./internal/testutil/... ./tests/integration/... \
	| $(GO) run scripts/generate-report.go -out test-report.md

# Development script for backend

$env:APP_ENV = "development"
$env:SERVER_PORT = "3001"
$env:DATABASE_URL = "postgres://indiestack:indiestack_secret@localhost:5432/indiestack?sslmode=disable"
$env:REDIS_URL = "localhost:6379"
$env:JWT_SECRET = "dev-secret-key"
$env:JWT_REFRESH_SECRET = "dev-refresh-secret"

Write-Host "🚀 Starting backend in development mode..." -ForegroundColor Green
Set-Location backend
go run cmd/api/main.go

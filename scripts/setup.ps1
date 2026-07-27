# IndieStack Setup Script for Windows

Write-Host "🚀 Setting up IndieStack..." -ForegroundColor Green

# Check if Docker is installed
try {
    docker version | Out-Null
} catch {
    Write-Host "❌ Docker is not installed. Please install Docker first." -ForegroundColor Red
    exit 1
}

# Create .env file if it doesn't exist
if (-not (Test-Path .env)) {
    Write-Host "📝 Creating .env file..." -ForegroundColor Yellow
    Copy-Item .env.example .env
    Write-Host "✅ Created .env file. Please edit it with your configuration." -ForegroundColor Green
}

# Create necessary directories
Write-Host "📁 Creating directories..." -ForegroundColor Yellow
New-Item -ItemType Directory -Force -Path data/postgres, data/redis, data/meilisearch, data/nats | Out-Null

# Start infrastructure services first
Write-Host "🐳 Starting infrastructure services..." -ForegroundColor Yellow
docker-compose up -d postgres redis meilisearch nats

# Wait for PostgreSQL to be ready
Write-Host "⏳ Waiting for PostgreSQL..." -ForegroundColor Yellow
Start-Sleep -Seconds 10

Write-Host ""
Write-Host "✅ Infrastructure services are starting up!" -ForegroundColor Green
Write-Host ""
Write-Host "📍 Access points:" -ForegroundColor Cyan
Write-Host "   - Frontend: http://localhost:8080"
Write-Host "   - API: http://localhost:8080/api/v1"
Write-Host "   - MeiliSearch: http://localhost:7700"
Write-Host ""
Write-Host "📋 Next steps:" -ForegroundColor Yellow
Write-Host "   1. Edit .env file with your configuration"
Write-Host "   2. Run: docker-compose up -d --build"
Write-Host "   3. Set up Razorpay keys for payments"
Write-Host "   4. Configure SMTP for email notifications"
Write-Host ""

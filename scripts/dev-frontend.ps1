# Development script for frontend

$env:NEXT_PUBLIC_API_URL = "http://localhost:8080/api/v1"

Write-Host "🚀 Starting frontend in development mode..." -ForegroundColor Green
Set-Location frontend
npm install
npm run dev

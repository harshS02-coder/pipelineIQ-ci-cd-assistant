# PowerShell script to start development environment

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "🚀 Starting DevOps Failure Assistant Dev Setup" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

# Check if docker is running
Write-Host "Checking Docker status..." -ForegroundColor Yellow
docker info > $null 2>&1
if ($LastExitCode -ne 0) {
    Write-Error "Docker Desktop or Daemon is not running. Please start Docker and try again."
    Exit 1
}

# Start MongoDB and Redis containers
Write-Host "Spinning up MongoDB and Redis in Docker..." -ForegroundColor Yellow
docker-compose up -d mongodb redis

if ($LastExitCode -ne 0) {
    Write-Error "Failed to start Docker containers."
    Exit 1
}

Write-Host "Waiting for containers to be healthy..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

# Install packages
Write-Host "Installing dependencies (including pino-pretty)..." -ForegroundColor Yellow
npm install

# Start local server
Write-Host "Starting Express server locally..." -ForegroundColor Green
Write-Host "Press Ctrl+C to stop the server" -ForegroundColor Cyan
npm run dev

#!/bin/bash
# IndieStack deployment script for pod21 server
# Run this on the server after uploading the code

set -e

echo "=== IndieStack Deployment ==="

# Navigate to project directory
cd ~/indiestack

# Stop any existing containers
echo "Stopping existing containers..."
docker compose down 2>/dev/null || true

# Build and start all services
echo "Building and starting services..."
docker compose up -d --build

# Wait for services to be healthy
echo "Waiting for services to start..."
sleep 15

# Check if services are running
echo "Checking service status..."
docker compose ps

# Apply database migrations (if needed)
echo "Applying database migrations..."
docker exec indiestack-postgres psql -U indiestack -d indiestack -f /docker-entrypoint-initdb.d/013_seed_data.sql 2>/dev/null || echo "Seed data already applied or not needed"

echo "=== Deployment complete ==="
echo "Site should be accessible at https://tech.namahos.com"
echo ""
echo "To view logs: docker compose logs -f"
echo "To restart: docker compose restart"
echo "To stop: docker compose down"

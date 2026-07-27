#!/bin/bash
# Initial setup script for IndieStack
# Usage: ./scripts/setup.sh

set -e

echo "🚀 IndieStack Initial Setup"
echo "============================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if .env exists
if [ -f .env ]; then
    echo -e "${YELLOW}⚠️  .env file already exists. Skipping creation.${NC}"
else
    echo "📝 Creating .env file from .env.example..."
    cp .env.example .env
    echo -e "${GREEN}✅ .env file created${NC}"
    echo ""
    echo -e "${YELLOW}⚠️  IMPORTANT: Edit .env and update the following secrets:${NC}"
    echo "  - POSTGRES_PASSWORD"
    echo "  - JWT_SECRET (generate with: openssl rand -base64 32)"
    echo "  - JWT_REFRESH_SECRET (different from JWT_SECRET)"
    echo "  - ADMIN_PASSWORD"
    echo "  - MEILI_MASTER_KEY"
    echo ""
fi

# Check for required tools
echo "🔧 Checking required tools..."

if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker is not installed${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Docker found${NC}"

if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    echo -e "${RED}❌ Docker Compose is not installed${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Docker Compose found${NC}"

# Generate secrets if openssl is available
if command -v openssl &> /dev/null; then
    echo ""
    echo "🔐 Generated secret suggestions:"
    echo "  JWT_SECRET=$(openssl rand -base64 32)"
    echo "  JWT_REFRESH_SECRET=$(openssl rand -base64 32)"
    echo "  MEILI_MASTER_KEY=$(openssl rand -base64 16)"
    echo ""
    echo -e "${YELLOW}Copy these to your .env file!${NC}"
fi

# Create necessary directories
echo "📁 Creating necessary directories..."
mkdir -p data/postgres data/redis data/meilisearch data/nats
echo -e "${GREEN}✅ Directories created${NC}"

# Check for pre-commit hook
if [ -f .git/hooks/pre-commit ]; then
    echo -e "${GREEN}✅ Pre-commit hook already installed${NC}"
else
    echo "🔒 Installing pre-commit hook..."
    cp scripts/hooks/pre-commit .git/hooks/pre-commit
    chmod +x .git/hooks/pre-commit
    echo -e "${GREEN}✅ Pre-commit hook installed${NC}"
fi

# Install detect-secrets if Python/pip available
if command -v pip &> /dev/null; then
    if ! command -v detect-secrets &> /dev/null; then
        echo "📦 Installing detect-secrets..."
        pip install detect-secrets || echo -e "${YELLOW}⚠️  Could not install detect-secrets. Install manually: pip install detect-secrets${NC}"
    else
        echo -e "${GREEN}✅ detect-secrets already installed${NC}"
    fi
fi

echo ""
echo -e "${GREEN}🎉 Setup complete!${NC}"
echo ""
echo "Next steps:"
echo "  1. Edit .env with your secrets"
echo "  2. Start services: docker-compose up -d"
echo "  3. Check health: curl http://localhost:8080/health"
echo ""

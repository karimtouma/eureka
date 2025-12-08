#!/bin/bash
set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}🚀 Deploying Eureka...${NC}"

# Navigate to project directory
cd /home/ubuntu/workspace/eureka_app

# Pull latest changes
echo -e "${YELLOW}📥 Pulling latest changes...${NC}"
git pull origin main

# Build and start containers
echo -e "${YELLOW}🔨 Building containers...${NC}"
sudo docker compose -f docker-compose.prod.yml build

echo -e "${YELLOW}🐳 Starting containers...${NC}"
sudo docker compose -f docker-compose.prod.yml up -d

# Cleanup
echo -e "${YELLOW}🧹 Cleaning up...${NC}"
sudo docker system prune -f

# Health check
echo -e "${YELLOW}❤️ Checking health...${NC}"
sleep 5

if curl -s http://localhost:3080/eureka/health | grep -q "healthy"; then
    echo -e "${GREEN}✅ Deployment successful!${NC}"
    echo -e "${GREEN}   Frontend: http://localhost:3080/eureka${NC}"
    echo -e "${GREEN}   API Docs: http://localhost:3080/eureka/api/docs${NC}"
else
    echo -e "${RED}❌ Health check failed. Checking logs...${NC}"
    sudo docker compose -f docker-compose.prod.yml logs --tail=50
    exit 1
fi

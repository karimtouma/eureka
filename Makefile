# Eureka - Symbolic Regression with Genetic Programming
# Makefile for development and production

.PHONY: dev prod clean build rebuild logs shell-frontend shell-backend help

# Colors for terminal output
CYAN := \033[0;36m
GREEN := \033[0;32m
YELLOW := \033[0;33m
NC := \033[0m

# Default target
help:
	@echo ""
	@echo "$(CYAN)Eureka - Available Commands$(NC)"
	@echo "────────────────────────────────────────"
	@echo "  $(GREEN)make dev$(NC)       - Start development environment"
	@echo "  $(GREEN)make prod$(NC)      - Start production environment"
	@echo "  $(GREEN)make build$(NC)     - Build containers without cache"
	@echo "  $(GREEN)make rebuild$(NC)   - Full rebuild (clean + build + dev)"
	@echo "  $(GREEN)make clean$(NC)     - Stop containers and remove volumes/images"
	@echo "  $(GREEN)make logs$(NC)      - Show container logs"
	@echo "  $(GREEN)make shell-frontend$(NC) - Open shell in frontend container"
	@echo "  $(GREEN)make shell-backend$(NC)  - Open shell in backend container"
	@echo ""

# Development mode
dev:
	@echo "$(CYAN)Starting development environment...$(NC)"
	docker compose up

# Development with rebuild
dev-build:
	@echo "$(CYAN)Building and starting development environment...$(NC)"
	docker compose up --build

# Production mode (if you have a production compose file)
prod:
	@echo "$(CYAN)Starting production environment...$(NC)"
	@if [ -f docker-compose.prod.yml ]; then \
		docker compose -f docker-compose.prod.yml up -d; \
	else \
		docker compose up -d; \
	fi

# Build containers without cache (forces npm install)
build:
	@echo "$(CYAN)Building containers without cache...$(NC)"
	docker compose build --no-cache

# Full rebuild
rebuild: clean build dev

# Clean everything
clean:
	@echo "$(YELLOW)Stopping containers...$(NC)"
	docker compose down -v --remove-orphans
	@echo "$(YELLOW)Removing Eureka images...$(NC)"
	-docker rmi eureka-frontend eureka-backend 2>/dev/null || true
	@echo "$(YELLOW)Cleaning build cache...$(NC)"
	-docker builder prune -f 2>/dev/null || true
	@echo "$(GREEN)Clean complete!$(NC)"

# Show logs
logs:
	docker compose logs -f

# Shell access
shell-frontend:
	docker compose exec frontend sh

shell-backend:
	docker compose exec backend bash

# Install dependencies in running container (useful for hot-reload)
install-deps:
	@echo "$(CYAN)Installing frontend dependencies...$(NC)"
	docker compose exec frontend npm install
	@echo "$(GREEN)Dependencies installed!$(NC)"

# Status
status:
	@echo "$(CYAN)Container Status:$(NC)"
	docker compose ps


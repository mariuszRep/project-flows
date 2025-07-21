# Project Flows - MCP Task Management System
# Makefile for common development tasks

.PHONY: help build up down logs test clean backup restore

# Default target
help:
	@echo "Available commands:"
	@echo "  make build     - Build all Docker images"
	@echo "  make up        - Start all services"
	@echo "  make down      - Stop all services"
	@echo "  make logs      - View service logs"
	@echo "  make test      - Run integration tests"
	@echo "  make clean     - Clean up containers and volumes"
	@echo "  make backup    - Backup database"
	@echo "  make restore   - Restore database from backup"
	@echo "  make dev       - Start development environment"
	@echo "  make admin     - Start with database admin interface"

# Build all services
build:
	docker-compose build

# Start all services
up:
	docker-compose up -d

# Start with admin interface
admin:
	docker-compose --profile admin up -d

# Stop all services
down:
	docker-compose down

# View logs
logs:
	docker-compose logs -f

# Run tests
test:
	docker-compose up -d postgres
	@echo "Waiting for database to be ready..."
	@sleep 10
	cd mcp && npm test

# Development environment (database only)
dev:
	docker-compose up -d postgres
	@echo "Database started for development"
	@echo "Run 'cd mcp && npm run dev' to start MCP server locally"

# Clean up everything
clean:
	docker-compose down -v
	docker system prune -f

# Backup database
backup:
	@echo "Creating database backup..."
	docker exec mcp-postgres pg_dump -U mcp_user mcp_tasks > backup_$(shell date +%Y%m%d_%H%M%S).sql
	@echo "Backup created: backup_$(shell date +%Y%m%d_%H%M%S).sql"

# Restore database (usage: make restore FILE=backup.sql)
restore:
	@if [ -z "$(FILE)" ]; then echo "Usage: make restore FILE=backup.sql"; exit 1; fi
	@echo "Restoring database from $(FILE)..."
	docker exec -i mcp-postgres psql -U mcp_user -d mcp_tasks < $(FILE)
	@echo "Database restored successfully"

# Check service status
status:
	docker-compose ps

# View database logs specifically
db-logs:
	docker-compose logs -f postgres

# View MCP server logs specifically
mcp-logs:
	docker-compose logs -f mcp-server

# Connect to database
db-connect:
	docker exec -it mcp-postgres psql -U mcp_user -d mcp_tasks

# Install dependencies for local development
install:
	cd mcp && npm install
	cd database && npm install

# Build and start fresh
fresh: clean build up

# Production deployment
prod:
	docker-compose -f docker-compose.yml up -d --build
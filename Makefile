# Project Flows - MCP Task Management System
# Makefile for common development tasks

.PHONY: help build up down logs test clean backup restore check-postgres list-backups init-fresh regenerate-seed extract-schema extract-all status db-logs mcp-logs db-connect install fresh prod admin dev

# Default target
help:
	@echo "Available commands:"
	@echo "  make build     - Build all Docker images"
	@echo "  make up        - Start all services"
	@echo "  make down      - Stop all services"
	@echo "  make logs      - View service logs"
	@echo "  make test      - Run integration tests"
	@echo "  make clean     - Clean up containers and volumes"
	@echo "  make backup    - Create a complete database backup"
	@echo "  make restore FILE=backup.dump [TARGET_DB=new_db_name] - Restore database from backup"
	@echo "  make list-backups - List all available backups"
	@echo "  make init-fresh - Initialize fresh database from schema.sql and seed.sql"
	@echo "  make regenerate-seed - Regenerate seed.sql from current database state"
	@echo "  make extract-schema - Extract schema.sql from current database state"
	@echo "  make extract-all - Extract both schema.sql and seed.sql from database"
	@echo "  make dev       - Start development environment"
	@echo "  make admin     - Start with database admin interface"
	@echo "  make status    - Check service status"
	@echo "  make db-logs   - View database logs"
	@echo "  make mcp-logs  - View MCP server logs"
	@echo "  make db-connect - Connect to database via psql"
	@echo "  make install   - Install dependencies for local development"
	@echo "  make fresh     - Clean and rebuild everything"
	@echo "  make prod      - Production deployment"

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

# Create a complete database backup
backup: check-postgres
	@echo "📦 Creating comprehensive database backup..."
	cd database && ./backup-fresh.sh

# Restore database (usage: make restore FILE=backup.dump [TARGET_DB=new_db_name])
restore: check-postgres
	@if [ -z "$(FILE)" ]; then \
		echo "Usage: make restore FILE=database/backups/backup.dump [TARGET_DB=new_db_name]"; \
		echo ""; \
		echo "Available backups:"; \
		cd database && ./restore-fresh.sh; \
		exit 1; \
	fi
	@if [ -n "$(TARGET_DB)" ]; then \
		cd database && ./restore-fresh.sh ../$(FILE) $(TARGET_DB); \
	else \
		cd database && ./restore-fresh.sh ../$(FILE); \
	fi

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

# Check if postgres is running
check-postgres:
	@if [ -z "$$(docker ps -q -f name=mcp-postgres)" ]; then \
		echo "PostgreSQL container is not running. Starting it..."; \
		docker-compose up -d postgres; \
		echo "Waiting for PostgreSQL to start..."; \
		sleep 5; \
	fi

# List all available backups
list-backups:
	@echo "📋 Available backups:"
	@if [ -d "database/backups" ]; then \
		echo ""; \
		echo "Backup files in database/backups/:"; \
		ls -lht database/backups/*.dump 2>/dev/null | head -10 || echo "  No .dump files found"; \
		echo ""; \
		ls -lht database/backups/*.sql 2>/dev/null | head -5 || echo "  No .sql files found"; \
	else \
		echo "⚠️ No backups directory found."; \
		mkdir -p database/backups; \
		echo "📁 Created database/backups/ directory"; \
	fi

# Install dependencies for local development
install:
	cd mcp && npm install
	cd database && npm install

# Build and start fresh
fresh: clean build up

# Production deployment
prod:
	docker-compose -f docker-compose.yml up -d --build

# Initialize fresh database from schema.sql and seed.sql
init-fresh: check-postgres
	@echo "🔧 Initializing fresh database..."
	cd database && ./init-fresh.sh

# Regenerate seed.sql from current database state
regenerate-seed: check-postgres
	@echo "🔄 Regenerating seed.sql from current database..."
	cd database && ./extract-seed.sh

# Extract schema.sql from current database state
extract-schema: check-postgres
	@echo "📋 Extracting schema.sql from current database..."
	cd database && ./extract-schema.sh

# Extract both schema and seed from current database
extract-all: check-postgres
	@echo "📦 Extracting schema and seed from current database..."
	cd database && ./extract-schema.sh && ./extract-seed.sh
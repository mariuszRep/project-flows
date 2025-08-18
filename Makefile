# Project Flows - MCP Task Management System
# Makefile for common development tasks

.PHONY: help build up down logs test clean backup restore check-postgres list-backups

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

# Create a complete database backup
backup: check-postgres
	@echo "📦 Creating database backup..."
	@mkdir -p backups
	@TIMESTAMP=$(shell date +%Y%m%d_%H%M%S); \
	FILENAME="backup_$$TIMESTAMP"; \
	docker exec mcp-postgres pg_dump -U mcp_user -Fc -Z9 mcp_tasks > "backups/$$FILENAME.dump"; \
	echo "✅ Backup completed successfully"; \
	echo "📁 Backup file: backups/$$FILENAME.dump"

# Restore database (usage: make restore FILE=backup.dump [TARGET_DB=new_db_name])
restore: check-postgres
	@if [ -z "$(FILE)" ]; then echo "Usage: make restore FILE=backup.dump [TARGET_DB=new_db_name]"; exit 1; fi
	@DB_NAME=$${TARGET_DB:-mcp_tasks}; \
	if [ "$$DB_NAME" != "mcp_tasks" ]; then \
		echo "Creating database $$DB_NAME if it doesn't exist..."; \
		docker exec mcp-postgres psql -U mcp_user -d mcp_tasks -c "SELECT 1 FROM pg_database WHERE datname = '$$DB_NAME'" | grep -q 1 || \
		docker exec mcp-postgres psql -U mcp_user -d mcp_tasks -c "CREATE DATABASE $$DB_NAME"; \
		echo "Restoring database from $(FILE) to $$DB_NAME..."; \
		docker exec -i mcp-postgres pg_restore -U mcp_user -d $$DB_NAME --clean --if-exists < $(FILE); \
		echo "✅ Database restored successfully to $$DB_NAME"; \
		echo "You can connect to it using: docker exec -it mcp-postgres psql -U mcp_user -d $$DB_NAME"; \
	else \
		echo "Restoring database from $(FILE) to mcp_tasks..."; \
		docker exec -i mcp-postgres pg_restore -U mcp_user -d mcp_tasks --clean --if-exists < $(FILE); \
		echo "✅ Database restored successfully"; \
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
	@if [ -d "backups" ]; then \
		echo "Backup files in backups/ directory:"; \
		find backups -type f \( -name "*.sql" -o -name "*.dump" \) | sort; \
		echo ""; \
		echo "Pre-removal backups:"; \
		find backups -name "pre_removal_backup_*.json" | sort | while read file; do \
			cat $$file | grep timestamp | sed 's/.*"timestamp": "\(.*\)".*/  - \1/'; \
		done; \
	else \
		echo "⚠️ No backups directory found."; \
		mkdir -p backups; \
		echo "📁 Created backups/ directory"; \
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
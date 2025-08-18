# Project Flows - MCP Task Management System
# Makefile for common development tasks

.PHONY: help build up down logs test clean backup backup-adv restore restore-adv restore-to-db check-postgres list-backups

# Default target
help:
	@echo "Available commands:"
	@echo "  make build     - Build all Docker images"
	@echo "  make up        - Start all services"
	@echo "  make down      - Stop all services"
	@echo "  make logs      - View service logs"
	@echo "  make test      - Run integration tests"
	@echo "  make clean     - Clean up containers and volumes"
	@echo "  make backup    - Backup database (simple)"
	@echo "  make backup-adv FORMAT=custom|plain COMPRESS=0-9 SCHEMA_ONLY=true|false - Advanced backup"
	@echo "  make restore FILE=backup.sql - Restore database (simple)"
	@echo "  make restore-adv FILE=backup.dump CLEAN=true CREATE=true - Advanced restore"
	@echo "  make restore-to-db FILE=backup.dump TARGET_DB=new_db_name - Restore to a different database"
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

# Backup database
backup: check-postgres
	@echo "Creating database backup..."
	docker exec mcp-postgres pg_dump -U mcp_user mcp_tasks > backup_$(shell date +%Y%m%d_%H%M%S).sql
	@echo "Backup created: backup_$(shell date +%Y%m%d_%H%M%S).sql"
	@mkdir -p backups
	@cp backup_$(shell date +%Y%m%d_%H%M%S).sql backups/
	@echo "Backup also copied to backups/ directory"

# Advanced backup with options
# Usage: make backup-adv FORMAT=custom COMPRESS=5 SCHEMA_ONLY=true|false
backup-adv: check-postgres
	@echo "Creating advanced database backup..."
	@mkdir -p backups
	@FORMAT=$${FORMAT:-custom}; \
	COMPRESS=$${COMPRESS:-5}; \
	SCHEMA_ONLY=$${SCHEMA_ONLY:-false}; \
	FILENAME="backup_$(shell date +%Y%m%d_%H%M%S)"; \
	if [ "$$FORMAT" = "custom" ]; then \
		EXT=".dump"; \
		FORMAT_FLAG="-Fc"; \
	else \
		EXT=".sql"; \
		FORMAT_FLAG="-F$$FORMAT"; \
	fi; \
	if [ "$$COMPRESS" -gt 0 ] && [ "$$FORMAT" = "custom" ]; then \
		COMPRESS_FLAG="-Z$$COMPRESS"; \
	else \
		COMPRESS_FLAG=""; \
	fi; \
	if [ "$$SCHEMA_ONLY" = "true" ]; then \
		SCHEMA_FLAG="--schema-only"; \
		FILENAME="$$FILENAME.schema"; \
	else \
		SCHEMA_FLAG=""; \
	fi; \
	docker exec mcp-postgres pg_dump -U mcp_user $$FORMAT_FLAG $$COMPRESS_FLAG $$SCHEMA_FLAG mcp_tasks > "backups/$$FILENAME$$EXT"; \
	echo "Backup created: backups/$$FILENAME$$EXT"; \
	echo "{\"filename\": \"$$FILENAME$$EXT\", \"format\": \"$$FORMAT\", \"compression\": $$COMPRESS, \"schema_only\": $$SCHEMA_ONLY, \"timestamp\": \"$(shell date -Iseconds)\"}" > "backups/$$FILENAME.json"

# Restore database (usage: make restore FILE=backup.sql)
restore: check-postgres
	@if [ -z "$(FILE)" ]; then echo "Usage: make restore FILE=backup.sql"; exit 1; fi
	@echo "Restoring database from $(FILE)..."
	@if [[ "$(FILE)" == *.dump ]]; then \
		docker exec -i mcp-postgres pg_restore -U mcp_user -d mcp_tasks $(RESTORE_OPTS) < $(FILE); \
	else \
		docker exec -i mcp-postgres psql -U mcp_user -d mcp_tasks < $(FILE); \
	fi
	@echo "Database restored successfully"

# Advanced restore with options
# Usage: make restore-adv FILE=backup.dump CLEAN=true CREATE=true
restore-adv: check-postgres
	@if [ -z "$(FILE)" ]; then echo "Usage: make restore-adv FILE=backup.dump CLEAN=true CREATE=true"; exit 1; fi
	@echo "Restoring database from $(FILE) with advanced options..."
	@CLEAN=$${CLEAN:-false}; \
	CREATE=$${CREATE:-false}; \
	NO_OWNER=$${NO_OWNER:-false}; \
	OPTS=""; \
	if [ "$$CLEAN" = "true" ]; then \
		OPTS="$$OPTS --clean"; \
	fi; \
	if [ "$$CREATE" = "true" ]; then \
		OPTS="$$OPTS --create"; \
	fi; \
	if [ "$$NO_OWNER" = "true" ]; then \
		OPTS="$$OPTS --no-owner"; \
	fi; \
	if [[ "$(FILE)" == *.dump ]]; then \
		docker exec -i mcp-postgres pg_restore -U mcp_user -d mcp_tasks $$OPTS < $(FILE); \
	else \
		docker exec -i mcp-postgres psql -U mcp_user -d mcp_tasks < $(FILE); \
	fi
	@echo "Database restored successfully"

# Restore to a different database
# Usage: make restore-to-db FILE=backup.dump TARGET_DB=new_db_name
restore-to-db: check-postgres
	@if [ -z "$(FILE)" ]; then echo "Usage: make restore-to-db FILE=backup.dump TARGET_DB=new_db_name"; exit 1; fi
	@if [ -z "$(TARGET_DB)" ]; then echo "Error: TARGET_DB parameter is required"; exit 1; fi
	@echo "Creating database $(TARGET_DB) if it doesn't exist..."
	@docker exec mcp-postgres psql -U mcp_user -d mcp_tasks -c "SELECT 1 FROM pg_database WHERE datname = '$(TARGET_DB)'" | grep -q 1 || \
		docker exec mcp-postgres psql -U mcp_user -d mcp_tasks -c "CREATE DATABASE $(TARGET_DB)"
	@echo "Restoring database from $(FILE) to $(TARGET_DB)..."
	@FILE_EXT=$$(echo $(FILE) | grep -o '\.[^\.]*$$'); \
	if [ "$$FILE_EXT" = ".dump" ]; then \
		cat $(FILE) | docker exec -i mcp-postgres pg_restore -U mcp_user -d $(TARGET_DB); \
	else \
		cat $(FILE) | docker exec -i mcp-postgres psql -U mcp_user -d $(TARGET_DB); \
	fi
	@echo "Database restored successfully to $(TARGET_DB)"
	@echo "You can connect to it using: docker exec -it mcp-postgres psql -U mcp_user -d $(TARGET_DB)"

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
	@echo "Available backups:"
	@if [ -d "backups" ]; then \
		find backups -type f -name "*.sql" -o -name "*.dump" | sort; \
	else \
		echo "No backups directory found."; \
	fi
	@find . -maxdepth 1 -name "backup_*.sql" | sort

# Install dependencies for local development
install:
	cd mcp && npm install
	cd database && npm install

# Build and start fresh
fresh: clean build up

# Production deployment
prod:
	docker-compose -f docker-compose.yml up -d --build
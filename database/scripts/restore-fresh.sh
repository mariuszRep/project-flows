#!/bin/bash
#
# Restore script for project-flows database
# Restores a database from backup with safety checks
#

set -e

CONTAINER_NAME="mcp-postgres"
DB_NAME="mcp_tasks"
DB_USER="mcp_user"

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔄 Database Restore Script${NC}"
echo "========================================"

# Check for backup file argument
if [ -z "$1" ]; then
    echo -e "${RED}❌ Error: No backup file specified${NC}"
    echo ""
    echo "Usage: $0 <backup_file> [target_db_name]"
    echo ""
    echo "Examples:"
    echo "  $0 backups/full_backup_20250109_120000.dump"
    echo "  $0 backups/full_backup_20250109_120000.dump mcp_tasks_test"
    echo ""
    echo "Available backups:"
    if [ -d "../backups" ]; then
        ls -lh ../backups/*.dump 2>/dev/null || echo "  No .dump files found"
        ls -lh ../backups/*.sql 2>/dev/null || echo "  No .sql files found"
    else
        echo "  No backups directory found"
    fi
    exit 1
fi

BACKUP_FILE="$1"
TARGET_DB="${2:-$DB_NAME}"

# Check if backup file exists
if [ ! -f "$BACKUP_FILE" ]; then
    echo -e "${RED}❌ Error: Backup file '$BACKUP_FILE' not found${NC}"
    exit 1
fi

# Check if container is running
if ! docker ps | grep -q "$CONTAINER_NAME"; then
    echo -e "${RED}❌ Error: PostgreSQL container '$CONTAINER_NAME' is not running${NC}"
    echo "Start it with: docker-compose up -d postgres"
    exit 1
fi

# Show warning if restoring to main database
if [ "$TARGET_DB" = "$DB_NAME" ]; then
    echo -e "${YELLOW}⚠️  WARNING: You are about to restore to the main database '$DB_NAME'${NC}"
    echo -e "${YELLOW}   This will DELETE all current data!${NC}"
    echo ""
    read -p "Are you sure you want to continue? (yes/no): " CONFIRM
    if [ "$CONFIRM" != "yes" ]; then
        echo "Restore cancelled."
        exit 0
    fi
fi

# Determine restore method based on file extension
FILE_EXT="${BACKUP_FILE##*.}"

if [ "$TARGET_DB" != "$DB_NAME" ]; then
    echo -e "${BLUE}Creating target database '$TARGET_DB'...${NC}"
    docker exec "$CONTAINER_NAME" psql -U "$DB_USER" -d postgres -c "DROP DATABASE IF EXISTS $TARGET_DB;" 2>/dev/null || true
    docker exec "$CONTAINER_NAME" psql -U "$DB_USER" -d postgres -c "CREATE DATABASE $TARGET_DB;"
    echo -e "${GREEN}✅ Database created${NC}"
fi

echo -e "${BLUE}Restoring from $BACKUP_FILE...${NC}"

if [ "$FILE_EXT" = "dump" ]; then
    # Binary dump format (recommended)
    docker exec -i "$CONTAINER_NAME" pg_restore -U "$DB_USER" -d "$TARGET_DB" --clean --if-exists < "$BACKUP_FILE"
elif [ "$FILE_EXT" = "sql" ]; then
    # Plain SQL format
    docker exec -i "$CONTAINER_NAME" psql -U "$DB_USER" -d "$TARGET_DB" < "$BACKUP_FILE"
else
    echo -e "${RED}❌ Error: Unknown file format '$FILE_EXT'${NC}"
    echo "Supported formats: .dump, .sql"
    exit 1
fi

echo ""
echo -e "${GREEN}🎉 Database restored successfully!${NC}"
echo "========================================"
echo "Database: $TARGET_DB"
echo "From: $BACKUP_FILE"
echo ""
echo "To connect:"
echo "  docker exec -it $CONTAINER_NAME psql -U $DB_USER -d $TARGET_DB"

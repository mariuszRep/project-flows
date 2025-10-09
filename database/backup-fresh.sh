#!/bin/bash
#
# Backup script for project-flows database
# Creates a complete backup suitable for restoration
#

set -e

BACKUP_DIR="backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
CONTAINER_NAME="mcp-postgres"
DB_NAME="mcp_tasks"
DB_USER="mcp_user"

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}📦 Database Backup Script${NC}"
echo "========================================"

# Check if container is running
if ! docker ps | grep -q "$CONTAINER_NAME"; then
    echo -e "${RED}❌ Error: PostgreSQL container '$CONTAINER_NAME' is not running${NC}"
    echo "Start it with: docker-compose up -d postgres"
    exit 1
fi

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# Full database dump (compressed)
DUMP_FILE="$BACKUP_DIR/full_backup_$TIMESTAMP.dump"
echo -e "${BLUE}Creating compressed database dump...${NC}"
docker exec "$CONTAINER_NAME" pg_dump -U "$DB_USER" -Fc -Z9 "$DB_NAME" > "$DUMP_FILE"
echo -e "${GREEN}✅ Compressed dump: $DUMP_FILE${NC}"

# Plain SQL dump (for human readability and version control)
SQL_FILE="$BACKUP_DIR/full_backup_$TIMESTAMP.sql"
echo -e "${BLUE}Creating plain SQL dump...${NC}"
docker exec "$CONTAINER_NAME" pg_dump -U "$DB_USER" --clean --if-exists "$DB_NAME" > "$SQL_FILE"
echo -e "${GREEN}✅ SQL dump: $SQL_FILE${NC}"

# Schema-only dump
SCHEMA_FILE="$BACKUP_DIR/schema_backup_$TIMESTAMP.sql"
echo -e "${BLUE}Creating schema-only dump...${NC}"
docker exec "$CONTAINER_NAME" pg_dump -U "$DB_USER" --schema-only --no-owner "$DB_NAME" > "$SCHEMA_FILE"
echo -e "${GREEN}✅ Schema dump: $SCHEMA_FILE${NC}"

# Data-only dump for seed data
DATA_FILE="$BACKUP_DIR/data_backup_$TIMESTAMP.sql"
echo -e "${BLUE}Creating data-only dump...${NC}"
docker exec "$CONTAINER_NAME" pg_dump -U "$DB_USER" --data-only --inserts "$DB_NAME" > "$DATA_FILE"
echo -e "${GREEN}✅ Data dump: $DATA_FILE${NC}"

echo ""
echo -e "${GREEN}🎉 Backup completed successfully!${NC}"
echo "========================================"
echo "Files created:"
echo "  📦 $DUMP_FILE (recommended for restore)"
echo "  📄 $SQL_FILE (human-readable)"
echo "  🔧 $SCHEMA_FILE (schema only)"
echo "  💾 $DATA_FILE (data only)"
echo ""
echo "To restore the database:"
echo "  make restore FILE=$DUMP_FILE"
echo ""
echo "To list all backups:"
echo "  make list-backups"

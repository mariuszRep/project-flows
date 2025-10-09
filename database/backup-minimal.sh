#!/bin/bash
#
# Minimal backup script - creates only .dump file
# Use this for production backups to save space
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

echo -e "${BLUE}📦 Minimal Database Backup${NC}"
echo "========================================"

# Check if container is running
if ! docker ps | grep -q "$CONTAINER_NAME"; then
    echo -e "${RED}❌ Error: PostgreSQL container '$CONTAINER_NAME' is not running${NC}"
    echo "Start it with: docker-compose up -d postgres"
    exit 1
fi

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# Full database dump (compressed) - ONLY file needed
DUMP_FILE="$BACKUP_DIR/backup_$TIMESTAMP.dump"
echo -e "${BLUE}Creating compressed database backup...${NC}"
docker exec "$CONTAINER_NAME" pg_dump -U "$DB_USER" -Fc -Z9 "$DB_NAME" > "$DUMP_FILE"

FILE_SIZE=$(du -h "$DUMP_FILE" | cut -f1)

echo ""
echo -e "${GREEN}🎉 Backup completed successfully!${NC}"
echo "========================================"
echo "File: $DUMP_FILE"
echo "Size: $FILE_SIZE"
echo ""
echo "To restore:"
echo "  make restore FILE=$DUMP_FILE"
echo "  # or"
echo "  ./restore-fresh.sh $DUMP_FILE"

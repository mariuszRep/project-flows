#!/bin/bash
#
# Extract schema from database to schema.sql
# Creates a clean schema file from the current database state
#

set -e

CONTAINER_NAME="mcp-postgres"
DB_NAME="mcp_tasks"
DB_USER="mcp_user"
OUTPUT_FILE="../init/schema.sql"

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}📋 Extract Schema from Database${NC}"
echo "========================================"

# Check if container is running
if ! docker ps | grep -q "$CONTAINER_NAME"; then
    echo -e "${RED}❌ Error: PostgreSQL container '$CONTAINER_NAME' is not running${NC}"
    echo "Start it with: docker-compose up -d postgres"
    exit 1
fi

# Extract schema (structure only, no data)
echo -e "${BLUE}Extracting schema from database...${NC}"
docker exec "$CONTAINER_NAME" pg_dump \
    -U "$DB_USER" \
    --schema-only \
    --no-owner \
    --no-acl \
    "$DB_NAME" > "$OUTPUT_FILE"

# Verify the file was created
if [ ! -f "$OUTPUT_FILE" ]; then
    echo -e "${RED}❌ Error: Failed to create $OUTPUT_FILE${NC}"
    exit 1
fi

FILE_SIZE=$(du -h "$OUTPUT_FILE" | cut -f1)

# Count what was extracted
TABLE_COUNT=$(grep -c "CREATE TABLE" "$OUTPUT_FILE" || echo "0")
FUNCTION_COUNT=$(grep -c "CREATE FUNCTION" "$OUTPUT_FILE" || echo "0")
TRIGGER_COUNT=$(grep -c "CREATE TRIGGER" "$OUTPUT_FILE" || echo "0")
INDEX_COUNT=$(grep -c "CREATE INDEX" "$OUTPUT_FILE" || echo "0")

echo ""
echo -e "${GREEN}✅ Schema extracted successfully!${NC}"
echo "========================================"
echo "File: $OUTPUT_FILE"
echo "Size: $FILE_SIZE"
echo ""
echo "Contents:"
echo "  📊 Tables: $TABLE_COUNT"
echo "  ⚙️  Functions: $FUNCTION_COUNT"
echo "  🔔 Triggers: $TRIGGER_COUNT"
echo "  🔍 Indexes: $INDEX_COUNT"
echo ""
echo -e "${YELLOW}Note: schema.sql has been updated with current database structure${NC}"

#!/bin/bash
#
# Initialize fresh database from scratch
# Uses schema.sql and seed.sql to create a clean database
#

set -e

CONTAINER_NAME="mcp-postgres"
DB_NAME="mcp_tasks"
DB_USER="mcp_user"
DB_PASSWORD="mcp_password"

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔧 Initialize Fresh Database${NC}"
echo "========================================"

# Check if files exist
if [ ! -f "../init/schema.sql" ]; then
    echo -e "${RED}❌ Error: init/schema.sql not found${NC}"
    exit 1
fi

if [ ! -f "../init/seed.sql" ]; then
    echo -e "${YELLOW}⚠️  Warning: init/seed.sql not found, will create empty database${NC}"
    SEED_AVAILABLE=false
else
    SEED_AVAILABLE=true
fi

# Check if container is running
if ! docker ps | grep -q "$CONTAINER_NAME"; then
    echo -e "${YELLOW}PostgreSQL container not running, starting it...${NC}"
    docker-compose up -d postgres
    echo "Waiting for PostgreSQL to be ready..."
    sleep 5
fi

# Drop and recreate database
echo -e "${BLUE}Dropping existing database (if exists)...${NC}"
docker exec "$CONTAINER_NAME" psql -U "$DB_USER" -d postgres -c "DROP DATABASE IF EXISTS $DB_NAME;" 2>/dev/null || true

echo -e "${BLUE}Creating fresh database...${NC}"
docker exec "$CONTAINER_NAME" psql -U "$DB_USER" -d postgres -c "CREATE DATABASE $DB_NAME;"
echo -e "${GREEN}✅ Database created${NC}"

# Apply schema
echo -e "${BLUE}Applying schema from init/schema.sql...${NC}"
docker exec -i "$CONTAINER_NAME" psql -U "$DB_USER" -d "$DB_NAME" < ../init/schema.sql
echo -e "${GREEN}✅ Schema applied${NC}"

# Apply seed data if available
if [ "$SEED_AVAILABLE" = true ]; then
    echo -e "${BLUE}Loading seed data from init/seed.sql...${NC}"
    docker exec -i "$CONTAINER_NAME" psql -U "$DB_USER" -d "$DB_NAME" < ../init/seed.sql
    echo -e "${GREEN}✅ Seed data loaded${NC}"
fi

# Verify installation
echo ""
echo -e "${BLUE}Verifying database setup...${NC}"
TABLE_COUNT=$(docker exec "$CONTAINER_NAME" psql -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';")
FUNCTION_COUNT=$(docker exec "$CONTAINER_NAME" psql -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM pg_proc WHERE pronamespace = 'public'::regnamespace;")
TRIGGER_COUNT=$(docker exec "$CONTAINER_NAME" psql -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM information_schema.triggers WHERE trigger_schema = 'public';")

echo "  📊 Tables: $(echo $TABLE_COUNT | xargs)"
echo "  ⚙️  Functions: $(echo $FUNCTION_COUNT | xargs)"
echo "  🔔 Triggers: $(echo $TRIGGER_COUNT | xargs)"

if [ "$SEED_AVAILABLE" = true ]; then
    TEMPLATE_COUNT=$(docker exec "$CONTAINER_NAME" psql -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM templates;")
    PROPERTY_COUNT=$(docker exec "$CONTAINER_NAME" psql -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM template_properties;")
    echo "  📋 Templates: $(echo $TEMPLATE_COUNT | xargs)"
    echo "  🏷️  Properties: $(echo $PROPERTY_COUNT | xargs)"
fi

echo ""
echo -e "${GREEN}🎉 Fresh database initialized successfully!${NC}"
echo "========================================"
echo "Database: $DB_NAME"
echo "User: $DB_USER"
echo "Container: $CONTAINER_NAME"
echo ""
echo "To connect:"
echo "  docker exec -it $CONTAINER_NAME psql -U $DB_USER -d $DB_NAME"
echo ""
echo "To view tables:"
echo "  docker exec $CONTAINER_NAME psql -U $DB_USER -d $DB_NAME -c '\\dt'"

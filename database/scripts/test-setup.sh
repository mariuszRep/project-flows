#!/bin/bash
#
# Test database setup script
# Creates a test database to verify setup without affecting existing database
#

set -e

CONTAINER_NAME="mcp-postgres-test"
DB_NAME="mcp_tasks_test"
DB_USER="mcp_user"
DB_PASSWORD="mcp_password"
POSTGRES_PORT="5433"

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}🧪 Test Database Setup${NC}"
echo "========================================"

# Check if test container already exists
if docker ps -a | grep -q "$CONTAINER_NAME"; then
    echo -e "${YELLOW}⚠️  Test container already exists, removing it...${NC}"
    docker rm -f "$CONTAINER_NAME" 2>/dev/null || true
fi

# Start test PostgreSQL container
echo -e "${BLUE}Starting test PostgreSQL container...${NC}"
docker run -d \
    --name "$CONTAINER_NAME" \
    -e POSTGRES_DB="$DB_NAME" \
    -e POSTGRES_USER="$DB_USER" \
    -e POSTGRES_PASSWORD="$DB_PASSWORD" \
    -p "$POSTGRES_PORT:5432" \
    postgres:15

echo -e "${GREEN}✅ Test container started${NC}"
echo "Waiting for PostgreSQL to be ready..."
sleep 5

# Wait for postgres to be ready
until docker exec "$CONTAINER_NAME" pg_isready -U "$DB_USER" > /dev/null 2>&1; do
    echo -n "."
    sleep 1
done
echo ""

# Apply schema
echo -e "${BLUE}Applying schema from init/schema.sql...${NC}"
docker exec -i "$CONTAINER_NAME" psql -U "$DB_USER" -d "$DB_NAME" < ../init/schema.sql
echo -e "${GREEN}✅ Schema applied${NC}"

# Apply seed data
echo -e "${BLUE}Loading seed data from init/seed.sql...${NC}"
docker exec -i "$CONTAINER_NAME" psql -U "$DB_USER" -d "$DB_NAME" < ../init/seed.sql
echo -e "${GREEN}✅ Seed data loaded${NC}"

# Verify installation
echo ""
echo -e "${BLUE}Verifying database setup...${NC}"
TABLE_COUNT=$(docker exec "$CONTAINER_NAME" psql -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';")
FUNCTION_COUNT=$(docker exec "$CONTAINER_NAME" psql -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM pg_proc WHERE pronamespace = 'public'::regnamespace;")
TRIGGER_COUNT=$(docker exec "$CONTAINER_NAME" psql -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM information_schema.triggers WHERE trigger_schema = 'public';")
TEMPLATE_COUNT=$(docker exec "$CONTAINER_NAME" psql -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM templates;")
PROPERTY_COUNT=$(docker exec "$CONTAINER_NAME" psql -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM template_properties;")

echo "  📊 Tables: $(echo $TABLE_COUNT | xargs)"
echo "  ⚙️  Functions: $(echo $FUNCTION_COUNT | xargs)"
echo "  🔔 Triggers: $(echo $TRIGGER_COUNT | xargs)"
echo "  📋 Templates: $(echo $TEMPLATE_COUNT | xargs)"
echo "  🏷️  Properties: $(echo $PROPERTY_COUNT | xargs)"

echo ""
echo -e "${GREEN}🎉 Test database initialized successfully!${NC}"
echo "========================================"
echo "Database: $DB_NAME"
echo "User: $DB_USER"
echo "Container: $CONTAINER_NAME"
echo "Port: $POSTGRES_PORT"
echo ""
echo "To connect:"
echo "  docker exec -it $CONTAINER_NAME psql -U $DB_USER -d $DB_NAME"
echo ""
echo "To stop and remove test container:"
echo "  docker rm -f $CONTAINER_NAME"
echo ""

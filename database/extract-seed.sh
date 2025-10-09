#!/bin/bash
#
# Extract seed data from database to seed.sql
# Exports templates and template_properties with sequence values
#

set -e

CONTAINER_NAME="mcp-postgres"
DB_NAME="mcp_tasks"
DB_USER="mcp_user"
OUTPUT_FILE="seed.sql"

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}🌱 Extract Seed Data from Database${NC}"
echo "========================================"

# Check if container is running
if ! docker ps | grep -q "$CONTAINER_NAME"; then
    echo -e "${RED}❌ Error: PostgreSQL container '$CONTAINER_NAME' is not running${NC}"
    echo "Start it with: docker-compose up -d postgres"
    exit 1
fi

# Create temporary file
TEMP_FILE=$(mktemp)

# Start building seed.sql
cat > "$TEMP_FILE" << 'EOF'
--
-- Seed data generated from current database state
--

EOF

# Export templates table
echo -e "${BLUE}Exporting templates...${NC}"
docker exec "$CONTAINER_NAME" pg_dump \
    -U "$DB_USER" \
    --data-only \
    --inserts \
    --table=templates \
    --no-owner \
    --no-acl \
    "$DB_NAME" >> "$TEMP_FILE"

TEMPLATE_COUNT=$(docker exec "$CONTAINER_NAME" psql -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM templates;" | xargs)
echo -e "${GREEN}✅ Templates exported: $TEMPLATE_COUNT rows${NC}"

# Export template_properties table
echo -e "${BLUE}Exporting template_properties...${NC}"
docker exec "$CONTAINER_NAME" pg_dump \
    -U "$DB_USER" \
    --data-only \
    --inserts \
    --table=template_properties \
    --no-owner \
    --no-acl \
    "$DB_NAME" >> "$TEMP_FILE"

PROPERTY_COUNT=$(docker exec "$CONTAINER_NAME" psql -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM template_properties;" | xargs)
echo -e "${GREEN}✅ Template properties exported: $PROPERTY_COUNT rows${NC}"

# Add sequence values
echo -e "${BLUE}Getting sequence values...${NC}"
cat >> "$TEMP_FILE" << 'EOF'


--
-- Name: object_properties_id_seq; Type: SEQUENCE SET; Schema: public; Owner: mcp_user
--

EOF

SEQ_VALUE=$(docker exec "$CONTAINER_NAME" psql -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT last_value FROM object_properties_id_seq;" | xargs)
echo "SELECT pg_catalog.setval('public.object_properties_id_seq', $SEQ_VALUE, true);" >> "$TEMP_FILE"

cat >> "$TEMP_FILE" << 'EOF'


--
-- Name: template_properties_id_seq; Type: SEQUENCE SET; Schema: public; Owner: mcp_user
--

EOF

SEQ_VALUE=$(docker exec "$CONTAINER_NAME" psql -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT last_value FROM template_properties_id_seq;" | xargs)
echo "SELECT pg_catalog.setval('public.template_properties_id_seq', $SEQ_VALUE, true);" >> "$TEMP_FILE"

cat >> "$TEMP_FILE" << 'EOF'


--
-- Name: objects_id_seq; Type: SEQUENCE SET; Schema: public; Owner: mcp_user
--

EOF

SEQ_VALUE=$(docker exec "$CONTAINER_NAME" psql -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT last_value FROM objects_id_seq;" | xargs)
echo "SELECT pg_catalog.setval('public.objects_id_seq', $SEQ_VALUE, true);" >> "$TEMP_FILE"

cat >> "$TEMP_FILE" << 'EOF'


--
-- Name: templates_id_seq; Type: SEQUENCE SET; Schema: public; Owner: mcp_user
--

EOF

SEQ_VALUE=$(docker exec "$CONTAINER_NAME" psql -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT last_value FROM templates_id_seq;" | xargs)
echo "SELECT pg_catalog.setval('public.templates_id_seq', $SEQ_VALUE, true);" >> "$TEMP_FILE"

cat >> "$TEMP_FILE" << 'EOF'


--
-- PostgreSQL database dump complete
--
EOF

# Move temp file to final location
mv "$TEMP_FILE" "$OUTPUT_FILE"

FILE_SIZE=$(du -h "$OUTPUT_FILE" | cut -f1)

echo ""
echo -e "${GREEN}🎉 Seed data extracted successfully!${NC}"
echo "========================================"
echo "File: $OUTPUT_FILE"
echo "Size: $FILE_SIZE"
echo ""
echo "Contents:"
echo "  📋 Templates: $TEMPLATE_COUNT rows"
echo "  🏷️  Properties: $PROPERTY_COUNT rows"
echo "  🔢 Sequences: 4 values"
echo ""
echo -e "${YELLOW}Note: seed.sql has been updated with current database state${NC}"

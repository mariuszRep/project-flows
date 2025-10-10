# Database Migration Scripts

This directory contains database migration scripts for the project-flows system.

## Available Migrations

### migration-001-parent-id-related-sync.sql

**Purpose**: Adds PostgreSQL triggers to maintain bidirectional synchronization between the `parent_id` column and `related` JSONB array during the transition period from hierarchical parent relationships to flexible related object relationships.

**What it does**:
- Creates `sync_parent_id_to_related()` function and trigger
- Creates `sync_related_to_parent_id()` function and trigger
- Includes validation queries to check data integrity
- Provides rollback script to remove triggers

**How to apply**:

```bash
# Option 1: Using docker exec (with running container)
cat database/scripts/migration-001-parent-id-related-sync.sql | \
  docker exec -i mcp-postgres psql -U mcp_user -d mcp_tasks

# Option 2: Using psql directly (if connected to database)
psql -U mcp_user -d mcp_tasks -f database/scripts/migration-001-parent-id-related-sync.sql

# Option 3: Copy into container and execute
docker cp database/scripts/migration-001-parent-id-related-sync.sql mcp-postgres:/tmp/
docker exec mcp-postgres psql -U mcp_user -d mcp_tasks -f /tmp/migration-001-parent-id-related-sync.sql
```

**Expected output**:
```
CREATE FUNCTION
COMMENT
CREATE FUNCTION
COMMENT
CREATE TRIGGER
COMMENT
CREATE TRIGGER
COMMENT
DO
NOTICE:  Objects with parent_id but no parent in related array: <count>
DO
NOTICE:  Objects with parent in related but mismatched parent_id: 0
```

If there are existing objects with `parent_id` set, the validation will report them. This is expected for existing data. The triggers will automatically sync these relationships when the objects are next updated.

**How it works**:

1. **sync_related_to_parent_id_trigger** (runs first):
   - Fires BEFORE INSERT OR UPDATE
   - Extracts the first parent-type relationship from `related` array
   - Updates `parent_id` to match

2. **sync_parent_id_to_related_trigger** (runs second):
   - Fires BEFORE INSERT OR UPDATE
   - When `parent_id` is set, adds parent relationship to `related` array
   - When `parent_id` is NULL, removes parent relationships from `related` array

**Behavior examples**:

```sql
-- Setting parent_id automatically updates related array
UPDATE objects SET parent_id = 947 WHERE id = 950;
-- Result: related = [{"id": 947, "type": "parent", "object_type": "epic"}]

-- Setting related array automatically updates parent_id
UPDATE objects
SET related = '[{"id": 83, "type": "parent", "object_type": "project"}]'::jsonb
WHERE id = 951;
-- Result: parent_id = 83, related includes both relationships

-- Removing parent_id clears parent from related
UPDATE objects SET parent_id = NULL WHERE id = 952;
-- Result: parent_id = NULL, related = []

-- INSERT with parent_id automatically populates related
INSERT INTO objects (template_id, parent_id, stage)
VALUES (1, 947, 'draft');
-- Result: related = [{"id": 947, "type": "parent", "object_type": "epic"}]
```

**Rollback**:

To remove the triggers and functions, uncomment and run the rollback section at the end of the migration file:

```bash
# Extract and run rollback section
cat database/scripts/migration-001-parent-id-related-sync.sql | \
  sed -n '/^-- Drop triggers/,/Should return no rows/p' | \
  sed 's/^\/\* //' | sed 's/ \*\///' | \
  docker exec -i mcp-postgres psql -U mcp_user -d mcp_tasks
```

Or manually execute:

```sql
DROP TRIGGER IF EXISTS sync_parent_id_to_related_trigger ON objects;
DROP TRIGGER IF EXISTS sync_related_to_parent_id_trigger ON objects;
DROP FUNCTION IF EXISTS sync_parent_id_to_related();
DROP FUNCTION IF EXISTS sync_related_to_parent_id();
```

**Important notes**:
- The triggers maintain compatibility with the existing FK constraint `tasks_parent_id_fkey`
- Both `parent_id` and `related` array remain synchronized during the transition
- The triggers do not break any existing functionality
- Existing data will be synced when objects are next updated
- The triggers can be safely removed once the transition to `related` array is complete

---

### migration-002-migrate-parent-to-related.sql

**Purpose**: Migrates existing `parent_id` values to the `related` JSONB array for all records in the objects table. This is a one-time data migration that should be run after applying migration-001.

**What it does**:
- Processes records in batches (100 at a time) for efficiency
- Populates `related` array with parent relationships from `parent_id`
- Includes progress reporting during execution
- Validates 100% data migration success
- Provides rollback capability via separate script

**Prerequisites**:
- Migration 001 (sync triggers) should be applied first
- Database backup recommended before running

**How to apply**:

```bash
# Recommended: Create backup first
make backup

# Option 1: Using docker exec (with running container)
cat database/scripts/migration-002-migrate-parent-to-related.sql | \
  docker exec -i mcp-postgres psql -U mcp_user -d mcp_tasks

# Option 2: Using psql directly
psql -U mcp_user -d mcp_tasks -f database/scripts/migration-002-migrate-parent-to-related.sql
```

**Expected output**:
```
NOTICE:  📊 Pre-Migration Status:
NOTICE:    Total records: 147
NOTICE:    Records with parent_id: 142
NOTICE:    Records needing migration: 139
NOTICE:  🔄 Starting batched migration (batch size: 100)
NOTICE:    Batch 1: Processed 100 records (100 / 139 = %)
NOTICE:    Batch 2: Processed 39 records (139 / 139 = %)
NOTICE:  ✅ Migration completed!
NOTICE:    Total records processed: 139
NOTICE:  📊 POST-MIGRATION VALIDATION
NOTICE:    Successfully migrated: 142
NOTICE:    Still need migration: 0
NOTICE:  ✅ VALIDATION PASSED: 100% of records successfully migrated!
```

**How it works**:

The migration uses a batched UPDATE approach with CTEs:
1. Joins `objects` table with parent records to get `template_id`
2. Creates appropriate parent relationship entries with correct `object_type`
3. Processes 100 records per batch to avoid long table locks
4. Reports progress after each batch
5. Validates that all records were successfully migrated

**Performance**:
- Batch size: 100 records per iteration
- Small delay (0.1s) between batches to reduce lock contention
- Typical execution time: < 1 second for 150 records

**Rollback**:

To remove parent entries from related arrays:

```bash
# Note: This requires temporarily disabling sync triggers
# to prevent automatic re-population

docker exec -i mcp-postgres psql -U mcp_user -d mcp_tasks <<'EOF'
-- Disable triggers
ALTER TABLE objects DISABLE TRIGGER sync_parent_id_to_related_trigger;
ALTER TABLE objects DISABLE TRIGGER sync_related_to_parent_id_trigger;

-- Remove parent entries
UPDATE objects
SET related = (
  SELECT COALESCE(jsonb_agg(elem), '[]'::jsonb)
  FROM jsonb_array_elements(related) AS elem
  WHERE elem->>'type' != 'parent'
)
WHERE EXISTS (
  SELECT 1 FROM jsonb_array_elements(related) elem
  WHERE elem->>'type' = 'parent'
);

-- Re-enable triggers if needed
ALTER TABLE objects ENABLE TRIGGER sync_parent_id_to_related_trigger;
ALTER TABLE objects ENABLE TRIGGER sync_related_to_parent_id_trigger;
EOF

# Or use the provided rollback script
cat database/scripts/migration-002-rollback.sql | \
  docker exec -i mcp-postgres psql -U mcp_user -d mcp_tasks
```

**Important notes**:
- Run this migration AFTER migration-001 (sync triggers)
- If sync triggers are active, they will maintain the data going forward
- If triggers are not installed, related arrays won't stay in sync automatically
- The migration is idempotent - safe to run multiple times
- Records already migrated are skipped
- No data loss - `parent_id` values are preserved

---

## Migration Order

**Recommended sequence**:
1. **migration-001**: Install bidirectional sync triggers
2. **migration-002**: Migrate existing data to related arrays
3. **Future migrations**: Can safely work with either `parent_id` or `related` array

## Migration Best Practices

1. **Always backup** before running migrations:
   ```bash
   make backup
   ```

2. **Test in development** before applying to production

3. **Run validation queries** after migration to verify data integrity

4. **Keep rollback scripts** ready in case of issues

5. **Document any manual data fixes** required after migration

## Troubleshooting

**Issue**: Migration shows many objects with parent_id but no related entry

**Solution**: This is expected for existing data. The triggers will sync these relationships when objects are updated. To force sync all objects:

```sql
UPDATE objects SET updated_at = CURRENT_TIMESTAMP WHERE parent_id IS NOT NULL;
```

**Issue**: Trigger conflicts with application logic

**Solution**: Review the trigger functions and ensure they align with application expectations. The triggers are designed to be non-breaking and maintain existing FK constraints.

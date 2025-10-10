# Database Migrations

This directory contains database migration scripts for the project-flows application.

## Overview

Migrations are versioned SQL scripts that modify the database schema. Each migration has a forward script (to apply changes) and a rollback script (to undo changes).

## Migration Files

### 001_add_jsonb_columns.sql

**Purpose**: Adds JSONB columns for flexible relationship tracking to the `objects` table.

**Changes**:
- Adds `related` JSONB column for storing related object references
- Adds `dependencies` JSONB column for storing dependency relationships
- Creates GIN indexes on both columns for efficient querying

**Applied**: 2025-10-10

## JSONB Column Structure

### `related` Column

Stores an array of related object references. This enables flexible linking between objects without requiring additional junction tables.

**Example Structure**:
```json
[
  {"id": 123, "type": "task"},
  {"id": 456, "type": "epic"},
  {"id": 789, "type": "project"}
]
```

**Use Cases**:
- Linking related tasks
- Connecting projects to reference implementations
- Associating epics with similar initiatives
- Cross-referencing documentation

### `dependencies` Column

Stores an array of dependency relationships that define blocking or prerequisite conditions.

**Example Structure**:
```json
[
  {"id": 101, "type": "task", "blocking": true},
  {"id": 202, "type": "epic", "blocking": false},
  {"id": 303, "type": "task", "blocking": true, "reason": "Requires API implementation"}
]
```

**Use Cases**:
- Task dependencies (Task A must complete before Task B)
- Project prerequisites
- Feature flag dependencies
- Technical debt tracking

## Querying JSONB Data

PostgreSQL provides powerful operators for querying JSONB data:

### Containment Queries

```sql
-- Find all objects with a specific related object
SELECT * FROM objects
WHERE related @> '[{"id": 123}]'::jsonb;

-- Find all objects that depend on task 101
SELECT * FROM objects
WHERE dependencies @> '[{"id": 101}]'::jsonb;
```

### Existence Queries

```sql
-- Find objects that have any related objects
SELECT * FROM objects
WHERE jsonb_array_length(related) > 0;

-- Find objects with blocking dependencies
SELECT * FROM objects
WHERE dependencies @> '[{"blocking": true}]'::jsonb;
```

### Element Access

```sql
-- Extract all dependency IDs
SELECT id, jsonb_array_elements(dependencies)->>'id' as dependency_id
FROM objects
WHERE jsonb_array_length(dependencies) > 0;
```

## GIN Indexes

Both `related` and `dependencies` columns have GIN (Generalized Inverted Index) indexes for optimal query performance:

- `idx_objects_related`: Optimizes containment queries on the `related` column
- `idx_objects_dependencies`: Optimizes containment queries on the `dependencies` column

GIN indexes are particularly efficient for JSONB containment operators (`@>`, `?`, `?&`, `?|`).

## Best Practices

1. **Initialize as Empty Arrays**: Always use `[]` instead of `null` to simplify application logic
2. **Consistent Structure**: Maintain consistent object shapes within arrays (e.g., always include `id` and `type`)
3. **Use Indexes**: Leverage GIN indexes for containment queries
4. **Validate in Application**: Ensure application code validates JSONB structure before insertion
5. **Document Schemas**: Keep this documentation updated as new fields are added to JSONB structures

## Applying Migrations

### Forward Migration
```bash
cat database/migrations/001_add_jsonb_columns.sql | docker exec -i mcp-postgres psql -U mcp_user -d mcp_tasks
```

### Rollback Migration
```bash
cat database/migrations/001_add_jsonb_columns_rollback.sql | docker exec -i mcp-postgres psql -U mcp_user -d mcp_tasks
```

## Backup Before Migration

Always create a backup before applying migrations:
```bash
make backup
```

To restore from backup:
```bash
make restore FILE=database/backups/full_backup_YYYYMMDD_HHMMSS.dump
```

## Testing Migrations

1. Create a backup
2. Apply the forward migration
3. Verify schema changes with `\d objects`
4. Test application functionality
5. If issues occur, apply rollback migration
6. Restore from backup if needed

## Migration History

| Version | Date | Description | Author |
|---------|------|-------------|--------|
| 001 | 2025-10-10 | Add JSONB columns for related objects and dependencies | System |

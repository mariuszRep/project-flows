# Migration Guide: parent_id to Related Array

## Overview

This guide documents the migration from the legacy `parent_id` column to the new `related` JSONB array for managing parent relationships in the MCP task management system.

**Important**: The `related` array is designed specifically for **parent relationships only**. The separate `dependencies` column handles dependency relationships and is not affected by this migration.

## What's Changing

### Before (Legacy)
```typescript
// Creating a task with a parent using parent_id
await createTask({
  Title: "My Task",
  Description: "Task description",
  parent_id: 123  // Single integer reference
});
```

### After (Current)
```typescript
// Creating a task with a parent using related array
await createTask({
  Title: "My Task",
  Description: "Task description",
  related: [{ id: 123, object: "project" }]  // Structured parent reference
});
```

## The Related Array Format

### Simplified Format
The `related` array uses a simplified format for parent relationships:

```typescript
interface RelatedEntry {
  id: number;        // ID of the parent object
  object: string;    // Type: 'task', 'project', 'epic', or 'rule'
}
```

### Examples

**Task belonging to a Project:**
```json
{
  "Title": "Implement user authentication",
  "Description": "Add login and session management",
  "related": [{ "id": 45, "object": "project" }]
}
```

**Epic belonging to a Project:**
```json
{
  "Title": "Phase 1 Development",
  "Description": "Initial feature set",
  "related": [{ "id": 12, "object": "project" }]
}
```

**Task belonging to an Epic:**
```json
{
  "Title": "Design database schema",
  "Description": "Create ERD and migrations",
  "related": [{ "id": 67, "object": "epic" }]
}
```

**No parent (empty array):**
```json
{
  "Title": "Standalone task",
  "Description": "Independent work item",
  "related": []
}
```

## Constraints

### Parent Relationship Rules
1. **At most one parent**: The `related` array can contain only **one** entry for parent relationships
2. **Valid types**: Parent object type must be one of: `task`, `project`, `epic`, `rule`
3. **Parent must exist**: Referenced parent object must exist in the database
4. **Type validation**: The `object` field must match the actual type of the parent object

### What the Related Array Is NOT
- ❌ Not for dependency relationships (use `dependencies` column)
- ❌ Not for multiple parents (limited to one parent)
- ❌ Not for custom relationship types (parent relationships only)

## Database Queries

### Querying by Parent

**Find all tasks under a specific project:**
```sql
SELECT * FROM objects
WHERE related @> '[{"id": 123, "object": "project"}]'::jsonb;
```

**Find all objects with any parent:**
```sql
SELECT * FROM objects
WHERE jsonb_array_length(related) > 0;
```

**Find orphaned objects (no parent):**
```sql
SELECT * FROM objects
WHERE related = '[]'::jsonb OR related IS NULL;
```

**Extract parent ID from related array:**
```sql
SELECT id, (related->0->>'id')::int AS parent_id
FROM objects
WHERE jsonb_array_length(related) > 0;
```

### Using GIN Index
The existing GIN index on the `related` column provides fast lookups:

```sql
-- This query uses the idx_objects_related index
SELECT * FROM objects
WHERE related @> '[{"id": 45}]'::jsonb;
```

## Migration Steps

### For Application Code

#### Step 1: Update Create Operations
```typescript
// OLD WAY (still works, but deprecated)
const task = await createTask({
  Title: "My Task",
  parent_id: projectId
});

// NEW WAY (recommended)
const task = await createTask({
  Title: "My Task",
  related: [{ id: projectId, object: "project" }]
});
```

#### Step 2: Update Update Operations
```typescript
// OLD WAY (still works, but deprecated)
await updateTask({
  task_id: 123,
  parent_id: newProjectId
});

// NEW WAY (recommended)
await updateTask({
  task_id: 123,
  related: [{ id: newProjectId, object: "project" }]
});
```

#### Step 3: Update Query Operations
```typescript
// Related array is automatically included in all responses
const task = await getObject(123);
console.log(task.related);  // [{ id: 45, object: "project" }]
console.log(task.parent_id);  // 45 (still available for backward compatibility)
```

### For Database Operations

The database automatically maintains synchronization between `parent_id` and `related`:
- When `parent_id` is set, `related` is automatically populated
- When `related` is set, `parent_id` is automatically extracted
- This is handled by database triggers (no manual intervention needed)

## Backward Compatibility

### Current Phase (Phase 1)
✅ **Both `parent_id` and `related` are fully supported**

- You can use either `parent_id` OR `related` when creating/updating objects
- The system automatically converts between formats
- Console warnings are logged when `parent_id` is used (deprecated)
- All existing code continues to work without changes

### Migration Timeline

#### Phase 1: Dual Support (Current - Next 3 months)
- Both `parent_id` and `related` accepted
- Automatic conversion between formats
- Console warnings for `parent_id` usage
- Documentation encourages migration to `related`

#### Phase 2: Read-Only parent_id (3-6 months from now)
- `related` is the primary method for setting parents
- `parent_id` can still be read but not written
- Attempting to set `parent_id` returns deprecation error
- Migration tools provided for bulk updates

#### Phase 3: parent_id Removal (6+ months from now)
- `parent_id` column removed from database schema
- Only `related` array supported
- Full migration required before this phase

### Console Warnings

When using deprecated `parent_id`, you'll see:
```
⚠️  DEPRECATED: parent_id parameter is deprecated. Use 'related' array instead.
   Example: related: [{ id: 123, object: "project" }]
   See MIGRATION.md for details.
```

## Best Practices

### ✅ DO
- Use `related` array for all new code
- Include the `object` type field for clarity
- Validate parent exists before creating relationships
- Use JSONB operators (@>, ?, ->) for efficient queries
- Set `related: []` for objects with no parent

### ❌ DON'T
- Don't use `parent_id` for new code
- Don't put multiple entries in `related` (only one parent allowed)
- Don't use `related` for dependencies (use `dependencies` column)
- Don't manually set both `parent_id` and `related` (pick one)
- Don't assume `related` is for all relationships (parent only)

## Validation

The system validates `related` array entries:

1. **Array length**: Maximum one entry
2. **Required fields**: Both `id` and `object` must be present
3. **Field types**: `id` must be number ≥ 1, `object` must be string
4. **Valid types**: `object` must be: 'task', 'project', 'epic', or 'rule'
5. **Parent exists**: Referenced object must exist in database
6. **Type match**: `object` field must match parent's actual type

### Validation Errors

```typescript
// ❌ Too many parents
related: [
  { id: 1, object: "project" },
  { id: 2, object: "epic" }
]
// Error: Related array can only contain one parent entry. Found 2 entries.

// ❌ Invalid object type
related: [{ id: 123, object: "invalid" }]
// Error: Invalid object type "invalid". Must be one of: task, project, epic, rule.

// ❌ Parent doesn't exist
related: [{ id: 99999, object: "project" }]
// Error: Referenced parent object with ID 99999 does not exist.

// ❌ Type mismatch
related: [{ id: 5, object: "project" }]  // But ID 5 is actually a task
// Error: Related entry object type "project" does not match parent's actual type "task".
```

## FAQ

### Q: Can I still use parent_id?
**A:** Yes, for now. Both `parent_id` and `related` are supported during the transition period. However, `parent_id` is deprecated and will eventually be removed.

### Q: What about the dependencies column?
**A:** The `dependencies` column is completely separate and unchanged. Use `related` for parent relationships and `dependencies` for dependency relationships.

### Q: Do I need to migrate existing data?
**A:** No immediate action required. The database automatically synchronizes `parent_id` and `related`. However, you should update your code to use `related` before Phase 2.

### Q: Can an object have multiple parents?
**A:** No. The `related` array is limited to one parent entry maximum. This maintains the hierarchical tree structure.

### Q: What if I need to remove a parent?
**A:** Set `related` to an empty array: `related: []`

### Q: How do I query for children of a parent?
**A:** Use JSONB containment: `WHERE related @> '[{"id": 123}]'::jsonb`

### Q: Will this affect performance?
**A:** No. The `related` column has a GIN index for fast lookups, and JSONB operations are highly optimized in PostgreSQL.

## Support

For questions or issues with the migration:
1. Check this document for examples and best practices
2. Review the integration tests in `tests/integration.test.js`
3. Consult the code examples in `src/tools/create-handler.ts`
4. Open an issue in the project repository

## Related Documentation

- [README.md](../README.md) - Project overview
- [CLAUDE.md](CLAUDE.md) - MCP server documentation
- [schema.sql](../database/init/schema.sql) - Database schema reference
- [Integration Tests](tests/integration.test.js) - Usage examples

# Related Array Implementation (Phase 3)

## Overview
Phase 3 completes the migration to the `related` JSONB array as the exclusive representation of parent relationships. The legacy `parent_id` column, foreign key, supporting index, and sync triggers have been removed. Applications now read and write parent relationships solely through `related`, with `parent_id` exposed only as a derived value in server responses and notifications for backward compatibility.

## Key Changes

### 1. Schema & Migrations
- `migration-003-remove-parent-id.sql` removes the legacy column, triggers, functions, index, and foreign key.
- `database/init/schema.sql` reflects the new canonical structure (no `parent_id` column).
- Notifications derive `parent_id` from `related` when publishing payloads.

### 2. MCP Server
- `mcp/src/database.ts` persists and filters parents using `related`. Helper queries use `jsonb_array_elements` to expose a derived `parent_id` to consumers that still expect it.
- Create/update handlers (`mcp/src/tools/*`) accept only the `related` array. Requests that still provide `parent_id` are rejected.

### 3. Tests
- SQL regression tests (`database/tests/test-database-service-related.sql`, `database/tests/test-notification-trigger.sql`) now operate exclusively on the `related` array.
- Integration tests (`mcp/tests/integration.test.js`) validate handler rejection of `parent_id` and confirm relationship updates through `related`.

## Related Array Format
```json
[
  { "id": 83, "object": "project" }
]
```
- Supports **zero or one** parent entry.
- `object` identifies the parent type (`task`, `project`, `epic`, or `rule`).
- Additional relationship types (e.g., blockers) retain their previous structure.

## Working With Related

### Insert / Update
```sql
UPDATE objects
SET related = jsonb_build_array(jsonb_build_object('id', 83, 'object', 'project'))
WHERE id = 1038;
```

### Filter by Parent
```sql
SELECT id, stage
FROM objects
WHERE related @> '[{"id": 83, "object": "project"}]'::jsonb;
```

### Clear Parent
```sql
UPDATE objects
SET related = '[]'::jsonb
WHERE id = 1038;
```

## Verification Checklist
1. **Run migrations** on staging and confirm validation step passes (`related` populated or empty).
2. **Execute SQL tests** (`test-database-service-related.sql`, `test-notification-trigger.sql`).
3. **Run MCP integration tests** to ensure handlers reject `parent_id` writes.
4. **Manually verify UI flows** (create, update, detach parent) operate using `related`.

## Rollback
`database/migrations/migration-003-remove-parent-id-rollback.sql` can be applied if emergency restoration of `parent_id` is required; it restores the column, index, foreign key, and lightweight sync triggers (without data backfill).

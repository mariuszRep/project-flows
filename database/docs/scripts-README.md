# Database Scripts Overview (Phase 3)

## Active Migrations

| Migration | Purpose |
|-----------|---------|
| `migration-001-parent-id-related-sync.sql` | **Legacy** – installed bidirectional sync triggers during the transition period. Not required after Phase 3 but retained for historical reference. |
| `migration-001-fix-trigger-logic.sql` | **Legacy** – improved trigger guards to prevent loops. |
| `migration-002-migrate-parent-to-related.sql` | Backfilled the `related` JSONB array from existing `parent_id` values. |
| `migration-003-remove-parent-id.sql` | Removes the `parent_id` column, sync triggers, foreign key, and index once all clients use `related`. Includes validation to ensure every record has at most one parent entry before dropping the column. |

Rollback support is available via `migration-003-remove-parent-id-rollback.sql`, which reintroduces the column, index, foreign key, and lightweight sync triggers if emergency recovery is required.

## Running Phase 3 Migration

1. **Backup**  
   ```
   make backup
   ```
2. **Apply migration**  
   ```
   docker exec -i mcp-postgres psql -U mcp_user -d mcp_tasks < database/migrations/migration-003-remove-parent-id.sql
   ```
   The migration aborts if it finds multiple parent entries per object.
3. **Verify**  
   - Run `database/tests/test-database-service-related.sql`
   - Run `database/tests/test-notification-trigger.sql`
   - Execute MCP integration tests (`npm test` inside `mcp/`)

## Legacy Scripts

The earlier trigger-based synchronisation scripts are preserved for historical context but should not be re-run after Phase 3. Use the rollback script if a reversion is required instead of reapplying legacy migrations.

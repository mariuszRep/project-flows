# Notification System Updates

## Overview

The `notify_data_change()` trigger function has been enhanced to track and broadcast changes to the `related` and `dependencies` JSONB arrays in real-time. This enables the UI to receive immediate updates when object relationships are modified.

> **Note:** The legacy `parent_id` column has been removed. Notifications now include a `parent_id` field derived from the first entry in the `related` array (when present) to preserve downstream compatibility.

## Enhanced Notification Payload

### INSERT Operations

When a new object is created, the notification includes:

```json
{
  "event_type": "created",
  "object_type": "task" | "project" | "epic" | "rule",
  "object_id": 123,
  "template_id": 1,
  "parent_id": 456,
  "stage": "draft",
  "related": [
    {"id": 456, "type": "parent", "object_type": "epic"}
  ],
  "dependencies": [],
  "created_by": "system",
  "timestamp": "2025-10-10T12:34:56.789Z"
}
```

### UPDATE Operations

When an object is updated, the notification includes change tracking:

```json
{
  "event_type": "updated",
  "object_type": "task",
  "object_id": 123,
  "template_id": 1,
  "parent_id": 456,
  "stage": "doing",
  "related": [
    {"id": 456, "type": "parent", "object_type": "epic"},
    {"id": 789, "type": "blocks", "object_type": "task"}
  ],
  "dependencies": [
    {"id": 100, "type": "requires"}
  ],
  "updated_by": "windsurf",
  "timestamp": "2025-10-10T12:35:00.123Z",
  "changes": {
    "related_changed": true,
    "dependencies_changed": true,
    "parent_id_changed": false,
    "added_relationships": [
      {"id": 789, "type": "blocks", "object_type": "task"}
    ],
    "removed_relationships": []
  }
}
```

### DELETE Operations

When an object is deleted:

```json
{
  "event_type": "deleted",
  "object_type": "task",
  "object_id": 123,
  "template_id": 1,
  "timestamp": "2025-10-10T12:36:00.456Z"
}
```

## Change Detection

The trigger function detects changes to three key columns:

1. **`related` array changes**: Tracks additions and removals of relationships
2. **`dependencies` array changes**: Tracks dependency modifications
3. **Derived parent changes**: Tracks when the primary parent inferred from `related` changes

### Relationship Change Tracking

When the `related` array is modified, the trigger:

1. Compares OLD and NEW values using `IS DISTINCT FROM`
2. Calculates added relationships (in NEW but not in OLD)
3. Calculates removed relationships (in OLD but not in NEW)
4. Includes both in the `changes` object

## Notification Flow

```
1. Database Operation (INSERT/UPDATE/DELETE)
   ↓
2. notify_data_change() trigger fires
   ↓
3. Calculates changes (for UPDATE operations)
   ↓
4. Builds JSON notification payload
   ↓
5. pg_notify('data_changed', payload)
   ↓
6. NotificationHandler receives notification
   ↓
7. Broadcasts to all connected SSE clients
   ↓
8. UI receives real-time update
```

## Testing

A comprehensive test script is available at `database/scripts/test-notification-trigger.sql`.

### Run Tests

```bash
# Run all notification tests
cat database/scripts/test-notification-trigger.sql | \
  docker exec -i mcp-postgres psql -U mcp_user -d mcp_tasks
```

### Test Coverage

The test script validates:
- ✅ Adding relationships to `related` array
- ✅ Removing relationships from `related` array
- ✅ Replacing entire `related` array (including parent changes)
- ✅ Updating non-relationship fields (no false positives)
- ✅ INSERT operations with relationships
- ✅ Updating `dependencies` array

## Client Integration

### Notification Handler (Backend)

The `NotificationHandler` class in `mcp/src/server/notification-handler.ts` automatically:
- Connects to PostgreSQL with LISTEN 'data_changed'
- Receives notifications from the database
- Broadcasts to all connected SSE clients
- Maintains active connection pool

No code changes required - the handler forwards all payload fields automatically.

### UI Integration (Frontend)

Frontend clients receive notifications via SSE:

```typescript
// Example: Listening for relationship changes
eventSource.addEventListener('state_change', (event) => {
  const notification = JSON.parse(event.data);

  if (notification.changes?.related_changed) {
    console.log('Relationships changed:', {
      added: notification.changes.added_relationships,
      removed: notification.changes.removed_relationships
    });

    // Update UI accordingly
    refreshObjectRelationships(notification.object_id);
  }
});
```

## Performance Considerations

### Optimized Change Detection

- Uses PostgreSQL's `IS DISTINCT FROM` for efficient comparison
- Only calculates relationship diffs when `related` array actually changed
- Uses JSONB operators for fast array element comparisons
- No performance impact on operations that don't modify relationships

### Notification Payload Size

- Average payload size: ~500-1000 bytes
- Includes full `related` and `dependencies` arrays
- Change tracking adds minimal overhead (~200 bytes)
- No impact on database performance

## Backward Compatibility

The enhanced notification format is **fully backward compatible**:

- Old clients ignore new fields they don't understand
- Core fields (`event_type`, `object_id`, `object_type`) unchanged
- New fields are optional and additive
- Existing notification consumers continue working without changes

## Migration Notes

### Applying the Update

The updated trigger function has been applied to the database schema. To apply it to an existing database:

```bash
# Apply updated function
docker exec -i mcp-postgres psql -U mcp_user -d mcp_tasks <<'EOF'
-- The CREATE OR REPLACE FUNCTION command from migration-001-parent-id-related-sync.sql
-- or directly from database/init/schema.sql
EOF
```

### Verifying Installation

```sql
-- Check trigger function exists
SELECT proname, prosrc FROM pg_proc WHERE proname = 'notify_data_change';

-- Check trigger is attached
SELECT trigger_name, event_manipulation, event_object_table
FROM information_schema.triggers
WHERE trigger_name = 'objects_notify_change';
```

## Troubleshooting

### No Notifications Received

1. Verify trigger is installed:
   ```sql
   \dS+ objects
   ```

2. Check NotificationHandler is listening:
   ```bash
   # Check logs for "Notification handler connected to PostgreSQL"
   docker logs mcp-server
   ```

3. Test notification delivery:
   ```sql
   UPDATE objects SET stage = 'doing' WHERE id = 1;
   -- Should broadcast notification to connected clients
   ```

### Incomplete Change Tracking

If `added_relationships` or `removed_relationships` are empty when they shouldn't be:

1. Verify JSONB arrays are properly formatted
2. Check that comparison logic works with your data
3. Test with simpler updates to isolate issue

## Future Enhancements

Potential improvements:
- Add `dependencies_added` and `dependencies_removed` tracking
- Include specific field changes (e.g., `stage_changed`, `title_changed`)
- Add notification filtering/routing by object type
- Support for batch operation notifications
- Notification replay for reconnecting clients

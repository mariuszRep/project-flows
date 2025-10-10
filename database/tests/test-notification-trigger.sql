--
-- Test Script: Notification Trigger for Related Array Changes
-- Description: Tests the notify_data_change trigger with various relationship operations
-- Date: 2025-10-10
--

\echo '========================================='
\echo 'Testing notify_data_change trigger'
\echo '========================================='
\echo ''

-- Test 1: Add a relationship
\echo 'Test 1: Adding a relationship'
UPDATE objects
SET related = related || '[{"id": 101, "type": "blocks", "object_type": "task"}]'::jsonb
WHERE id = 956
RETURNING id, jsonb_pretty(related);

\echo ''
\echo 'Expected: related_changed=true, added_relationships contains new entry'
\echo ''

-- Test 2: Remove a relationship
\echo 'Test 2: Removing a relationship'
UPDATE objects
SET related = (
  SELECT jsonb_agg(elem)
  FROM jsonb_array_elements(related) AS elem
  WHERE elem->>'id' != '101'
)
WHERE id = 956
RETURNING id, jsonb_pretty(related);

\echo ''
\echo 'Expected: related_changed=true, removed_relationships contains removed entry'
\echo ''

-- Test 3: Update parent_id (should trigger parent_id_changed)
\echo 'Test 3: Updating parent_id'
UPDATE objects
SET parent_id = 83
WHERE id = 957
RETURNING id, parent_id, jsonb_pretty(related);

\echo ''
\echo 'Expected: parent_id_changed=true, related_changed=true (due to sync trigger)'
\echo ''

-- Test 4: Update stage (should not trigger relationship changes)
\echo 'Test 4: Updating stage only'
UPDATE objects
SET stage = 'review'
WHERE id = 957
RETURNING id, stage, parent_id, jsonb_pretty(related);

\echo ''
\echo 'Expected: related_changed=false, parent_id_changed=false, dependencies_changed=false'
\echo ''

-- Test 5: Replace entire related array
\echo 'Test 5: Replacing entire related array'
UPDATE objects
SET related = '[
  {"id": 947, "type": "parent", "object_type": "epic"},
  {"id": 200, "type": "related_to", "object_type": "task"},
  {"id": 201, "type": "depends_on", "object_type": "task"}
]'::jsonb
WHERE id = 956
RETURNING id, jsonb_pretty(related);

\echo ''
\echo 'Expected: related_changed=true, added_relationships and removed_relationships both populated'
\echo ''

-- Test 6: Insert new object (should include related in notification)
\echo 'Test 6: Inserting new object with relationships'
INSERT INTO objects (template_id, parent_id, stage, related)
VALUES (
  1,
  947,
  'draft',
  '[{"id": 947, "type": "parent", "object_type": "epic"}]'::jsonb
)
RETURNING id, parent_id, jsonb_pretty(related);

\echo ''
\echo 'Expected: event_type=created, includes related array in payload'
\echo ''

-- Test 7: Update dependencies array
\echo 'Test 7: Updating dependencies array'
UPDATE objects
SET dependencies = '[{"id": 950, "type": "blocks"}]'::jsonb
WHERE id = 956
RETURNING id, jsonb_pretty(dependencies);

\echo ''
\echo 'Expected: dependencies_changed=true'
\echo ''

-- Summary
\echo '========================================='
\echo 'Test Summary'
\echo '========================================='
\echo ''
\echo 'All tests completed. Check application logs or database notifications'
\echo 'to verify that proper notification payloads were sent for each operation.'
\echo ''
\echo 'Expected notification structure for UPDATE operations:'
\echo '{
  "event_type": "updated",
  "object_type": "task",
  "object_id": <id>,
  "template_id": 1,
  "parent_id": <parent_id>,
  "stage": "<stage>",
  "related": [...],
  "dependencies": [...],
  "updated_by": "<user>",
  "timestamp": "<iso_timestamp>",
  "changes": {
    "related_changed": true/false,
    "dependencies_changed": true/false,
    "parent_id_changed": true/false,
    "added_relationships": [...],
    "removed_relationships": [...]
  }
}'
\echo ''

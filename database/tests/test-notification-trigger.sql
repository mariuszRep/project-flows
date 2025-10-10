-- =========================================
-- Testing notify_data_change trigger (P3)
-- =========================================

RAISE NOTICE 'Test 1: Adding a relationship';
UPDATE objects
SET related = related || '[{"id": 101, "type": "blocks", "object_type": "task"}]'::jsonb
WHERE id = 956
RETURNING id, jsonb_pretty(related);

RAISE NOTICE 'Test 2: Removing a relationship';
UPDATE objects
SET related = (
  SELECT jsonb_agg(elem)
  FROM jsonb_array_elements(related) AS elem
  WHERE elem->>'id' != '101'
)
WHERE id = 956
RETURNING id, jsonb_pretty(related);

RAISE NOTICE 'Test 3: Replacing entire related array (includes new parent)';
UPDATE objects
SET related = '[
  {"id": 947, "type": "parent", "object_type": "epic"},
  {"id": 200, "type": "related_to", "object_type": "task"},
  {"id": 201, "type": "depends_on", "object_type": "task"}
]'::jsonb
WHERE id = 956
RETURNING id, jsonb_pretty(related);

RAISE NOTICE 'Test 4: Updating stage only';
UPDATE objects
SET stage = 'review'
WHERE id = 957
RETURNING id, stage, jsonb_pretty(related);

RAISE NOTICE 'Test 5: Inserting new object with relationships';
INSERT INTO objects (template_id, stage, related)
VALUES (
  1,
  'draft',
  '[{"id": 947, "type": "parent", "object_type": "epic"}]'::jsonb
)
RETURNING id, jsonb_pretty(related);

RAISE NOTICE 'Test 6: Updating dependencies array';
UPDATE objects
SET dependencies = '[{"id": 950, "type": "blocks"}]'::jsonb
WHERE id = 956
RETURNING id, jsonb_pretty(dependencies);

RAISE NOTICE 'Tests complete. Check application logs for notifications; parent_id is derived from the related array.';

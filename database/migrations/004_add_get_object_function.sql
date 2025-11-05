-- Migration: Add get_object function node
-- Date: 2025-11-05
-- Description: Creates get_object function node that wraps the get_object MCP tool

-- Create get_object function node
INSERT INTO templates (name, description, type, metadata, created_by, updated_by)
VALUES (
  'get_object',
  'Retrieve an object from the database by its numeric ID',
  'node',
  '{"function_handler": "get_object", "category": "database", "version": "1.0.0"}',
  'system',
  'system'
) ON CONFLICT DO NOTHING;

-- Get template ID for get_object
DO $$
DECLARE
  get_object_template_id INTEGER;
BEGIN
  SELECT id INTO get_object_template_id FROM templates WHERE name = 'get_object' AND type = 'node';

  IF get_object_template_id IS NOT NULL THEN
    -- Add parameter 'object_id'
    INSERT INTO template_properties (template_id, key, type, description, step_type, step_config, execution_order, created_by, updated_by)
    VALUES (
      get_object_template_id,
      'object_id',
      'number',
      'The numeric ID of the object to retrieve',
      'property',
      '{"required": true}',
      1,
      'system',
      'system'
    ) ON CONFLICT (template_id, key) DO NOTHING;
  END IF;
END $$;

-- Verify node template was created
SELECT
  t.id,
  t.name,
  t.type,
  t.description,
  t.metadata->>'function_handler' as handler,
  COUNT(tp.id) as parameter_count
FROM templates t
LEFT JOIN template_properties tp ON tp.template_id = t.id AND tp.step_type = 'property'
WHERE t.name = 'get_object' AND t.type = 'node'
GROUP BY t.id, t.name, t.type, t.description, t.metadata;

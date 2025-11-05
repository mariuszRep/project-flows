-- Migration: Seed initial function node templates
-- Date: 2025-11-05
-- Description: Creates example function nodes (add_numbers, hello_world)

-- Create add_numbers function node
INSERT INTO templates (name, description, type, metadata, created_by, updated_by)
VALUES (
  'add_numbers',
  'Adds two numbers together (TEST FUNCTION)',
  'node',
  '{"function_handler": "add_numbers", "category": "math", "version": "1.0.0"}',
  'system',
  'system'
) ON CONFLICT DO NOTHING;

-- Get template ID for add_numbers
DO $$
DECLARE
  add_numbers_template_id INTEGER;
BEGIN
  SELECT id INTO add_numbers_template_id FROM templates WHERE name = 'add_numbers' AND type = 'node';

  IF add_numbers_template_id IS NOT NULL THEN
    -- Add parameter 'a'
    INSERT INTO template_properties (template_id, key, type, description, step_type, step_config, execution_order, created_by, updated_by)
    VALUES (
      add_numbers_template_id,
      'a',
      'number',
      'First number',
      'property',
      '{"required": true}',
      1,
      'system',
      'system'
    ) ON CONFLICT (template_id, key) DO NOTHING;

    -- Add parameter 'b'
    INSERT INTO template_properties (template_id, key, type, description, step_type, step_config, execution_order, created_by, updated_by)
    VALUES (
      add_numbers_template_id,
      'b',
      'number',
      'Second number',
      'property',
      '{"required": true}',
      2,
      'system',
      'system'
    ) ON CONFLICT (template_id, key) DO NOTHING;
  END IF;
END $$;

-- Create hello_world function node
INSERT INTO templates (name, description, type, metadata, created_by, updated_by)
VALUES (
  'hello_world',
  'Returns a greeting message (TEST FUNCTION)',
  'node',
  '{"function_handler": "hello_world", "category": "utility", "version": "1.0.0"}',
  'system',
  'system'
) ON CONFLICT DO NOTHING;

-- Get template ID for hello_world
DO $$
DECLARE
  hello_world_template_id INTEGER;
BEGIN
  SELECT id INTO hello_world_template_id FROM templates WHERE name = 'hello_world' AND type = 'node';

  IF hello_world_template_id IS NOT NULL THEN
    -- Add parameter 'name'
    INSERT INTO template_properties (template_id, key, type, description, step_type, step_config, execution_order, created_by, updated_by)
    VALUES (
      hello_world_template_id,
      'name',
      'text',
      'Name to greet (optional, defaults to World)',
      'property',
      '{"required": false, "default": "World"}',
      1,
      'system',
      'system'
    ) ON CONFLICT (template_id, key) DO NOTHING;
  END IF;
END $$;

-- Verify node templates were created
SELECT
  t.id,
  t.name,
  t.type,
  t.description,
  t.metadata->>'function_handler' as handler,
  COUNT(tp.id) as parameter_count
FROM templates t
LEFT JOIN template_properties tp ON tp.template_id = t.id AND tp.step_type = 'property'
WHERE t.type = 'node'
GROUP BY t.id, t.name, t.type, t.description, t.metadata;

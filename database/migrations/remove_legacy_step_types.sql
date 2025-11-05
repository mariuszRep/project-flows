-- Migration: Remove legacy step types from template_properties
-- Date: 2025-11-05
-- Description: Tightens CHECK constraint to only allow 4 step types:
--              property, agent, create_object, load_object
--
-- This migration removes 9 legacy step types:
--   - start (auto-created workflow entry nodes)
--   - call_tool (MCP tool invocation)
--   - log (logging messages)
--   - set_variable (variable assignment)
--   - conditional (if/then/else branching)
--   - return (return values)
--   - load_state (load from global_state table)
--   - save_state (save to global_state table)
--   - switch (case-based branching)
--
-- Backend code already refactored (commit d510495) to work without start nodes.
-- Tool names and input schemas preserved in templates.metadata field.
--
-- ROLLBACK: See rollback_remove_legacy_step_types.sql
--           Note: Deleted start node data cannot be recovered without backup restore

BEGIN;

-- Step 1: Delete all start nodes
-- Current state: 1 start node exists (template_id 56, execution_order 1)
DELETE FROM template_properties WHERE step_type = 'start';

-- Step 2: Renumber execution_order for remaining steps
-- Ensures no gaps in sequence, starting from 1 for each template_id
WITH renumbered AS (
  SELECT
    id,
    ROW_NUMBER() OVER (PARTITION BY template_id ORDER BY execution_order) as new_order
  FROM template_properties
  WHERE step_type IS NOT NULL
)
UPDATE template_properties tp
SET execution_order = r.new_order
FROM renumbered r
WHERE tp.id = r.id;

-- Step 3: Drop old CHECK constraint
-- Old constraint allows 13 step types (including 9 legacy types)
ALTER TABLE template_properties
DROP CONSTRAINT IF EXISTS template_properties_step_type_check;

-- Step 4: Add new CHECK constraint with only 4 allowed types
-- property: Workflow input parameters
-- agent: AI agent execution with instructions
-- create_object: Dynamic object creation (Task, Project, Epic, Rule)
-- load_object: Load object property schemas for agent population
ALTER TABLE template_properties
ADD CONSTRAINT template_properties_step_type_check
CHECK (step_type = ANY (ARRAY[
  'property'::text,
  'agent'::text,
  'create_object'::text,
  'load_object'::text
]));

COMMIT;

-- Verification queries (run manually after migration):
-- SELECT COUNT(*) FROM template_properties WHERE step_type = 'start'; -- Should return 0
-- SELECT DISTINCT step_type FROM template_properties ORDER BY step_type; -- Should show only 4 types
-- SELECT template_id, key, step_type, execution_order FROM template_properties WHERE template_id IN (16, 56) ORDER BY template_id, execution_order;

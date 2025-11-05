-- Rollback Migration: Restore legacy step types CHECK constraint
-- Date: 2025-11-05
-- Description: Rollback for remove_legacy_step_types.sql migration
--
-- ⚠️  WARNING: This rollback only restores the CHECK constraint.
--              Deleted start node data CANNOT be recovered without backup restore.
--
-- To fully restore data:
--   1. Run this rollback migration to restore constraint
--   2. Restore database from backup: make restore FILE=database/backups/full_backup_20251105_102824.dump
--
-- This rollback restores the CHECK constraint to allow all 13 step types:
--   property, agent, create_object, load_object (active types)
--   start, call_tool, log, set_variable, conditional, return,
--   load_state, save_state, switch (legacy types)

BEGIN;

-- Step 1: Drop the tightened CHECK constraint
ALTER TABLE template_properties
DROP CONSTRAINT IF EXISTS template_properties_step_type_check;

-- Step 2: Restore original CHECK constraint with all 13 step types
-- This matches the constraint from add_load_object_step_type.sql
ALTER TABLE template_properties
ADD CONSTRAINT template_properties_step_type_check
CHECK (step_type = ANY (ARRAY[
  'property'::text,
  'call_tool'::text,
  'log'::text,
  'set_variable'::text,
  'conditional'::text,
  'return'::text,
  'start'::text,
  'create_object'::text,
  'load_object'::text,
  'load_state'::text,
  'save_state'::text,
  'switch'::text,
  'agent'::text
]));

COMMIT;

-- Post-rollback notes:
-- - CHECK constraint now allows legacy step types again
-- - Deleted start nodes NOT restored (requires backup restore)
-- - execution_order renumbering NOT reversed (requires backup restore)
-- - To restore full data state, use backup from before migration

-- Migration: Add all workflow step types to template_properties
-- Date: 2025-10-22
-- Description: Adds support for all workflow step types including agent, load_state, save_state, switch, and create_object

-- Drop the existing constraint
ALTER TABLE template_properties DROP CONSTRAINT IF EXISTS template_properties_step_type_check;

-- Add the new constraint with ALL step types
ALTER TABLE template_properties ADD CONSTRAINT template_properties_step_type_check
CHECK (step_type = ANY (ARRAY[
  'property'::text,
  'call_tool'::text,
  'log'::text,
  'set_variable'::text,
  'conditional'::text,
  'return'::text,
  'start'::text,
  'create_object'::text,
  'agent'::text,
  'load_state'::text,
  'save_state'::text,
  'switch'::text
]));

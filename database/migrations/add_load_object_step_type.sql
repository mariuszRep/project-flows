-- Migration: Add 'load_object' step type to template_properties
-- Date: 2025-10-22
-- Description: Allows workflow steps to load object property schemas for agent population

-- Drop the existing constraint
ALTER TABLE template_properties DROP CONSTRAINT IF EXISTS template_properties_step_type_check;

-- Add the new constraint with 'load_object' included
ALTER TABLE template_properties ADD CONSTRAINT template_properties_step_type_check
CHECK (step_type = ANY (ARRAY['property'::text, 'call_tool'::text, 'log'::text, 'set_variable'::text, 'conditional'::text, 'return'::text, 'start'::text, 'create_object'::text, 'load_object'::text, 'load_state'::text, 'save_state'::text, 'switch'::text, 'agent'::text]));

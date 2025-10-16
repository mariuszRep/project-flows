-- Migration: Add 'start' step type to template_properties check constraint
-- Date: 2025-10-16
-- Description: Allows workflow start nodes to be persisted as template properties

-- Drop the existing constraint
ALTER TABLE template_properties DROP CONSTRAINT IF EXISTS template_properties_step_type_check;

-- Add the new constraint with 'start' included
ALTER TABLE template_properties ADD CONSTRAINT template_properties_step_type_check
CHECK (step_type = ANY (ARRAY['property'::text, 'call_tool'::text, 'log'::text, 'set_variable'::text, 'conditional'::text, 'return'::text, 'start'::text]));

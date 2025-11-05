-- Migration: Add 'call_function' step type
-- Purpose: Enable workflows to call internal functions
-- Date: 2025-11-05
--
-- This migration adds 'call_function' to the allowed step_type values
-- in the template_properties table.

-- Drop the existing constraint
ALTER TABLE template_properties
  DROP CONSTRAINT IF EXISTS template_properties_step_type_check;

-- Add the updated constraint with 'call_function'
ALTER TABLE template_properties
  ADD CONSTRAINT template_properties_step_type_check
  CHECK ((step_type = ANY (ARRAY[
    'property'::text,
    'agent'::text,
    'create_object'::text,
    'load_object'::text,
    'call_function'::text
  ])));

-- Add comment to document the new step type
COMMENT ON CONSTRAINT template_properties_step_type_check ON template_properties IS
  'Allowed step types: property (data property), agent (AI instructions), create_object (create DB object), load_object (load object properties), call_function (call internal function)';

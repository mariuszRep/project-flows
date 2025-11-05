-- Migration: Add 'node' type to templates for workflow function definitions
-- Date: 2025-11-05
-- Description: Extends template types to support function nodes as first-class templates

-- Drop the existing constraint
ALTER TABLE templates DROP CONSTRAINT IF EXISTS templates_type_check;

-- Add the new constraint with 'node' type
ALTER TABLE templates ADD CONSTRAINT templates_type_check
CHECK (type = ANY (ARRAY['object'::text, 'workflow'::text, 'node'::text]));

-- Update comment to document the new type
COMMENT ON COLUMN templates.type IS 'Template type: "object" for data templates, "workflow" for executable workflows, "node" for workflow function definitions';

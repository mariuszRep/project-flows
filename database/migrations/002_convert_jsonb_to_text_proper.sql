-- Migration: Convert blocks.content from JSONB to TEXT (Proper Version)
-- This migration handles existing data and converts it properly

BEGIN;

-- First, let's see what we're working with
SELECT 'Current schema before migration:' as status;

-- Add a new TEXT column
ALTER TABLE blocks ADD COLUMN content_new TEXT;

-- Convert existing JSONB data to text format
UPDATE blocks SET content_new = CASE 
    -- Handle JSON strings (remove quotes)
    WHEN jsonb_typeof(content) = 'string' THEN content #>> '{}'
    -- Handle JSON arrays (convert to comma-separated text)
    WHEN jsonb_typeof(content) = 'array' THEN (
        SELECT string_agg(elem #>> '{}', ', ')
        FROM jsonb_array_elements(content) AS elem
    )
    -- Handle JSON objects (convert to key: value pairs)
    WHEN jsonb_typeof(content) = 'object' THEN (
        SELECT string_agg(concat(key, ': ', value #>> '{}'), ', ')
        FROM jsonb_each(content) AS kv(key, value)
    )
    -- Handle other types (null, boolean, number)
    ELSE content #>> '{}'
END;

-- Verify the conversion worked
SELECT 'Conversion verification:' as status;
SELECT id, property_name, content as old_content, content_new as new_content 
FROM blocks 
LIMIT 3;

-- Drop the old JSONB column
ALTER TABLE blocks DROP COLUMN content;

-- Rename the new column to content
ALTER TABLE blocks RENAME COLUMN content_new TO content;

-- Add NOT NULL constraint
ALTER TABLE blocks ALTER COLUMN content SET NOT NULL;

-- Update any comments
COMMENT ON COLUMN blocks.content IS 'Text content (converted from JSONB to handle complex data display)';

SELECT 'Migration completed successfully!' as status;

COMMIT;
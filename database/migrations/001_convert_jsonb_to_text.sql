-- Migration: Convert blocks.content from JSONB to TEXT
-- This migration flattens complex JSON data structures to simple text

BEGIN;

-- Create a function to flatten JSONB content to text
CREATE OR REPLACE FUNCTION flatten_jsonb_to_text(content JSONB) RETURNS TEXT AS $$
BEGIN
    -- Handle null values
    IF content IS NULL THEN
        RETURN '';
    END IF;
    
    -- Handle simple strings (remove quotes)
    IF jsonb_typeof(content) = 'string' THEN
        RETURN content #>> '{}';
    END IF;
    
    -- Handle arrays - convert to comma-separated values
    IF jsonb_typeof(content) = 'array' THEN
        RETURN array_to_string(
            ARRAY(SELECT jsonb_array_elements_text(content)), 
            ', '
        );
    END IF;
    
    -- Handle objects - convert to comma-separated key:value pairs
    IF jsonb_typeof(content) = 'object' THEN
        RETURN array_to_string(
            ARRAY(
                SELECT key || ': ' || value 
                FROM jsonb_each_text(content)
            ), 
            ', '
        );
    END IF;
    
    -- Handle numbers, booleans, etc. - convert to string
    RETURN content #>> '{}';
END;
$$ LANGUAGE plpgsql;

-- Create a temporary column to store the flattened content
ALTER TABLE blocks ADD COLUMN content_text TEXT;

-- Populate the text column with flattened data
UPDATE blocks SET content_text = flatten_jsonb_to_text(content);

-- Drop the original JSONB column
ALTER TABLE blocks DROP COLUMN content;

-- Rename the text column to content
ALTER TABLE blocks RENAME COLUMN content_text TO content;

-- Make the content column NOT NULL
ALTER TABLE blocks ALTER COLUMN content SET NOT NULL;

-- Drop the helper function as it's no longer needed
DROP FUNCTION flatten_jsonb_to_text(JSONB);

-- Update the comment for the table
COMMENT ON COLUMN blocks.content IS 'Flattened text content (converted from JSONB)';

COMMIT;
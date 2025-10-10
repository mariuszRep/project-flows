--
-- Migration Fix: Improve Bidirectional Sync Trigger Logic
-- Description: Fixes sync_parent_id_to_related() to only trigger when parent_id changes
--              Prevents circular trigger execution when related array is updated directly
-- Date: 2025-10-10
-- Author: Claude Code
--

-- Drop and recreate the function with improved logic
CREATE OR REPLACE FUNCTION sync_parent_id_to_related() RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    parent_template_id integer;
    parent_type text;
    existing_parent_entry jsonb;
BEGIN
    -- Only proceed if parent_id has changed (or it's an INSERT)
    IF TG_OP = 'INSERT' OR NEW.parent_id IS DISTINCT FROM OLD.parent_id THEN
        IF NEW.parent_id IS NOT NULL THEN
            -- Get parent template_id to determine type
            SELECT template_id INTO parent_template_id
            FROM objects
            WHERE id = NEW.parent_id;

            -- Determine parent type from template_id
            parent_type := CASE parent_template_id
                WHEN 1 THEN 'task'
                WHEN 2 THEN 'project'
                WHEN 3 THEN 'epic'
                WHEN 4 THEN 'rule'
                ELSE 'object'
            END;

            -- Initialize related as empty array if null
            IF NEW.related IS NULL THEN
                NEW.related := '[]'::jsonb;
            END IF;

            -- Replace entire related array with current parent (single parent only)
            NEW.related := jsonb_build_array(
                jsonb_build_object(
                    'id', NEW.parent_id,
                    'object', parent_type
                )
            );
        ELSE
            -- If parent_id is NULL, clear the related array
            NEW.related := '[]'::jsonb;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION sync_parent_id_to_related() IS
'Maintains bidirectional sync from parent_id to related array. Only triggers when parent_id changes to prevent circular execution with sync_related_to_parent_id().';

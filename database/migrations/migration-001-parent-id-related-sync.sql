--
-- Migration: Parent ID to Related Array Bidirectional Sync
-- Description: Adds PostgreSQL triggers to maintain bidirectional synchronization
--              between parent_id column and related JSONB array during transition period
-- Date: 2025-10-10
-- Author: Claude Code
--

-- ==============================================================================
-- MIGRATION UP
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- Function: sync_parent_id_to_related()
-- Purpose: Automatically adds parent relationship to related array when parent_id is set
-- Trigger: BEFORE INSERT OR UPDATE on objects table
-- ------------------------------------------------------------------------------
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
'Maintains bidirectional sync from parent_id to related array. When parent_id is set, automatically adds a parent relationship entry to the related JSONB array.';

-- ------------------------------------------------------------------------------
-- Function: sync_related_to_parent_id()
-- Purpose: Automatically updates parent_id when parent relationship changes in related array
-- Trigger: BEFORE INSERT OR UPDATE on objects table
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION sync_related_to_parent_id() RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    parent_entry jsonb;
    new_parent_id integer;
BEGIN
    -- Only proceed if related array has changed
    IF NEW.related IS DISTINCT FROM OLD.related OR TG_OP = 'INSERT' THEN
        -- Extract first parent entry from related array (simpler format - no type filtering)
        SELECT elem INTO parent_entry
        FROM jsonb_array_elements(NEW.related) AS elem
        LIMIT 1;

        -- If parent relationship exists, extract the ID
        IF parent_entry IS NOT NULL THEN
            new_parent_id := (parent_entry->>'id')::integer;

            -- Update parent_id if it's different
            IF NEW.parent_id IS DISTINCT FROM new_parent_id THEN
                NEW.parent_id := new_parent_id;
            END IF;
        ELSE
            -- No parent relationship in related array, set parent_id to NULL
            IF NEW.parent_id IS NOT NULL THEN
                NEW.parent_id := NULL;
            END IF;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION sync_related_to_parent_id() IS
'Maintains bidirectional sync from related array to parent_id. When a parent relationship is added/modified in the related array, automatically updates the parent_id column.';

-- ------------------------------------------------------------------------------
-- Create triggers in correct order
-- ------------------------------------------------------------------------------

-- First: Sync related -> parent_id (runs first to extract parent from related array)
CREATE TRIGGER sync_related_to_parent_id_trigger
    BEFORE INSERT OR UPDATE ON objects
    FOR EACH ROW
    EXECUTE FUNCTION sync_related_to_parent_id();

COMMENT ON TRIGGER sync_related_to_parent_id_trigger ON objects IS
'Trigger to sync parent relationship from related array to parent_id column';

-- Second: Sync parent_id -> related (runs after to add parent to related array)
CREATE TRIGGER sync_parent_id_to_related_trigger
    BEFORE INSERT OR UPDATE ON objects
    FOR EACH ROW
    EXECUTE FUNCTION sync_parent_id_to_related();

COMMENT ON TRIGGER sync_parent_id_to_related_trigger ON objects IS
'Trigger to sync parent_id column to related array with parent relationship';

-- ==============================================================================
-- VALIDATION QUERIES
-- ==============================================================================

-- Run these queries after migration to verify data integrity

-- Check: Count objects with parent_id but no parent in related array
DO $$
DECLARE
    mismatch_count integer;
BEGIN
    SELECT COUNT(*) INTO mismatch_count
    FROM objects o
    WHERE o.parent_id IS NOT NULL
    AND NOT EXISTS (
        SELECT 1
        FROM jsonb_array_elements(o.related) AS elem
        WHERE elem->>'type' = 'parent'
        AND (elem->>'id')::integer = o.parent_id
    );

    RAISE NOTICE 'Objects with parent_id but no parent in related array: %', mismatch_count;

    IF mismatch_count > 0 THEN
        RAISE WARNING 'Found % objects with parent_id not reflected in related array', mismatch_count;
    END IF;
END $$;

-- Check: Count objects with parent in related array but no parent_id
DO $$
DECLARE
    mismatch_count integer;
BEGIN
    SELECT COUNT(*) INTO mismatch_count
    FROM objects o
    WHERE EXISTS (
        SELECT 1
        FROM jsonb_array_elements(o.related) AS elem
        WHERE elem->>'type' = 'parent'
    )
    AND (
        o.parent_id IS NULL
        OR NOT EXISTS (
            SELECT 1
            FROM jsonb_array_elements(o.related) AS elem
            WHERE elem->>'type' = 'parent'
            AND (elem->>'id')::integer = o.parent_id
        )
    );

    RAISE NOTICE 'Objects with parent in related but mismatched parent_id: %', mismatch_count;

    IF mismatch_count > 0 THEN
        RAISE WARNING 'Found % objects with parent in related array not matching parent_id', mismatch_count;
    END IF;
END $$;

-- Display objects with inconsistencies for manual review
SELECT
    id,
    parent_id,
    related,
    template_id,
    stage
FROM objects
WHERE (
    -- Case 1: parent_id set but no parent in related
    (parent_id IS NOT NULL AND NOT EXISTS (
        SELECT 1
        FROM jsonb_array_elements(related) AS elem
        WHERE elem->>'type' = 'parent'
        AND (elem->>'id')::integer = parent_id
    ))
    OR
    -- Case 2: parent in related but different from parent_id
    (EXISTS (
        SELECT 1
        FROM jsonb_array_elements(related) AS elem
        WHERE elem->>'type' = 'parent'
    ) AND (
        parent_id IS NULL
        OR NOT EXISTS (
            SELECT 1
            FROM jsonb_array_elements(related) AS elem
            WHERE elem->>'type' = 'parent'
            AND (elem->>'id')::integer = parent_id
        )
    ))
)
ORDER BY id;

-- ==============================================================================
-- ROLLBACK SCRIPT
-- ==============================================================================

-- Uncomment and run the following to rollback this migration:

/*
-- Drop triggers (order doesn't matter for removal)
DROP TRIGGER IF EXISTS sync_parent_id_to_related_trigger ON objects;
DROP TRIGGER IF EXISTS sync_related_to_parent_id_trigger ON objects;

-- Drop functions
DROP FUNCTION IF EXISTS sync_parent_id_to_related();
DROP FUNCTION IF EXISTS sync_related_to_parent_id();

-- Verify triggers are removed
SELECT
    trigger_name,
    event_manipulation,
    event_object_table,
    action_timing
FROM information_schema.triggers
WHERE trigger_name IN ('sync_parent_id_to_related_trigger', 'sync_related_to_parent_id_trigger')
AND event_object_table = 'objects';

-- Should return no rows if rollback successful
*/

--
-- Rollback Migration 002: Remove parent entries from related arrays
-- Description: Reverses the data migration by removing all parent-type entries
--              from the related JSONB array while preserving other relationships
-- Date: 2025-10-10
-- Author: Claude Code
--

-- ==============================================================================
-- PRE-ROLLBACK VALIDATION
-- ==============================================================================

DO $$
DECLARE
    records_with_parent_in_related integer;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'ROLLBACK: Remove parent from related arrays';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';

    -- Count records with parent entries in related array
    SELECT COUNT(*) INTO records_with_parent_in_related
    FROM objects
    WHERE EXISTS (
        SELECT 1 FROM jsonb_array_elements(related) elem
        WHERE elem->>'type' = 'parent'
    );

    RAISE NOTICE '📊 Pre-Rollback Status:';
    RAISE NOTICE '  Records with parent in related array: %', records_with_parent_in_related;
    RAISE NOTICE '';

    IF records_with_parent_in_related = 0 THEN
        RAISE NOTICE '✅ No parent entries found in related arrays. Nothing to rollback.';
    ELSE
        RAISE NOTICE '▶ Starting rollback of % records...', records_with_parent_in_related;
    END IF;
    RAISE NOTICE '';
END $$;

-- ==============================================================================
-- ROLLBACK: Remove parent entries from related arrays
-- ==============================================================================

DO $$
DECLARE
    records_updated integer;
    start_time timestamp;
    elapsed_interval interval;
BEGIN
    start_time := clock_timestamp();

    RAISE NOTICE '🔄 Removing parent entries from related arrays...';
    RAISE NOTICE '';

    -- Update all records with parent in related array
    WITH updated AS (
        UPDATE objects
        SET related = (
            SELECT COALESCE(jsonb_agg(elem), '[]'::jsonb)
            FROM jsonb_array_elements(related) AS elem
            WHERE elem->>'type' != 'parent'
        )
        WHERE EXISTS (
            SELECT 1 FROM jsonb_array_elements(related) elem
            WHERE elem->>'type' = 'parent'
        )
        RETURNING id
    )
    SELECT COUNT(*) INTO records_updated FROM updated;

    elapsed_interval := clock_timestamp() - start_time;

    RAISE NOTICE '✅ Rollback completed!';
    RAISE NOTICE '  Records updated: %', records_updated;
    RAISE NOTICE '  Time elapsed: %', elapsed_interval;
    RAISE NOTICE '';
END $$;

-- ==============================================================================
-- POST-ROLLBACK VALIDATION
-- ==============================================================================

DO $$
DECLARE
    records_with_parent_in_related integer;
    records_with_parent_id integer;
    records_with_other_relations integer;
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE '📊 POST-ROLLBACK VALIDATION';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';

    -- Count records still with parent in related
    SELECT COUNT(*) INTO records_with_parent_in_related
    FROM objects
    WHERE EXISTS (
        SELECT 1 FROM jsonb_array_elements(related) elem
        WHERE elem->>'type' = 'parent'
    );

    -- Count records with parent_id (should be unchanged)
    SELECT COUNT(*) INTO records_with_parent_id
    FROM objects
    WHERE parent_id IS NOT NULL;

    -- Count records with other (non-parent) relations
    SELECT COUNT(*) INTO records_with_other_relations
    FROM objects
    WHERE related IS NOT NULL
    AND related != '[]'::jsonb
    AND EXISTS (
        SELECT 1 FROM jsonb_array_elements(related) elem
        WHERE elem->>'type' != 'parent'
    );

    RAISE NOTICE 'Results:';
    RAISE NOTICE '  Records with parent in related: %', records_with_parent_in_related;
    RAISE NOTICE '  Records with parent_id (unchanged): %', records_with_parent_id;
    RAISE NOTICE '  Records with other relations (preserved): %', records_with_other_relations;
    RAISE NOTICE '';

    IF records_with_parent_in_related = 0 THEN
        RAISE NOTICE '✅ ROLLBACK SUCCESSFUL: All parent entries removed from related arrays!';
        RAISE NOTICE '   Note: parent_id column values remain intact.';
    ELSE
        RAISE WARNING 'Some records still have parent in related array (%). Review manually.', records_with_parent_in_related;
    END IF;
    RAISE NOTICE '';
END $$;

-- Display sample records after rollback
SELECT
    id,
    parent_id,
    related,
    template_id,
    stage
FROM objects
WHERE parent_id IS NOT NULL
ORDER BY id
LIMIT 5;

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Sample records displayed above';
    RAISE NOTICE 'Note: parent_id is preserved, related arrays cleaned';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
END $$;

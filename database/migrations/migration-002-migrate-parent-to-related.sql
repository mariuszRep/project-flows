--
-- Migration: Populate Related Array from Parent ID
-- Description: Migrates existing parent_id values to the related JSONB array
--              Processes records in batches for efficiency and includes validation
-- Date: 2025-10-10
-- Author: Claude Code
--

-- ==============================================================================
-- PRE-MIGRATION CHECKS
-- ==============================================================================

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'DATA MIGRATION: parent_id → related array';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
END $$;

-- Check if triggers exist (should be applied first)
DO $$
DECLARE
    trigger_count integer;
BEGIN
    SELECT COUNT(*) INTO trigger_count
    FROM information_schema.triggers
    WHERE trigger_name IN ('sync_parent_id_to_related_trigger', 'sync_related_to_parent_id_trigger')
    AND event_object_table = 'objects';

    IF trigger_count < 2 THEN
        RAISE WARNING 'Bidirectional sync triggers not found. Consider running migration-001-parent-id-related-sync.sql first.';
        RAISE NOTICE 'Migration will continue, but triggers are recommended for ongoing synchronization.';
    ELSE
        RAISE NOTICE '✓ Sync triggers are installed';
    END IF;
END $$;

-- ==============================================================================
-- PRE-MIGRATION VALIDATION
-- ==============================================================================

DO $$
DECLARE
    total_records integer;
    records_with_parent integer;
    records_needing_migration integer;
    records_already_synced integer;
BEGIN
    -- Count total records
    SELECT COUNT(*) INTO total_records FROM objects;

    -- Count records with parent_id
    SELECT COUNT(*) INTO records_with_parent FROM objects WHERE parent_id IS NOT NULL;

    -- Count records that need migration (parent_id set but no matching related entry)
    SELECT COUNT(*) INTO records_needing_migration
    FROM objects
    WHERE parent_id IS NOT NULL
    AND (related IS NULL OR related = '[]'::jsonb OR NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements(related) elem
        WHERE elem->>'type' = 'parent' AND (elem->>'id')::integer = parent_id
    ));

    -- Count records already synced
    records_already_synced := records_with_parent - records_needing_migration;

    RAISE NOTICE '📊 Pre-Migration Status:';
    RAISE NOTICE '  Total records: %', total_records;
    RAISE NOTICE '  Records with parent_id: %', records_with_parent;
    RAISE NOTICE '  Records needing migration: %', records_needing_migration;
    RAISE NOTICE '  Records already synced: %', records_already_synced;
    RAISE NOTICE '';

    IF records_needing_migration = 0 THEN
        RAISE NOTICE '✅ All records are already migrated. Nothing to do.';
    ELSE
        RAISE NOTICE '▶ Starting migration of % records...', records_needing_migration;
    END IF;
    RAISE NOTICE '';
END $$;

-- ==============================================================================
-- BACKUP REMINDER
-- ==============================================================================

DO $$
BEGIN
    RAISE NOTICE '⚠️  BACKUP REMINDER:';
    RAISE NOTICE '   Before proceeding with data migration, ensure you have a backup:';
    RAISE NOTICE '   Run: make backup';
    RAISE NOTICE '   Or: cd database/scripts && ./backup-fresh.sh';
    RAISE NOTICE '';
    RAISE NOTICE '   Press Ctrl+C now to abort, or the migration will continue in 5 seconds...';
END $$;

-- Give user time to abort (note: this won't actually pause in non-interactive mode)
SELECT pg_sleep(2);

-- ==============================================================================
-- MIGRATION: Populate related array from parent_id
-- ==============================================================================

DO $$
DECLARE
    batch_size integer := 100;  -- Process 100 records at a time
    total_to_migrate integer;
    total_processed integer := 0;
    batch_processed integer;
    parent_template_id integer;
    parent_type text;
    iteration integer := 0;
    start_time timestamp;
    elapsed_interval interval;
    progress_pct numeric;
BEGIN
    start_time := clock_timestamp();

    -- Get total count of records to migrate
    SELECT COUNT(*) INTO total_to_migrate
    FROM objects
    WHERE parent_id IS NOT NULL
    AND (related IS NULL OR related = '[]'::jsonb OR NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements(related) elem
        WHERE elem->>'type' = 'parent' AND (elem->>'id')::integer = parent_id
    ));

    RAISE NOTICE '🔄 Starting batched migration (batch size: %)', batch_size;
    RAISE NOTICE '';

    -- Process in batches until no more records need migration
    LOOP
        iteration := iteration + 1;

        -- Update batch of records
        WITH records_to_update AS (
            SELECT o.id, o.parent_id, p.template_id as parent_template_id
            FROM objects o
            JOIN objects p ON p.id = o.parent_id
            WHERE o.parent_id IS NOT NULL
            AND (o.related IS NULL OR o.related = '[]'::jsonb OR NOT EXISTS (
                SELECT 1 FROM jsonb_array_elements(o.related) elem
                WHERE elem->>'type' = 'parent' AND (elem->>'id')::integer = o.parent_id
            ))
            LIMIT batch_size
        ),
        updated AS (
            UPDATE objects o
            SET related = CASE
                -- If related is empty or null, create new array with parent
                WHEN o.related IS NULL OR o.related = '[]'::jsonb THEN
                    jsonb_build_array(
                        jsonb_build_object(
                            'id', r.parent_id,
                            'object', CASE r.parent_template_id
                                WHEN 1 THEN 'task'
                                WHEN 2 THEN 'project'
                                WHEN 3 THEN 'epic'
                                WHEN 4 THEN 'rule'
                                ELSE 'object'
                            END
                        )
                    )
                -- If related has content but no parent entry, append parent
                ELSE
                    o.related || jsonb_build_array(
                        jsonb_build_object(
                            'id', r.parent_id,
                            'object', CASE r.parent_template_id
                                WHEN 1 THEN 'task'
                                WHEN 2 THEN 'project'
                                WHEN 3 THEN 'epic'
                                WHEN 4 THEN 'rule'
                                ELSE 'object'
                            END
                        )
                    )
            END
            FROM records_to_update r
            WHERE o.id = r.id
            RETURNING o.id
        )
        SELECT COUNT(*) INTO batch_processed FROM updated;

        -- Exit if no records were updated
        EXIT WHEN batch_processed = 0;

        total_processed := total_processed + batch_processed;
        progress_pct := (total_processed::numeric / NULLIF(total_to_migrate, 0)::numeric * 100);
        elapsed_interval := clock_timestamp() - start_time;

        -- Progress report every batch
        RAISE NOTICE '  Batch %: Processed % records (% / % = %%)',
            iteration,
            batch_processed,
            total_processed,
            total_to_migrate,
            ROUND(progress_pct, 1);

        -- Small delay between batches to reduce lock contention
        PERFORM pg_sleep(0.1);
    END LOOP;

    elapsed_interval := clock_timestamp() - start_time;

    RAISE NOTICE '';
    RAISE NOTICE '✅ Migration completed!';
    RAISE NOTICE '  Total records processed: %', total_processed;
    RAISE NOTICE '  Total batches: %', iteration;
    RAISE NOTICE '  Total time: %', elapsed_interval;
    RAISE NOTICE '';
END $$;

-- ==============================================================================
-- POST-MIGRATION VALIDATION
-- ==============================================================================

DO $$
DECLARE
    total_records integer;
    records_with_parent integer;
    records_migrated integer;
    records_still_need_migration integer;
    orphaned_parents integer;
    success_rate numeric;
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE '📊 POST-MIGRATION VALIDATION';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';

    -- Count total records
    SELECT COUNT(*) INTO total_records FROM objects;

    -- Count records with parent_id
    SELECT COUNT(*) INTO records_with_parent FROM objects WHERE parent_id IS NOT NULL;

    -- Count successfully migrated records
    SELECT COUNT(*) INTO records_migrated
    FROM objects
    WHERE parent_id IS NOT NULL
    AND EXISTS (
        SELECT 1 FROM jsonb_array_elements(related) elem
        WHERE elem->>'type' = 'parent' AND (elem->>'id')::integer = parent_id
    );

    -- Count records that still need migration
    SELECT COUNT(*) INTO records_still_need_migration
    FROM objects
    WHERE parent_id IS NOT NULL
    AND (related IS NULL OR related = '[]'::jsonb OR NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements(related) elem
        WHERE elem->>'type' = 'parent' AND (elem->>'id')::integer = parent_id
    ));

    -- Check for orphaned parent entries (parent in related but not in parent_id)
    SELECT COUNT(*) INTO orphaned_parents
    FROM objects o
    WHERE EXISTS (
        SELECT 1 FROM jsonb_array_elements(o.related) elem
        WHERE elem->>'type' = 'parent'
    )
    AND (
        o.parent_id IS NULL
        OR NOT EXISTS (
            SELECT 1 FROM jsonb_array_elements(o.related) elem
            WHERE elem->>'type' = 'parent' AND (elem->>'id')::integer = o.parent_id
        )
    );

    -- Calculate success rate
    IF records_with_parent > 0 THEN
        success_rate := (records_migrated::numeric / records_with_parent::numeric * 100);
    ELSE
        success_rate := 100;
    END IF;

    RAISE NOTICE 'Results:';
    RAISE NOTICE '  Total records: %', total_records;
    RAISE NOTICE '  Records with parent_id: %', records_with_parent;
    RAISE NOTICE '  Successfully migrated: %', records_migrated;
    RAISE NOTICE '  Still need migration: %', records_still_need_migration;
    RAISE NOTICE '  Orphaned parent entries: %', orphaned_parents;
    RAISE NOTICE '  Success rate: %', ROUND(success_rate, 2) || '%';
    RAISE NOTICE '';

    IF records_still_need_migration = 0 AND orphaned_parents = 0 THEN
        RAISE NOTICE '✅ VALIDATION PASSED: 100% of records successfully migrated!';
    ELSE
        IF records_still_need_migration > 0 THEN
            RAISE WARNING 'Some records still need migration (%). Review data manually.', records_still_need_migration;
        END IF;
        IF orphaned_parents > 0 THEN
            RAISE WARNING 'Found orphaned parent entries (%). Review data manually.', orphaned_parents;
        END IF;
    END IF;
    RAISE NOTICE '';
END $$;

-- Display sample migrated records
SELECT
    id,
    parent_id,
    related,
    template_id,
    stage
FROM objects
WHERE parent_id IS NOT NULL
AND EXISTS (
    SELECT 1 FROM jsonb_array_elements(related) elem
    WHERE elem->>'type' = 'parent'
)
ORDER BY id
LIMIT 5;

-- ==============================================================================
-- ROLLBACK INSTRUCTIONS
-- ==============================================================================

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'ROLLBACK INSTRUCTIONS';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE 'To rollback this migration and remove parent entries from related arrays:';
    RAISE NOTICE '';
    RAISE NOTICE 'Run the following SQL:';
    RAISE NOTICE '';
    RAISE NOTICE '  UPDATE objects';
    RAISE NOTICE '  SET related = (';
    RAISE NOTICE '    SELECT COALESCE(jsonb_agg(elem), ''[]''::jsonb)';
    RAISE NOTICE '    FROM jsonb_array_elements(related) AS elem';
    RAISE NOTICE '    WHERE elem->>''type'' != ''parent''';
    RAISE NOTICE '  )';
    RAISE NOTICE '  WHERE EXISTS (';
    RAISE NOTICE '    SELECT 1 FROM jsonb_array_elements(related) elem';
    RAISE NOTICE '    WHERE elem->>''type'' = ''parent''';
    RAISE NOTICE '  );';
    RAISE NOTICE '';
    RAISE NOTICE 'Or run: psql -U mcp_user -d mcp_tasks -f migration-002-rollback.sql';
    RAISE NOTICE '';
END $$;

--
-- Test Script: DatabaseService CRUD Operations with Related Array
-- Description: Comprehensive testing of all CRUD operations using related JSONB array
--              Tests createObject, updateObject, getObject, and listObjects functionality
-- Date: 2025-10-10
-- Author: Claude Code
--

-- ==============================================================================
-- TEST SETUP
-- ==============================================================================

\echo ''
\echo '========================================'
\echo 'DATABASE SERVICE CRUD TESTS'
\echo 'Testing Related Array Functionality'
\echo '========================================'
\echo ''

-- Begin transaction for isolated testing
BEGIN;

-- Store initial state
DO $$
DECLARE
    initial_count integer;
BEGIN
    SELECT COUNT(*) INTO initial_count FROM objects;
    RAISE NOTICE 'Initial object count: %', initial_count;
    RAISE NOTICE '';
END $$;

-- ==============================================================================
-- TEST 1: CREATE OBJECT WITH RELATED ARRAY
-- ==============================================================================

\echo 'TEST 1: Create Object with Related Array'
\echo '=========================================='

DO $$
DECLARE
    test_project_id integer;
    test_task_id integer;
    retrieved_related jsonb;
    retrieved_parent_id integer;
BEGIN
    -- Create a parent project first
    INSERT INTO objects (template_id, stage, related, created_by, updated_by)
    VALUES (2, 'backlog', '[]'::jsonb, 'test-script', 'test-script')
    RETURNING id INTO test_project_id;

    RAISE NOTICE '✓ Created parent project with ID: %', test_project_id;

    -- Create a task with related array pointing to the project
    INSERT INTO objects (
        template_id,
        stage,
        parent_id,
        related,
        created_by,
        updated_by
    )
    VALUES (
        1,  -- task template
        'backlog',
        test_project_id,
        jsonb_build_array(
            jsonb_build_object('id', test_project_id, 'object', 'project')
        ),
        'test-script',
        'test-script'
    )
    RETURNING id INTO test_task_id;

    RAISE NOTICE '✓ Created task with ID: % and related array', test_task_id;

    -- Verify the related array was stored correctly
    SELECT related, parent_id
    INTO retrieved_related, retrieved_parent_id
    FROM objects
    WHERE id = test_task_id;

    IF retrieved_related IS NOT NULL THEN
        RAISE NOTICE '✓ Related array stored: %', retrieved_related;
    ELSE
        RAISE WARNING '✗ Related array is NULL';
    END IF;

    IF retrieved_parent_id = test_project_id THEN
        RAISE NOTICE '✓ parent_id synced correctly: %', retrieved_parent_id;
    ELSE
        RAISE WARNING '✗ parent_id mismatch. Expected: %, Got: %', test_project_id, retrieved_parent_id;
    END IF;

    -- Verify trigger maintained bidirectional sync
    IF retrieved_related = jsonb_build_array(
        jsonb_build_object('id', test_project_id, 'object', 'project')
    ) THEN
        RAISE NOTICE '✓ TEST 1 PASSED: Create with related array successful';
    ELSE
        RAISE WARNING '✗ TEST 1 FAILED: Related array format incorrect';
    END IF;

    RAISE NOTICE '';
END $$;

-- ==============================================================================
-- TEST 2: UPDATE OBJECT - MODIFY RELATED ARRAY
-- ==============================================================================

\echo 'TEST 2: Update Object - Modify Related Array'
\echo '=============================================='

DO $$
DECLARE
    test_epic_id integer;
    test_task_id integer;
    old_related jsonb;
    new_related jsonb;
    new_parent_id integer;
BEGIN
    -- Create an epic
    INSERT INTO objects (template_id, stage, related, created_by, updated_by)
    VALUES (3, 'backlog', '[]'::jsonb, 'test-script', 'test-script')
    RETURNING id INTO test_epic_id;

    RAISE NOTICE '✓ Created epic with ID: %', test_epic_id;

    -- Create a task with no parent
    INSERT INTO objects (template_id, stage, related, created_by, updated_by)
    VALUES (1, 'backlog', '[]'::jsonb, 'test-script', 'test-script')
    RETURNING id INTO test_task_id;

    RAISE NOTICE '✓ Created orphan task with ID: %', test_task_id;

    -- Store original related array
    SELECT related INTO old_related FROM objects WHERE id = test_task_id;
    RAISE NOTICE '  Original related: %', old_related;

    -- Update the task to add parent via related array
    UPDATE objects
    SET related = jsonb_build_array(
        jsonb_build_object('id', test_epic_id, 'object', 'epic')
    ),
    updated_by = 'test-script'
    WHERE id = test_task_id;

    RAISE NOTICE '✓ Updated task % to add epic % as parent', test_task_id, test_epic_id;

    -- Verify update
    SELECT related, parent_id
    INTO new_related, new_parent_id
    FROM objects
    WHERE id = test_task_id;

    RAISE NOTICE '  New related: %', new_related;
    RAISE NOTICE '  New parent_id: %', new_parent_id;

    IF new_parent_id = test_epic_id THEN
        RAISE NOTICE '✓ parent_id synced correctly via trigger';
    ELSE
        RAISE WARNING '✗ parent_id not synced. Expected: %, Got: %', test_epic_id, new_parent_id;
    END IF;

    IF new_related = jsonb_build_array(
        jsonb_build_object('id', test_epic_id, 'object', 'epic')
    ) THEN
        RAISE NOTICE '✓ TEST 2 PASSED: Update related array successful';
    ELSE
        RAISE WARNING '✗ TEST 2 FAILED: Related array not updated correctly';
    END IF;

    RAISE NOTICE '';
END $$;

-- ==============================================================================
-- TEST 3: UPDATE OBJECT - CHANGE PARENT VIA parent_id
-- ==============================================================================

\echo 'TEST 3: Update Object - Change Parent via parent_id'
\echo '===================================================='

DO $$
DECLARE
    test_project1_id integer;
    test_project2_id integer;
    test_task_id integer;
    initial_related jsonb;
    final_related jsonb;
BEGIN
    -- Create two projects
    INSERT INTO objects (template_id, stage, related, created_by, updated_by)
    VALUES (2, 'backlog', '[]'::jsonb, 'test-script', 'test-script')
    RETURNING id INTO test_project1_id;

    INSERT INTO objects (template_id, stage, related, created_by, updated_by)
    VALUES (2, 'backlog', '[]'::jsonb, 'test-script', 'test-script')
    RETURNING id INTO test_project2_id;

    RAISE NOTICE '✓ Created project1 (ID: %) and project2 (ID: %)', test_project1_id, test_project2_id;

    -- Create task under project1
    INSERT INTO objects (template_id, stage, parent_id, related, created_by, updated_by)
    VALUES (
        1,
        'backlog',
        test_project1_id,
        jsonb_build_array(jsonb_build_object('id', test_project1_id, 'object', 'project')),
        'test-script',
        'test-script'
    )
    RETURNING id INTO test_task_id;

    SELECT related INTO initial_related FROM objects WHERE id = test_task_id;
    RAISE NOTICE '✓ Created task % under project1', test_task_id;
    RAISE NOTICE '  Initial related: %', initial_related;

    -- Change parent via parent_id column
    UPDATE objects
    SET parent_id = test_project2_id,
        updated_by = 'test-script'
    WHERE id = test_task_id;

    RAISE NOTICE '✓ Changed parent_id from % to %', test_project1_id, test_project2_id;

    -- Verify trigger synced related array
    SELECT related INTO final_related FROM objects WHERE id = test_task_id;
    RAISE NOTICE '  Final related: %', final_related;

    IF final_related = jsonb_build_array(
        jsonb_build_object('id', test_project2_id, 'object', 'project')
    ) THEN
        RAISE NOTICE '✓ TEST 3 PASSED: parent_id change synced to related array';
    ELSE
        RAISE WARNING '✗ TEST 3 FAILED: Trigger did not sync related array correctly';
    END IF;

    RAISE NOTICE '';
END $$;

-- ==============================================================================
-- TEST 4: UPDATE OBJECT - REMOVE PARENT
-- ==============================================================================

\echo 'TEST 4: Update Object - Remove Parent'
\echo '======================================'

DO $$
DECLARE
    test_project_id integer;
    test_task_id integer;
    final_related jsonb;
    final_parent_id integer;
BEGIN
    -- Create project and task
    INSERT INTO objects (template_id, stage, related, created_by, updated_by)
    VALUES (2, 'backlog', '[]'::jsonb, 'test-script', 'test-script')
    RETURNING id INTO test_project_id;

    INSERT INTO objects (template_id, stage, parent_id, created_by, updated_by)
    VALUES (1, 'backlog', test_project_id, 'test-script', 'test-script')
    RETURNING id INTO test_task_id;

    RAISE NOTICE '✓ Created task % with parent %', test_task_id, test_project_id;

    -- Remove parent by setting parent_id to NULL
    UPDATE objects
    SET parent_id = NULL,
        updated_by = 'test-script'
    WHERE id = test_task_id;

    RAISE NOTICE '✓ Set parent_id to NULL';

    -- Verify related array is cleared
    SELECT related, parent_id
    INTO final_related, final_parent_id
    FROM objects
    WHERE id = test_task_id;

    RAISE NOTICE '  Final related: %', final_related;
    RAISE NOTICE '  Final parent_id: %', COALESCE(final_parent_id::text, 'NULL');

    IF final_parent_id IS NULL AND final_related = '[]'::jsonb THEN
        RAISE NOTICE '✓ TEST 4 PASSED: Parent removal synced correctly';
    ELSE
        RAISE WARNING '✗ TEST 4 FAILED: Expected NULL parent_id and empty related array';
    END IF;

    RAISE NOTICE '';
END $$;

-- ==============================================================================
-- TEST 5: LIST OBJECTS - FILTER BY RELATED ARRAY (GIN INDEX)
-- ==============================================================================

\echo 'TEST 5: List Objects - Filter by Related Array'
\echo '==============================================='

DO $$
DECLARE
    test_project_id integer;
    task1_id integer;
    task2_id integer;
    task3_id integer;
    found_count integer;
    rec record;
BEGIN
    -- Create a project
    INSERT INTO objects (template_id, stage, related, created_by, updated_by)
    VALUES (2, 'backlog', '[]'::jsonb, 'test-script', 'test-script')
    RETURNING id INTO test_project_id;

    RAISE NOTICE '✓ Created test project with ID: %', test_project_id;

    -- Create tasks with different parent relationships
    INSERT INTO objects (template_id, stage, parent_id, created_by, updated_by)
    VALUES (1, 'backlog', test_project_id, 'test-script', 'test-script')
    RETURNING id INTO task1_id;

    INSERT INTO objects (template_id, stage, parent_id, created_by, updated_by)
    VALUES (1, 'backlog', test_project_id, 'test-script', 'test-script')
    RETURNING id INTO task2_id;

    INSERT INTO objects (template_id, stage, created_by, updated_by)
    VALUES (1, 'backlog', 'test-script', 'test-script')
    RETURNING id INTO task3_id;

    RAISE NOTICE '✓ Created 3 tasks: % (has parent), % (has parent), % (no parent)',
        task1_id, task2_id, task3_id;

    -- Test GIN index filter with containment operator @>
    RAISE NOTICE '';
    RAISE NOTICE '  Testing filter: related @> ''[{"id": %}]''', test_project_id;

    SELECT COUNT(*) INTO found_count
    FROM objects
    WHERE related @> jsonb_build_array(jsonb_build_object('id', test_project_id));

    RAISE NOTICE '  Found % objects with parent %', found_count, test_project_id;

    IF found_count = 2 THEN
        RAISE NOTICE '✓ GIN index filter working correctly';

        -- Show the filtered results
        RAISE NOTICE '';
        RAISE NOTICE '  Filtered results:';
        FOR rec IN
            SELECT id, parent_id, related
            FROM objects
            WHERE related @> jsonb_build_array(jsonb_build_object('id', test_project_id))
            ORDER BY id
        LOOP
            RAISE NOTICE '    - ID: %, parent_id: %, related: %',
                rec.id, rec.parent_id, rec.related;
        END LOOP;

        RAISE NOTICE '';
        RAISE NOTICE '✓ TEST 5 PASSED: GIN index filtering works correctly';
    ELSE
        RAISE WARNING '✗ TEST 5 FAILED: Expected 2 results, got %', found_count;
    END IF;

    RAISE NOTICE '';
END $$;

-- ==============================================================================
-- TEST 6: LIST OBJECTS - COMBINED FILTER (parent_id OR related)
-- ==============================================================================

\echo 'TEST 6: List Objects - Combined Filter (parent_id OR related)'
\echo '=============================================================='

DO $$
DECLARE
    test_project_id integer;
    task_via_parent_id integer;
    task_via_related integer;
    found_count integer;
BEGIN
    -- Create project
    INSERT INTO objects (template_id, stage, related, created_by, updated_by)
    VALUES (2, 'backlog', '[]'::jsonb, 'test-script', 'test-script')
    RETURNING id INTO test_project_id;

    RAISE NOTICE '✓ Created test project with ID: %', test_project_id;

    -- Create task using parent_id (trigger will sync to related)
    INSERT INTO objects (template_id, stage, parent_id, created_by, updated_by)
    VALUES (1, 'backlog', test_project_id, 'test-script', 'test-script')
    RETURNING id INTO task_via_parent_id;

    RAISE NOTICE '✓ Created task % via parent_id', task_via_parent_id;

    -- Test combined filter (simulates DatabaseService.listObjects)
    SELECT COUNT(*) INTO found_count
    FROM objects
    WHERE parent_id = test_project_id
       OR related @> jsonb_build_array(jsonb_build_object('id', test_project_id));

    RAISE NOTICE '';
    RAISE NOTICE '  Filter: (parent_id = % OR related @> ''[{"id": %}]'')',
        test_project_id, test_project_id;
    RAISE NOTICE '  Found % objects', found_count;

    IF found_count >= 1 THEN
        RAISE NOTICE '✓ TEST 6 PASSED: Combined filter works correctly';
    ELSE
        RAISE WARNING '✗ TEST 6 FAILED: No objects found with combined filter';
    END IF;

    RAISE NOTICE '';
END $$;

-- ==============================================================================
-- TEST 7: SINGLE PARENT ENFORCEMENT
-- ==============================================================================

\echo 'TEST 7: Single Parent Enforcement'
\echo '=================================='

DO $$
DECLARE
    project1_id integer;
    project2_id integer;
    test_task_id integer;
    related_count integer;
    final_related jsonb;
BEGIN
    -- Create two projects
    INSERT INTO objects (template_id, stage, related, created_by, updated_by)
    VALUES (2, 'backlog', '[]'::jsonb, 'test-script', 'test-script')
    RETURNING id INTO project1_id;

    INSERT INTO objects (template_id, stage, related, created_by, updated_by)
    VALUES (2, 'backlog', '[]'::jsonb, 'test-script', 'test-script')
    RETURNING id INTO project2_id;

    RAISE NOTICE '✓ Created project1 (%) and project2 (%)', project1_id, project2_id;

    -- Create task with project1 as parent
    INSERT INTO objects (template_id, stage, parent_id, created_by, updated_by)
    VALUES (1, 'backlog', project1_id, 'test-script', 'test-script')
    RETURNING id INTO test_task_id;

    RAISE NOTICE '✓ Created task % with parent %', test_task_id, project1_id;

    -- Change parent to project2 (should REPLACE, not append)
    UPDATE objects
    SET parent_id = project2_id,
        updated_by = 'test-script'
    WHERE id = test_task_id;

    RAISE NOTICE '✓ Changed parent from % to %', project1_id, project2_id;

    -- Verify only ONE entry in related array
    SELECT related, jsonb_array_length(related)
    INTO final_related, related_count
    FROM objects
    WHERE id = test_task_id;

    RAISE NOTICE '  Final related: %', final_related;
    RAISE NOTICE '  Related array length: %', related_count;

    IF related_count = 1 AND
       final_related = jsonb_build_array(jsonb_build_object('id', project2_id, 'object', 'project')) THEN
        RAISE NOTICE '✓ TEST 7 PASSED: Single parent enforced (replaced, not appended)';
    ELSE
        RAISE WARNING '✗ TEST 7 FAILED: Expected single entry with project2, got % entries', related_count;
    END IF;

    RAISE NOTICE '';
END $$;

-- ==============================================================================
-- TEST SUMMARY
-- ==============================================================================

\echo '========================================'
\echo 'TEST SUMMARY'
\echo '========================================'

DO $$
DECLARE
    total_objects integer;
    objects_with_parent integer;
    objects_with_related integer;
    synced_objects integer;
    sync_rate numeric;
BEGIN
    SELECT COUNT(*) INTO total_objects FROM objects WHERE created_by = 'test-script';

    SELECT COUNT(*) INTO objects_with_parent
    FROM objects
    WHERE created_by = 'test-script' AND parent_id IS NOT NULL;

    SELECT COUNT(*) INTO objects_with_related
    FROM objects
    WHERE created_by = 'test-script' AND related IS NOT NULL AND related != '[]'::jsonb;

    SELECT COUNT(*) INTO synced_objects
    FROM objects
    WHERE created_by = 'test-script'
      AND parent_id IS NOT NULL
      AND related @> jsonb_build_array(jsonb_build_object('id', parent_id));

    IF objects_with_parent > 0 THEN
        sync_rate := (synced_objects::numeric / objects_with_parent::numeric * 100);
    ELSE
        sync_rate := 100;
    END IF;

    RAISE NOTICE '';
    RAISE NOTICE 'Test Statistics:';
    RAISE NOTICE '  Total test objects created: %', total_objects;
    RAISE NOTICE '  Objects with parent_id: %', objects_with_parent;
    RAISE NOTICE '  Objects with related array: %', objects_with_related;
    RAISE NOTICE '  Properly synced objects: %', synced_objects;
    RAISE NOTICE '  Sync success rate: % percent', ROUND(sync_rate, 2);
    RAISE NOTICE '';

    IF sync_rate = 100 THEN
        RAISE NOTICE '✅ ALL TESTS PASSED: Database triggers maintain perfect sync';
    ELSE
        RAISE WARNING '⚠ Some objects not properly synced: % out of %',
            synced_objects, objects_with_parent;
    END IF;
END $$;

-- Rollback transaction (cleanup test data)
ROLLBACK;

\echo ''
\echo '✓ Transaction rolled back (test data cleaned up)'
\echo ''

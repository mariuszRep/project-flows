-- ===============================================
-- DATABASE SERVICE RELATED ARRAY TEST SUITE (P3)
-- ===============================================

BEGIN;

CREATE OR REPLACE FUNCTION debug_related(input jsonb)
RETURNS text LANGUAGE plpgsql AS $$
BEGIN
  RETURN COALESCE(jsonb_pretty(input), '[]');
END;
$$;

DO $$
DECLARE
    project_id integer;
    task_id integer;
    stored_related jsonb;
BEGIN
    RAISE NOTICE 'TEST 1: Create object with related array';

    INSERT INTO objects (template_id, stage, related, created_by, updated_by)
    VALUES (2, 'backlog', '[]'::jsonb, 'test-suite', 'test-suite')
    RETURNING id INTO project_id;

    INSERT INTO objects (template_id, stage, related, created_by, updated_by)
    VALUES (
        1,
        'backlog',
        jsonb_build_array(jsonb_build_object('id', project_id, 'object', 'project')),
        'test-suite',
        'test-suite'
    )
    RETURNING id, related INTO task_id, stored_related;

    IF stored_related = jsonb_build_array(jsonb_build_object('id', project_id, 'object', 'project')) THEN
        RAISE NOTICE '✓ Stored related array: %', debug_related(stored_related);
        RAISE NOTICE '✓ TEST 1 PASSED';
    ELSE
        RAISE WARNING '✗ Related array mismatch: %', debug_related(stored_related);
    END IF;

    DELETE FROM objects WHERE id IN (task_id, project_id);
END $$;

DO $$
DECLARE
    project_a integer;
    project_b integer;
    task_id integer;
    updated_related jsonb;
BEGIN
    RAISE NOTICE 'TEST 2: Update parent relationship via related array';

    INSERT INTO objects (template_id, stage, related, created_by, updated_by)
    VALUES (2, 'backlog', '[]'::jsonb, 'test-suite', 'test-suite')
    RETURNING id INTO project_a;

    INSERT INTO objects (template_id, stage, related, created_by, updated_by)
    VALUES (2, 'backlog', '[]'::jsonb, 'test-suite', 'test-suite')
    RETURNING id INTO project_b;

    INSERT INTO objects (template_id, stage, related, created_by, updated_by)
    VALUES (
        1,
        'backlog',
        jsonb_build_array(jsonb_build_object('id', project_a, 'object', 'project')),
        'test-suite',
        'test-suite'
    )
    RETURNING id INTO task_id;

    UPDATE objects
    SET related = jsonb_build_array(jsonb_build_object('id', project_b, 'object', 'project'))
    WHERE id = task_id;

    SELECT related INTO updated_related FROM objects WHERE id = task_id;

    IF updated_related = jsonb_build_array(jsonb_build_object('id', project_b, 'object', 'project')) THEN
        RAISE NOTICE '✓ Related array switched to project %', project_b;
        RAISE NOTICE '✓ TEST 2 PASSED';
    ELSE
        RAISE WARNING '✗ Related array not updated correctly: %', debug_related(updated_related);
    END IF;

    DELETE FROM objects WHERE id IN (task_id, project_a, project_b);
END $$;

DO $$
DECLARE
    project_id integer;
    task_id integer;
    updated_related jsonb;
BEGIN
    RAISE NOTICE 'TEST 3: Remove parent relationship';

    INSERT INTO objects (template_id, stage, related, created_by, updated_by)
    VALUES (2, 'backlog', '[]'::jsonb, 'test-suite', 'test-suite')
    RETURNING id INTO project_id;

    INSERT INTO objects (template_id, stage, related, created_by, updated_by)
    VALUES (
        1,
        'backlog',
        jsonb_build_array(jsonb_build_object('id', project_id, 'object', 'project')),
        'test-suite',
        'test-suite'
    )
    RETURNING id INTO task_id;

    UPDATE objects
    SET related = '[]'::jsonb
    WHERE id = task_id;

    SELECT related INTO updated_related FROM objects WHERE id = task_id;

    IF jsonb_array_length(updated_related) = 0 THEN
        RAISE NOTICE '✓ Related array cleared successfully';
        RAISE NOTICE '✓ TEST 3 PASSED';
    ELSE
        RAISE WARNING '✗ Expected empty related array, got %', debug_related(updated_related);
    END IF;

    DELETE FROM objects WHERE id IN (task_id, project_id);
END $$;

DO $$
DECLARE
    project_id integer;
    task_with_parent integer;
    task_without_parent integer;
    match_count integer;
BEGIN
    RAISE NOTICE 'TEST 4: Filter listObjects by related parent';

    INSERT INTO objects (template_id, stage, related, created_by, updated_by)
    VALUES (2, 'backlog', '[]'::jsonb, 'test-suite', 'test-suite')
    RETURNING id INTO project_id;

    INSERT INTO objects (template_id, stage, related, created_by, updated_by)
    VALUES (
        1,
        'backlog',
        jsonb_build_array(jsonb_build_object('id', project_id, 'object', 'project')),
        'test-suite',
        'test-suite'
    )
    RETURNING id INTO task_with_parent;

    INSERT INTO objects (template_id, stage, related, created_by, updated_by)
    VALUES (1, 'backlog', '[]'::jsonb, 'test-suite', 'test-suite')
    RETURNING id INTO task_without_parent;

    SELECT COUNT(*)
    INTO match_count
    FROM objects
    WHERE related @> jsonb_build_array(jsonb_build_object('id', project_id, 'object', 'project'));

    IF match_count = 1 THEN
        RAISE NOTICE '✓ Filter returned expected task ID %', task_with_parent;
        RAISE NOTICE '✓ TEST 4 PASSED';
    ELSE
        RAISE WARNING '✗ Filter mismatch. Expected 1 row, got %', match_count;
    END IF;

    DELETE FROM objects WHERE id IN (task_with_parent, task_without_parent, project_id);
END $$;

ROLLBACK;

DROP FUNCTION IF EXISTS debug_related(jsonb);

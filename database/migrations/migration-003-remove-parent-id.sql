--
-- Migration 003: Remove parent_id column and sync triggers
-- Date: 2025-10-10
-- Description: Drops the legacy parent_id column, associated triggers, functions,
--              foreign key, and index now that the related JSONB array is authoritative.
--

BEGIN;

-- 1. Validation – ensure every object has either empty related array or exactly one entry.
DO $$
DECLARE
  invalid_count integer;
BEGIN
  SELECT COUNT(*)
  INTO invalid_count
  FROM objects o
  WHERE jsonb_typeof(o.related) <> 'array'
     OR jsonb_array_length(o.related) > 1;

  IF invalid_count > 0 THEN
    RAISE EXCEPTION 'Aborting: Found % objects with invalid related array entries (must be null/[] or single entry)', invalid_count;
  END IF;
END
$$;

-- 2. Drop triggers
DROP TRIGGER IF EXISTS sync_parent_id_to_related_trigger ON objects;
DROP TRIGGER IF EXISTS sync_related_to_parent_id_trigger ON objects;

-- 3. Drop trigger functions
DROP FUNCTION IF EXISTS sync_parent_id_to_related();
DROP FUNCTION IF EXISTS sync_related_to_parent_id();

-- 4. Drop foreign key constraint
ALTER TABLE objects DROP CONSTRAINT IF EXISTS tasks_parent_id_fkey;

-- 5. Drop index on parent_id
DROP INDEX IF EXISTS idx_tasks_parent_id;

-- 6. Drop parent_id column
ALTER TABLE objects DROP COLUMN IF EXISTS parent_id;

COMMIT;

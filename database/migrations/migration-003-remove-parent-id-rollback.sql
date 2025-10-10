--
-- Rollback for Migration 003: Restore parent_id column and sync triggers
-- CAUTION: Reintroduces parent_id with NULL values – downstream code must handle backfill.
--

BEGIN;

-- 1. Re-add column
ALTER TABLE objects
  ADD COLUMN parent_id INTEGER;

-- 2. Recreate foreign key constraint (self-referential)
ALTER TABLE objects
  ADD CONSTRAINT tasks_parent_id_fkey
  FOREIGN KEY (parent_id)
  REFERENCES objects(id)
  ON DELETE CASCADE;

-- 3. Recreate index
CREATE INDEX idx_tasks_parent_id ON objects(parent_id);

-- 4. Recreate syncing functions
CREATE OR REPLACE FUNCTION sync_parent_id_to_related() RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' OR NEW.parent_id IS DISTINCT FROM OLD.parent_id THEN
    IF NEW.parent_id IS NOT NULL THEN
      NEW.related := jsonb_build_array(jsonb_build_object('id', NEW.parent_id));
    ELSE
      NEW.related := '[]'::jsonb;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION sync_related_to_parent_id() RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  parent_entry jsonb;
BEGIN
  IF NEW.related IS DISTINCT FROM OLD.related OR TG_OP = 'INSERT' THEN
    SELECT elem
    INTO parent_entry
    FROM jsonb_array_elements(NEW.related) AS elem
    LIMIT 1;

    IF parent_entry IS NOT NULL THEN
      NEW.parent_id := (parent_entry->>'id')::integer;
    ELSE
      NEW.parent_id := NULL;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- 5. Recreate triggers
CREATE TRIGGER sync_related_to_parent_id_trigger
  BEFORE INSERT OR UPDATE ON objects
  FOR EACH ROW
  EXECUTE FUNCTION sync_related_to_parent_id();

CREATE TRIGGER sync_parent_id_to_related_trigger
  BEFORE INSERT OR UPDATE ON objects
  FOR EACH ROW
  EXECUTE FUNCTION sync_parent_id_to_related();

COMMIT;

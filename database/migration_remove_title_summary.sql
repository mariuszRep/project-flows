-- Migration script to remove deprecated title and summary columns from tasks table
-- Run this after verifying that all data has been migrated to the blocks system

BEGIN;

-- Verify that all tasks have corresponding Title and Description blocks before proceeding
DO $$
DECLARE
    task_count INTEGER;
    title_block_count INTEGER;
    description_block_count INTEGER;
BEGIN
    -- Count total tasks
    SELECT COUNT(*) INTO task_count FROM tasks;
    
    -- Count tasks with Title blocks
    SELECT COUNT(DISTINCT task_id) INTO title_block_count 
    FROM blocks WHERE property_name = 'Title';
    
    -- Count tasks with Description blocks
    SELECT COUNT(DISTINCT task_id) INTO description_block_count 
    FROM blocks WHERE property_name = 'Description';
    
    -- Raise error if migration is incomplete
    IF task_count != title_block_count THEN
        RAISE EXCEPTION 'Migration incomplete: % tasks found but only % have Title blocks', 
            task_count, title_block_count;
    END IF;
    
    IF task_count != description_block_count THEN
        RAISE EXCEPTION 'Migration incomplete: % tasks found but only % have Description blocks', 
            task_count, description_block_count;
    END IF;
    
    RAISE NOTICE 'Migration verification passed: % tasks have both Title and Description blocks', task_count;
END $$;

-- Drop the deprecated columns
ALTER TABLE tasks DROP COLUMN IF EXISTS title;
ALTER TABLE tasks DROP COLUMN IF EXISTS summary;

RAISE NOTICE 'Successfully removed title and summary columns from tasks table';

COMMIT;
-- Rollback Migration: Revert table renames to original names
-- Reverts: template_properties -> properties, objects -> tasks, object_properties -> blocks
-- This rollback migration reverts all changes from 002_rename_tables.sql

-- ================================================
-- REVERT TRIGGER RENAMES
-- ================================================

-- Revert update timestamp triggers
ALTER TRIGGER update_template_properties_updated_at ON template_properties RENAME TO update_properties_updated_at;
ALTER TRIGGER update_objects_updated_at ON objects RENAME TO update_tasks_updated_at;
ALTER TRIGGER update_object_properties_updated_at ON object_properties RENAME TO update_blocks_updated_at;

-- ================================================
-- REVERT INDEX RENAMES
-- ================================================

-- Revert object_properties indexes to blocks indexes
ALTER INDEX idx_object_properties_position RENAME TO idx_blocks_position;
ALTER INDEX idx_object_properties_property_id RENAME TO idx_blocks_property_id;
ALTER INDEX idx_object_properties_object_id RENAME TO idx_blocks_task_id;

-- Revert objects indexes to tasks indexes
ALTER INDEX idx_objects_parent_id RENAME TO idx_tasks_parent_id;
ALTER INDEX idx_objects_user_id RENAME TO idx_tasks_user_id;

-- ================================================
-- UPDATE FOREIGN KEY CONSTRAINTS TO REFERENCE ORIGINAL NAMES
-- ================================================

-- Update foreign key constraint to reference original table name
ALTER TABLE object_properties DROP CONSTRAINT object_properties_object_id_fkey;
ALTER TABLE object_properties ADD CONSTRAINT blocks_task_id_fkey 
    FOREIGN KEY (task_id) REFERENCES objects(id) ON DELETE CASCADE;

-- Update foreign key constraint to reference original table name  
ALTER TABLE object_properties DROP CONSTRAINT object_properties_property_id_fkey;
ALTER TABLE object_properties ADD CONSTRAINT blocks_property_id_fkey 
    FOREIGN KEY (property_id) REFERENCES template_properties(id) ON DELETE CASCADE;

-- ================================================
-- REVERT CONSTRAINT RENAMES
-- ================================================

-- Revert foreign key constraints
ALTER TABLE template_properties RENAME CONSTRAINT template_properties_template_id_fkey TO properties_template_id_fkey;
ALTER TABLE objects RENAME CONSTRAINT objects_parent_id_fkey TO tasks_parent_id_fkey;
ALTER TABLE objects RENAME CONSTRAINT objects_template_id_fkey TO tasks_template_id_fkey;

-- Revert unique constraints
ALTER TABLE template_properties RENAME CONSTRAINT template_properties_template_id_key_key TO properties_template_id_key_key;
ALTER TABLE object_properties RENAME CONSTRAINT object_properties_object_id_property_id_key TO blocks_task_id_property_id_key;

-- Revert primary key constraints
ALTER TABLE template_properties RENAME CONSTRAINT template_properties_pkey TO properties_pkey;
ALTER TABLE objects RENAME CONSTRAINT objects_pkey TO tasks_pkey;
ALTER TABLE object_properties RENAME CONSTRAINT object_properties_pkey TO blocks_pkey;

-- ================================================
-- REVERT SEQUENCE OWNERSHIP
-- ================================================

-- Revert sequence ownership for properties
ALTER SEQUENCE template_properties_id_seq OWNED BY template_properties.id;

-- Revert sequence ownership for tasks
ALTER SEQUENCE objects_id_seq OWNED BY objects.id;

-- Revert sequence ownership for blocks
ALTER SEQUENCE object_properties_id_seq OWNED BY object_properties.id;

-- ================================================
-- REVERT SEQUENCE RENAMES
-- ================================================

-- Revert template_properties sequence
ALTER SEQUENCE template_properties_id_seq RENAME TO properties_id_seq;

-- Revert objects sequence
ALTER SEQUENCE objects_id_seq RENAME TO tasks_id_seq;

-- Revert object_properties sequence
ALTER SEQUENCE object_properties_id_seq RENAME TO blocks_id_seq;

-- ================================================
-- REVERT TABLE RENAMES
-- ================================================

-- Revert template_properties to properties
ALTER TABLE template_properties RENAME TO properties;

-- Revert objects to tasks
ALTER TABLE objects RENAME TO tasks;

-- Revert object_properties to blocks
ALTER TABLE object_properties RENAME TO blocks;

-- ================================================
-- UPDATE FOREIGN KEY CONSTRAINTS AFTER TABLE RENAMES
-- ================================================

-- Update foreign key constraint after table rename
ALTER TABLE blocks DROP CONSTRAINT blocks_task_id_fkey;
ALTER TABLE blocks ADD CONSTRAINT blocks_task_id_fkey 
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE;

-- Update foreign key constraint after table rename
ALTER TABLE blocks DROP CONSTRAINT blocks_property_id_fkey;
ALTER TABLE blocks ADD CONSTRAINT blocks_property_id_fkey 
    FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE;

-- ================================================
-- REMOVE MIGRATION COMPLETION MARKER
-- ================================================

DELETE FROM global_state WHERE key = 'migration_002_completed';

-- Add rollback completion marker
INSERT INTO global_state (key, value, created_by, updated_by) 
VALUES ('migration_002_rollback_completed', ('{"completed_at": "' || CURRENT_TIMESTAMP || '", "migration": "rollback_rename_tables"}')::jsonb, 'migration_script', 'migration_script')
ON CONFLICT (key) DO UPDATE SET 
    value = EXCLUDED.value,
    updated_at = CURRENT_TIMESTAMP,
    updated_by = 'migration_script';
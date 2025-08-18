-- Migration: Rename database tables for improved clarity
-- Renames: properties -> template_properties, tasks -> objects, blocks -> object_properties
-- This migration updates all table names, sequences, constraints, indexes, and triggers

-- ================================================
-- RENAME TABLES
-- ================================================

-- Rename properties to template_properties
ALTER TABLE properties RENAME TO template_properties;

-- Rename tasks to objects  
ALTER TABLE tasks RENAME TO objects;

-- Rename blocks to object_properties
ALTER TABLE blocks RENAME TO object_properties;

-- ================================================
-- RENAME SEQUENCES
-- ================================================

-- Rename properties sequence
ALTER SEQUENCE properties_id_seq RENAME TO template_properties_id_seq;

-- Rename tasks sequence
ALTER SEQUENCE tasks_id_seq RENAME TO objects_id_seq;

-- Rename blocks sequence
ALTER SEQUENCE blocks_id_seq RENAME TO object_properties_id_seq;

-- ================================================
-- UPDATE SEQUENCE OWNERSHIP
-- ================================================

-- Update sequence ownership for template_properties
ALTER SEQUENCE template_properties_id_seq OWNED BY template_properties.id;

-- Update sequence ownership for objects
ALTER SEQUENCE objects_id_seq OWNED BY objects.id;

-- Update sequence ownership for object_properties
ALTER SEQUENCE object_properties_id_seq OWNED BY object_properties.id;

-- ================================================
-- RENAME CONSTRAINTS
-- ================================================

-- Rename primary key constraints
ALTER TABLE template_properties RENAME CONSTRAINT properties_pkey TO template_properties_pkey;
ALTER TABLE objects RENAME CONSTRAINT tasks_pkey TO objects_pkey;
ALTER TABLE object_properties RENAME CONSTRAINT blocks_pkey TO object_properties_pkey;

-- Rename unique constraints
ALTER TABLE template_properties RENAME CONSTRAINT properties_template_id_key_key TO template_properties_template_id_key_key;
ALTER TABLE object_properties RENAME CONSTRAINT blocks_task_id_property_id_key TO object_properties_object_id_property_id_key;

-- Rename foreign key constraints
ALTER TABLE template_properties RENAME CONSTRAINT properties_template_id_fkey TO template_properties_template_id_fkey;
ALTER TABLE objects RENAME CONSTRAINT tasks_parent_id_fkey TO objects_parent_id_fkey;
ALTER TABLE objects RENAME CONSTRAINT tasks_template_id_fkey TO objects_template_id_fkey;
ALTER TABLE object_properties RENAME CONSTRAINT blocks_property_id_fkey TO object_properties_property_id_fkey;
ALTER TABLE object_properties RENAME CONSTRAINT blocks_task_id_fkey TO object_properties_object_id_fkey;

-- Update foreign key constraint to reference new table name
ALTER TABLE object_properties DROP CONSTRAINT object_properties_object_id_fkey;
ALTER TABLE object_properties ADD CONSTRAINT object_properties_object_id_fkey 
    FOREIGN KEY (task_id) REFERENCES objects(id) ON DELETE CASCADE;

-- Update foreign key constraint to reference new table name  
ALTER TABLE object_properties DROP CONSTRAINT object_properties_property_id_fkey;
ALTER TABLE object_properties ADD CONSTRAINT object_properties_property_id_fkey 
    FOREIGN KEY (property_id) REFERENCES template_properties(id) ON DELETE CASCADE;

-- ================================================
-- RENAME INDEXES
-- ================================================

-- Rename blocks indexes to object_properties indexes
ALTER INDEX idx_blocks_position RENAME TO idx_object_properties_position;
ALTER INDEX idx_blocks_property_id RENAME TO idx_object_properties_property_id;
ALTER INDEX idx_blocks_task_id RENAME TO idx_object_properties_object_id;

-- Rename tasks indexes to objects indexes
ALTER INDEX idx_tasks_parent_id RENAME TO idx_objects_parent_id;
ALTER INDEX idx_tasks_user_id RENAME TO idx_objects_user_id;

-- ================================================
-- RENAME TRIGGERS
-- ================================================

-- Rename update timestamp triggers
ALTER TRIGGER update_properties_updated_at ON template_properties RENAME TO update_template_properties_updated_at;
ALTER TRIGGER update_tasks_updated_at ON objects RENAME TO update_objects_updated_at;
ALTER TRIGGER update_blocks_updated_at ON object_properties RENAME TO update_object_properties_updated_at;

-- ================================================
-- ADD COMMENTS FOR DOCUMENTATION
-- ================================================

COMMENT ON TABLE template_properties IS 'Template property definitions that define the schema for different entity types (tasks, projects, etc.)';
COMMENT ON TABLE objects IS 'Main entities table for both tasks and projects, differentiated by template_id';
COMMENT ON TABLE object_properties IS 'Dynamic property values for objects, linked via property_id and object_id (formerly task_id)';

-- Add migration completion marker
INSERT INTO global_state (key, value, created_by, updated_by) 
VALUES ('migration_002_completed', ('{"completed_at": "' || CURRENT_TIMESTAMP || '", "migration": "rename_tables"}')::jsonb, 'migration_script', 'migration_script')
ON CONFLICT (key) DO UPDATE SET 
    value = EXCLUDED.value,
    updated_at = CURRENT_TIMESTAMP,
    updated_by = 'migration_script';
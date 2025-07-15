-- Migration script to add audit columns to existing tables
-- Run this script to add missing created_by and updated_by columns

-- Add audit columns to properties table
ALTER TABLE properties 
ADD COLUMN IF NOT EXISTS created_by TEXT NOT NULL DEFAULT 'system',
ADD COLUMN IF NOT EXISTS updated_by TEXT NOT NULL DEFAULT 'system';

-- Add audit columns to tasks table  
ALTER TABLE tasks
ADD COLUMN IF NOT EXISTS created_by TEXT NOT NULL DEFAULT 'system',
ADD COLUMN IF NOT EXISTS updated_by TEXT NOT NULL DEFAULT 'system';

-- Add audit columns to blocks table
ALTER TABLE blocks
ADD COLUMN IF NOT EXISTS created_by TEXT NOT NULL DEFAULT 'system', 
ADD COLUMN IF NOT EXISTS updated_by TEXT NOT NULL DEFAULT 'system';

-- Update the trigger function to also update updated_by (requires manual setting)
-- Note: The updated_by column still needs to be set explicitly in application code
-- as PostgreSQL triggers cannot automatically determine the user context

COMMENT ON COLUMN properties.created_by IS 'User ID or system identifier who created this record';
COMMENT ON COLUMN properties.updated_by IS 'User ID or system identifier who last updated this record';
COMMENT ON COLUMN tasks.created_by IS 'User ID or system identifier who created this record';
COMMENT ON COLUMN tasks.updated_by IS 'User ID or system identifier who last updated this record';
COMMENT ON COLUMN blocks.created_by IS 'User ID or system identifier who created this record';
COMMENT ON COLUMN blocks.updated_by IS 'User ID or system identifier who last updated this record';
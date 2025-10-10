-- Rollback Migration: Remove JSONB columns for related objects and dependencies
-- Description: Removes 'related' and 'dependencies' JSONB columns from objects table
-- Author: System
-- Date: 2025-10-10

BEGIN;

-- Drop indexes first
DROP INDEX IF EXISTS idx_objects_dependencies;
DROP INDEX IF EXISTS idx_objects_related;

-- Drop columns
ALTER TABLE objects DROP COLUMN IF EXISTS dependencies;
ALTER TABLE objects DROP COLUMN IF EXISTS related;

COMMIT;

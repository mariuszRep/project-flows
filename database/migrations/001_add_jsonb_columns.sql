-- Migration: Add JSONB columns for related objects and dependencies
-- Description: Adds 'related' and 'dependencies' JSONB columns to objects table
--              for flexible relationship tracking without junction tables
-- Author: System
-- Date: 2025-10-10

-- ============================================================================
-- FORWARD MIGRATION
-- ============================================================================

BEGIN;

-- Add related column for storing related object references
-- Example: [{"id": 123, "type": "task"}, {"id": 456, "type": "epic"}]
ALTER TABLE objects
ADD COLUMN related JSONB DEFAULT '[]'::jsonb NOT NULL;

-- Add dependencies column for storing dependency relationships
-- Example: [{"id": 789, "type": "task", "blocking": true}]
ALTER TABLE objects
ADD COLUMN dependencies JSONB DEFAULT '[]'::jsonb NOT NULL;

-- Create GIN indexes for efficient JSONB querying
-- GIN (Generalized Inverted Index) is optimal for JSONB containment queries
CREATE INDEX idx_objects_related ON objects USING GIN (related);
CREATE INDEX idx_objects_dependencies ON objects USING GIN (dependencies);

-- Add comments for documentation
COMMENT ON COLUMN objects.related IS 'JSONB array of related object references, e.g., [{"id": 123, "type": "task"}]';
COMMENT ON COLUMN objects.dependencies IS 'JSONB array of dependency relationships, e.g., [{"id": 456, "type": "task", "blocking": true}]';

COMMIT;

-- ============================================================================
-- ROLLBACK MIGRATION
-- ============================================================================

-- To rollback this migration, run the following commands:
--
-- BEGIN;
-- DROP INDEX IF EXISTS idx_objects_dependencies;
-- DROP INDEX IF EXISTS idx_objects_related;
-- ALTER TABLE objects DROP COLUMN IF EXISTS dependencies;
-- ALTER TABLE objects DROP COLUMN IF EXISTS related;
-- COMMIT;

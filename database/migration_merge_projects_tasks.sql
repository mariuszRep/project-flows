-- Migration script to merge projects and tasks tables with parent-child hierarchy
-- This script transforms the existing project-task relationship into a unified tasks table
-- with parent-child relationships using parent_id column.

-- Begin transaction for safety
BEGIN;

-- Step 1: Add parent_id column to tasks table
ALTER TABLE tasks ADD COLUMN parent_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE;

-- Step 2: Create a "Project" template for parent tasks
INSERT INTO templates (name, description, created_by, updated_by)
VALUES ('Project', 'Template for project-type parent tasks', 'system', 'system')
ON CONFLICT DO NOTHING;

-- Get the template ID for the Project template
WITH project_template AS (
    SELECT id FROM templates WHERE name = 'Project' LIMIT 1
)
-- Step 3: Insert properties for the Project template (similar to Task but focused on projects)
INSERT INTO properties (template_id, key, type, description, execution_order, fixed, created_by, updated_by)
SELECT 
    t.id as template_id,
    data.key,
    data.type,
    data.description,
    data.execution_order,
    data.fixed,
    'system' as created_by,
    'system' as updated_by
FROM 
    project_template t
CROSS JOIN (
    SELECT 'Title' as key, 'text' as type, 'Project name and purpose. Be clear and descriptive about the project goals.' as description, 1 as execution_order, true as fixed
    UNION ALL
    SELECT 'Description' as key, 'text' as type, 'Detailed description of the project including objectives, scope, and expected outcomes.' as description, 2 as execution_order, true as fixed
    UNION ALL
    SELECT 'Notes' as key, 'text' as type, 'Project-specific context including technical requirements, constraints, dependencies, and background information.' as description, 3 as execution_order, false as fixed
    UNION ALL
    SELECT 'Items' as key, 'text' as type, 'High-level milestones and deliverables for this project organized as a markdown checklist.' as description, 4 as execution_order, false as fixed
) as data
ON CONFLICT (template_id, key) DO NOTHING;

-- Step 4: Migrate existing projects as parent tasks
-- For each project, create a corresponding parent task
INSERT INTO tasks (stage, created_at, updated_at, created_by, updated_by, parent_id)
SELECT 
    'backlog'::task_stage as stage,
    p.created_at,
    p.updated_at,
    p.created_by,
    p.updated_by,
    NULL as parent_id  -- Projects become top-level parent tasks
FROM projects p;

-- Step 5: Create blocks for the migrated project tasks
-- We need to match the newly created tasks with their original projects
-- Create Title blocks for project tasks
WITH project_task_mapping AS (
    SELECT 
        p.id as original_project_id,
        p.name as project_name,
        p.description as project_description,
        p.color as project_color,
        t.id as new_task_id
    FROM projects p
    JOIN tasks t ON (
        t.created_at = p.created_at 
        AND t.created_by = p.created_by 
        AND t.parent_id IS NULL
        AND t.stage = 'backlog'
    )
    -- Ensure we only get the tasks we just created for projects
    WHERE NOT EXISTS (
        SELECT 1 FROM blocks b WHERE b.task_id = t.id
    )
)
-- Insert Title blocks for project tasks
INSERT INTO blocks (task_id, property_name, content, position, created_by, updated_by)
SELECT 
    ptm.new_task_id,
    'Title',
    to_jsonb(ptm.project_name),
    1,
    'migration',
    'migration'
FROM project_task_mapping ptm;

-- Insert Description blocks for project tasks (if description exists)
WITH project_task_mapping AS (
    SELECT 
        p.id as original_project_id,
        p.name as project_name,
        p.description as project_description,
        p.color as project_color,
        t.id as new_task_id
    FROM projects p
    JOIN tasks t ON (
        t.created_at = p.created_at 
        AND t.created_by = p.created_by 
        AND t.parent_id IS NULL
        AND t.stage = 'backlog'
    )
    -- Get the task that has our Title block
    WHERE EXISTS (
        SELECT 1 FROM blocks b 
        WHERE b.task_id = t.id 
        AND b.property_name = 'Title'
        AND b.created_by = 'migration'
    )
)
INSERT INTO blocks (task_id, property_name, content, position, created_by, updated_by)
SELECT 
    ptm.new_task_id,
    'Description',
    to_jsonb(COALESCE(ptm.project_description, 'Migrated from project: ' || ptm.project_name)),
    2,
    'migration',
    'migration'
FROM project_task_mapping ptm;

-- Step 6: Update existing tasks to reference their parent tasks instead of projects
-- First, create a mapping between original project IDs and new parent task IDs
WITH project_task_mapping AS (
    SELECT 
        p.id as original_project_id,
        t.id as new_parent_task_id
    FROM projects p
    JOIN tasks t ON (
        t.created_at = p.created_at 
        AND t.created_by = p.created_by 
        AND t.parent_id IS NULL
        AND t.stage = 'backlog'
    )
    WHERE EXISTS (
        SELECT 1 FROM blocks b 
        WHERE b.task_id = t.id 
        AND b.property_name = 'Title'
        AND b.created_by = 'migration'
    )
)
-- Update existing tasks to reference the new parent tasks
UPDATE tasks 
SET parent_id = ptm.new_parent_task_id
FROM project_task_mapping ptm
WHERE tasks.project_id = ptm.original_project_id
AND tasks.parent_id IS NULL  -- Don't update the parent tasks themselves
AND NOT EXISTS (
    SELECT 1 FROM blocks b 
    WHERE b.task_id = tasks.id 
    AND b.property_name = 'Title'
    AND b.created_by = 'migration'
);

-- Step 7: Add indexes for the new parent_id column
CREATE INDEX IF NOT EXISTS idx_tasks_parent_id ON tasks(parent_id);

-- Step 8: Create a view for backward compatibility (optional, can be used during transition)
CREATE OR REPLACE VIEW legacy_projects AS
SELECT 
    t.id,
    COALESCE(b.content->>'Title', 'Untitled Project') as name,
    COALESCE(b_desc.content->>'Description', '') as description,
    '#3b82f6' as color,  -- Default color for migrated projects
    t.created_at,
    t.updated_at,
    t.created_by,
    t.updated_by
FROM tasks t
LEFT JOIN blocks b ON t.id = b.task_id AND b.property_name = 'Title'
LEFT JOIN blocks b_desc ON t.id = b_desc.task_id AND b_desc.property_name = 'Description'
WHERE t.parent_id IS NULL  -- Top-level tasks are now "projects"
AND EXISTS (
    SELECT 1 FROM blocks bl 
    WHERE bl.task_id = t.id 
    AND bl.created_by = 'migration'
);

-- Step 9: Remove the project_id column from tasks table (this makes the migration irreversible)
-- Commented out for safety - uncomment after thorough testing
-- ALTER TABLE tasks DROP COLUMN project_id;

-- Step 10: Add comments for documentation
COMMENT ON COLUMN tasks.parent_id IS 'References parent task for hierarchical organization. NULL indicates top-level task/project.';
COMMENT ON VIEW legacy_projects IS 'Backward compatibility view showing top-level tasks as projects during migration period.';

-- Create a function to get all child tasks for a parent
CREATE OR REPLACE FUNCTION get_child_tasks(parent_task_id INTEGER)
RETURNS TABLE (
    id INTEGER,
    stage task_stage,
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE,
    created_by TEXT,
    updated_by TEXT,
    level INTEGER
) AS $$
BEGIN
    RETURN QUERY
    WITH RECURSIVE task_hierarchy AS (
        -- Base case: direct children
        SELECT 
            t.id,
            t.stage,
            t.created_at,
            t.updated_at,
            t.created_by,
            t.updated_by,
            1 as level
        FROM tasks t
        WHERE t.parent_id = parent_task_id
        
        UNION ALL
        
        -- Recursive case: children of children
        SELECT 
            t.id,
            t.stage,
            t.created_at,
            t.updated_at,
            t.created_by,
            t.updated_by,
            th.level + 1
        FROM tasks t
        JOIN task_hierarchy th ON t.parent_id = th.id
    )
    SELECT * FROM task_hierarchy ORDER BY level, created_at;
END;
$$ LANGUAGE plpgsql;

-- Migration validation queries (for testing)
-- These can be run after migration to verify data integrity

-- Verify all original projects were migrated
-- SELECT 'Projects migrated as parent tasks:' as check_type, COUNT(*) as count
-- FROM tasks t
-- WHERE t.parent_id IS NULL
-- AND EXISTS (SELECT 1 FROM blocks b WHERE b.task_id = t.id AND b.created_by = 'migration');

-- Verify all original tasks now have parent_id set
-- SELECT 'Tasks with parent_id set:' as check_type, COUNT(*) as count
-- FROM tasks t
-- WHERE t.parent_id IS NOT NULL;

-- Verify no orphaned tasks (should match original task count)
-- SELECT 'Total tasks after migration:' as check_type, COUNT(*) as count FROM tasks;

COMMIT;

-- After successful migration, you may want to:
-- 1. Drop the projects table: DROP TABLE projects CASCADE;
-- 2. Drop the project_id column: ALTER TABLE tasks DROP COLUMN project_id;
-- 3. Update application code to use parent_id instead of project_id
-- 4. Remove the legacy_projects view once migration is complete

SELECT 'Migration completed successfully. Verify data integrity before proceeding with application updates.' as status;
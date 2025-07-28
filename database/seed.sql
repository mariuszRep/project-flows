-- Seed script to populate initial data
-- This file is run after schema.sql during container initialization

-- Insert Task template
INSERT INTO templates (name, description, created_by, updated_by)
VALUES ('Task', 'Default template for managing tasks', 'system', 'system');

-- Get the ID of the Task template
WITH task_template AS (
    SELECT id FROM templates WHERE name = 'Task' LIMIT 1
)
-- Insert properties for the Task template
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
    task_template t
CROSS JOIN (
    SELECT 'Title' as key, 'text' as type, 'Clear, specific, and actionable task title. Use action verbs and be precise about what needs to be accomplished. Examples: ''Implement user login with OAuth'', ''Fix database connection timeout issue'', ''Design API endpoints for user management''' as description, 1 as execution_order, true as fixed
    UNION ALL
    SELECT 'Description' as key, 'text' as type, 'Description of the original request or problem statement. Include the ''what'' and ''why'' - what needs to be accomplished and why it''s important.' as description, 2 as execution_order, true as fixed
    UNION ALL
    SELECT 'Notes' as key, 'text' as type, 'Comprehensive context including: technical requirements, business constraints, dependencies, acceptance criteria, edge cases, and background information that impacts implementation decisions.' as description, 3 as execution_order, false as fixed
    UNION ALL
    SELECT 'Items' as key, 'text' as type, 'Markdown checklist of specific, actionable, and measurable steps. Each item should be concrete enough that completion can be verified.' as description, 4 as execution_order, false as fixed
) as data
ON CONFLICT (template_id, key) DO NOTHING;

SELECT 'Database seeded successfully with Task template and properties' as status;
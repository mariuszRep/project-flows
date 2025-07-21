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
INSERT INTO properties (template_id, key, type, description, execution_order, created_by, updated_by)
SELECT 
    t.id as template_id,
    data.key,
    data.type,
    data.description,
    data.execution_order,
    'system' as created_by,
    'system' as updated_by
FROM 
    task_template t
CROSS JOIN (
    SELECT 'Description' as key, 'text' as type, 'Detailed description of the task' as description, 1 as execution_order
    UNION ALL
    SELECT 'Notes' as key, 'text' as type, 'Additional notes and comments' as description, 2 as execution_order
    UNION ALL
    SELECT 'Items' as key, 'list' as type, 'Checklist items for the task' as description, 3 as execution_order
) as data
ON CONFLICT (template_id, key) DO NOTHING;

SELECT 'Database seeded successfully with Task template and properties' as status;
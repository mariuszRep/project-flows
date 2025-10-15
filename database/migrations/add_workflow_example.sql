-- Migration: Add Execute Task Workflow Example
-- Description: Creates an example workflow template that demonstrates the execute_task workflow functionality
-- Date: 2025-10-15

-- Create a workflow template for execute_task
INSERT INTO templates (name, description, type, metadata, created_by, updated_by)
VALUES (
  'Execute Task Workflow',
  'Example workflow that loads task context and guides execution with branch management',
  'workflow',
  '{
    "mcp_tool_name": "example_execute_task",
    "input_schema": {
      "type": "object",
      "properties": {
        "task_id": {
          "type": "number",
          "description": "The numeric ID of the task to execute"
        }
      },
      "required": ["task_id"]
    }
  }',
  'system',
  'system'
) ON CONFLICT DO NOTHING;

-- Get the template ID for the workflow
DO $$
DECLARE
  workflow_template_id INTEGER;
BEGIN
  SELECT id INTO workflow_template_id FROM templates WHERE name = 'Execute Task Workflow';

  -- Step 1: Load task context
  INSERT INTO template_properties (template_id, key, type, description, step_type, step_config, execution_order, created_by, updated_by)
  VALUES (
    workflow_template_id,
    'load_task',
    'workflow_step',
    'Load task context from database',
    'call_tool',
    '{
      "tool_name": "get_object",
      "parameters": {
        "object_id": "{{input.task_id}}"
      },
      "result_variable": "task_context"
    }',
    1,
    'system',
    'system'
  ) ON CONFLICT (template_id, key) DO NOTHING;

  -- Step 2: Log task loaded
  INSERT INTO template_properties (template_id, key, type, description, step_type, step_config, execution_order, created_by, updated_by)
  VALUES (
    workflow_template_id,
    'log_task_loaded',
    'workflow_step',
    'Log that task was loaded successfully',
    'log',
    '{
      "message": "📋 Retrieved task: {{task_context.blocks.Title}}"
    }',
    2,
    'system',
    'system'
  ) ON CONFLICT (template_id, key) DO NOTHING;

  -- Step 3: Check if task needs to be moved to doing
  INSERT INTO template_properties (template_id, key, type, description, step_type, step_config, execution_order, created_by, updated_by)
  VALUES (
    workflow_template_id,
    'check_task_stage',
    'workflow_step',
    'Check if task stage needs to be updated to doing',
    'conditional',
    '{
      "condition": "{{task_context.stage}} != ''doing''",
      "then": [
        {
          "name": "update_to_doing",
          "type": "call_tool",
          "toolName": "update_task",
          "parameters": {
            "task_id": "{{input.task_id}}",
            "stage": "doing"
          },
          "resultVariable": "update_result"
        },
        {
          "name": "log_stage_change",
          "type": "log",
          "message": "⚡ Moved task to Doing stage"
        }
      ],
      "else": [
        {
          "name": "log_already_doing",
          "type": "log",
          "message": "✓ Task already in Doing stage"
        }
      ]
    }',
    3,
    'system',
    'system'
  ) ON CONFLICT (template_id, key) DO NOTHING;

  -- Step 4: Load parent context (project/epic)
  INSERT INTO template_properties (template_id, key, type, description, step_type, step_config, execution_order, created_by, updated_by)
  VALUES (
    workflow_template_id,
    'load_parent_context',
    'workflow_step',
    'Load hierarchical parent context if available',
    'conditional',
    '{
      "condition": "{{task_context.parent_id}}",
      "then": [
        {
          "name": "get_parent",
          "type": "call_tool",
          "toolName": "get_object",
          "parameters": {
            "object_id": "{{task_context.parent_id}}"
          },
          "resultVariable": "parent_context"
        },
        {
          "name": "log_parent_loaded",
          "type": "log",
          "message": "📁 Loaded parent context: {{parent_context.type}} (ID: {{parent_context.id}})"
        }
      ]
    }',
    4,
    'system',
    'system'
  ) ON CONFLICT (template_id, key) DO NOTHING;

  -- Step 5: Build execution context
  INSERT INTO template_properties (template_id, key, type, description, step_type, step_config, execution_order, created_by, updated_by)
  VALUES (
    workflow_template_id,
    'build_execution_context',
    'workflow_step',
    'Build comprehensive execution context',
    'set_variable',
    '{
      "variableName": "execution_context",
      "value": {
        "task_id": "{{input.task_id}}",
        "status": "Ready for execution",
        "task_title": "{{task_context.blocks.Title}}",
        "task_context": "{{task_context}}",
        "parent_context": "{{parent_context}}",
        "workflow_steps": [
          "Step 1: Analyze task requirements with full context",
          "Step 2: Plan implementation approach",
          "Step 3: Request explicit permission to execute",
          "Step 4: Execute implementation after approval",
          "Step 5: Move task to review stage when complete"
        ],
        "instructions": [
          "Review task requirements in task_context",
          "Consider parent context for broader scope",
          "Present detailed implementation plan",
          "Wait for explicit approval before proceeding",
          "Update task stage to review when complete"
        ]
      }
    }',
    5,
    'system',
    'system'
  ) ON CONFLICT (template_id, key) DO NOTHING;

  -- Step 6: Return execution context
  INSERT INTO template_properties (template_id, key, type, description, step_type, step_config, execution_order, created_by, updated_by)
  VALUES (
    workflow_template_id,
    'return_context',
    'workflow_step',
    'Return execution context to caller',
    'return',
    '{
      "value": "{{execution_context}}"
    }',
    6,
    'system',
    'system'
  ) ON CONFLICT (template_id, key) DO NOTHING;

END $$;

-- Verify the workflow was created
SELECT
  t.id,
  t.name,
  t.type,
  t.metadata->>'mcp_tool_name' as tool_name,
  COUNT(tp.id) as step_count
FROM templates t
LEFT JOIN template_properties tp ON tp.template_id = t.id AND tp.step_type != 'property'
WHERE t.type = 'workflow'
GROUP BY t.id, t.name, t.type, t.metadata;

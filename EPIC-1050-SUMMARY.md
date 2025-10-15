# EPIC 1050 - Workflow System Implementation

## Status: Database Schema Alignment Complete ✅

**Branch:** `epic-1050`
**Date:** 2025-10-15
**Objective:** Investigate and align database schema with workflow implementation from EPIC 1050

---

## Executive Summary

EPIC 1050 implemented a comprehensive workflow system that enables:
1. **Dynamic MCP tool registration** from database-stored workflow definitions
2. **Workflow execution engine** with step-by-step interpretation
3. **UI for workflow management** (localStorage + database persistence)
4. **execute_task workflow** for guided task execution with context loading

**Critical Finding:** Database was restored, missing columns required by the workflow implementation. All schema mismatches have been resolved.

---

## Database Schema Changes

### Issue Found
After database restoration, the following columns were missing:
- `templates.type` - Required to distinguish 'object' vs 'workflow' templates
- `templates.metadata` - Stores workflow input_schema and mcp_tool_name
- `template_properties.step_type` - Identifies workflow steps vs properties
- `template_properties.step_config` - Stores workflow step configuration (JSON)

### Migrations Applied

#### 1. Add Workflow Columns to `templates` Table
```sql
ALTER TABLE templates
ADD COLUMN type text DEFAULT 'object' NOT NULL,
ADD COLUMN metadata jsonb DEFAULT '{}' NOT NULL,
ADD CONSTRAINT templates_type_check CHECK (type = ANY (ARRAY['object'::text, 'workflow'::text]));

CREATE INDEX idx_templates_type ON templates USING btree (type);
CREATE INDEX idx_templates_metadata ON templates USING gin (metadata);
```

#### 2. Add Workflow Step Columns to `template_properties` Table
```sql
ALTER TABLE template_properties
ADD COLUMN step_type text DEFAULT 'property' NOT NULL,
ADD COLUMN step_config jsonb DEFAULT '{}' NOT NULL,
ADD CONSTRAINT template_properties_step_type_check CHECK (step_type = ANY (ARRAY['property'::text, 'call_tool'::text, 'log'::text, 'set_variable'::text, 'conditional'::text, 'return'::text]));

CREATE INDEX idx_template_properties_step_type ON template_properties USING btree (step_type);
CREATE INDEX idx_template_properties_step_config ON template_properties USING gin (step_config);
```

#### 3. Example Workflow Template
Created `Execute Task Workflow` (template_id: 5) with 6 workflow steps demonstrating the complete workflow execution pattern.

---

## Architecture Overview

### 1. Templates System

The `templates` table now supports two types:

#### Object Templates (type: 'object')
- **Task** (id: 1) - Standard task template
- **Project** (id: 2) - Project-level parent tasks
- **Epic** (id: 3) - Feature-level groupings
- **Rule** (id: 4) - Project rules and guidelines

#### Workflow Templates (type: 'workflow')
- **Execute Task Workflow** (id: 5) - Example workflow implementation
- Future workflow templates can be added dynamically

### 2. Template Properties System

The `template_properties` table now supports two purposes:

#### Standard Properties (step_type: 'property')
- Define object fields like Title, Description, Analysis, etc.
- Used by object templates (Task, Project, Epic, Rule)
- Original functionality preserved

#### Workflow Steps (step_type: 'call_tool' | 'log' | 'set_variable' | 'conditional' | 'return')
- Define executable workflow steps
- Used by workflow templates
- Stored in `step_config` JSONB column
- Executed by WorkflowExecutor

### 3. Workflow Execution Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    MCP Client Request                        │
│              (example_execute_task tool call)                │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│              MCP Server (server-factory.ts)                  │
│  1. Receives tool call                                       │
│  2. Checks if tool is dynamic workflow                       │
│  3. Loads workflow definition from database                  │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│          WorkflowExecutor (workflow-executor.ts)             │
│  1. loadWorkflowFromDatabase(template_id: 5)                 │
│  2. Converts database records to WorkflowStep objects        │
│  3. execute(workflow, inputs)                                │
│  4. Processes steps sequentially                             │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                  Step Execution                              │
│  • call_tool: Invokes other MCP tools (get_object, etc.)    │
│  • log: Outputs messages to console                          │
│  • set_variable: Stores values in execution context          │
│  • conditional: Evaluates conditions, executes branches      │
│  • return: Returns final result                              │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                   Return Result to MCP Client                │
└─────────────────────────────────────────────────────────────┘
```

---

## Key Implementation Files

### Backend (MCP Server)

#### `/mcp/src/tools/workflow-executor.ts` (513 lines)
Core workflow execution engine:
- **WorkflowExecutor class**: Interprets and executes workflow definitions
- **Step types**: log, set_variable, conditional, call_tool, return
- **Variable interpolation**: `{{variableName}}`, `{{input.fieldName}}`
- **Context management**: Variables, inputs, logs, step results
- **Tool calling interface**: Allows workflows to invoke other MCP tools
- **Database integration**: loadWorkflowFromDatabase() method

Key features:
```typescript
interface WorkflowDefinition {
  name: string;
  description: string;
  inputSchema: any;
  steps: WorkflowStep[];
}

interface WorkflowStep {
  name: string;
  type: 'log' | 'set_variable' | 'conditional' | 'call_tool' | 'return';
  message?: string;
  variableName?: string;
  value?: any;
  condition?: string;
  then?: WorkflowStep[];
  else?: WorkflowStep[];
  toolName?: string;
  parameters?: Record<string, any>;
  resultVariable?: string;
}
```

#### `/mcp/src/tools/workflow-tools.ts` (620 lines)
Specialized workflow orchestration tools:
- **execute_task**: Guided task execution with branch management
- **initiate_object**: Analyze object and generate breakdown tasks
- Branch validation and creation guidance
- Hierarchical context loading (task → epic → project)
- Project rules loading and application
- Rollback on failure

Key features:
- Automatic stage transitions (backlog → doing → review)
- Git branch naming conventions (task-{id})
- Parent relationship traversal
- Execution context generation

#### `/mcp/src/mcp/server-factory.ts` (Modified)
Dynamic workflow registration:
- In-memory workflow storage (Map)
- Dynamic tool list generation
- Workflow execution routing
- REST API integration functions

Key functions:
```typescript
export function registerWorkflow(workflow: WorkflowDefinition): void
export function unregisterWorkflow(name: string): boolean
export function listDynamicWorkflows(): WorkflowDefinition[]
export function getWorkflow(name: string): WorkflowDefinition | undefined
```

#### `/mcp/src/index.ts` (Modified)
REST API endpoints for workflow management:
- `POST /api/workflows` - Register workflow
- `DELETE /api/workflows/:name` - Unregister workflow
- `GET /api/workflows` - List all workflows
- `GET /api/workflows/:name` - Get specific workflow

### Frontend (React UI)

#### `/ui/src/pages/Workflows.tsx` (355 lines)
Main workflows management page:
- List view with status indicators (Registered/Unregistered)
- Create/Edit/Delete workflow actions
- Register/Unregister with MCP server
- Empty state with call-to-action
- Integration with workflowStorageService

#### `/ui/src/components/workflows/WorkflowEditor.tsx` (188 lines)
JSON editor for workflow definitions:
- Real-time validation feedback
- Schema reference documentation
- Example workflow template
- Syntax highlighting

#### `/ui/src/services/workflowStorageService.ts` (246 lines)
localStorage-based workflow persistence:
- CRUD operations with validation
- Import/export functionality
- Schema validation helpers

### Database

#### `/database/init/schema.sql`
Current schema with all workflow-supporting columns:
- templates (with type, metadata columns)
- template_properties (with step_type, step_config columns)
- All indexes and constraints

#### `/database/migrations/add_workflow_example.sql`
Example workflow implementation:
- Creates "Execute Task Workflow" template
- 6 workflow steps demonstrating full execution pattern
- Showcases call_tool, log, conditional, set_variable, return steps

---

## Workflow Step Types

### 1. `log` - Output Messages
```json
{
  "name": "log_start",
  "type": "log",
  "message": "Starting workflow with: {{input.message}}"
}
```

### 2. `set_variable` - Store Values
```json
{
  "name": "set_result",
  "type": "set_variable",
  "variableName": "result",
  "value": "{{input.message}}"
}
```

### 3. `conditional` - Branching Logic
```json
{
  "name": "check_stage",
  "type": "conditional",
  "condition": "{{task.stage}} != 'doing'",
  "then": [
    {
      "name": "update_stage",
      "type": "call_tool",
      "toolName": "update_task",
      "parameters": {"task_id": "{{input.task_id}}", "stage": "doing"},
      "resultVariable": "update_result"
    }
  ],
  "else": [
    {
      "name": "log_already_doing",
      "type": "log",
      "message": "Task already in Doing stage"
    }
  ]
}
```

### 4. `call_tool` - Invoke MCP Tools
```json
{
  "name": "load_task",
  "type": "call_tool",
  "toolName": "get_object",
  "parameters": {
    "object_id": "{{input.task_id}}"
  },
  "resultVariable": "task_context"
}
```

### 5. `return` - Return Result
```json
{
  "name": "return_context",
  "type": "return",
  "value": {
    "success": true,
    "task_id": "{{input.task_id}}",
    "context": "{{task_context}}"
  }
}
```

---

## Variable Interpolation

The workflow executor supports powerful variable interpolation:

### Input References
- `{{input.fieldName}}` - Access specific input field
- `{{input}}` - Access all inputs as object

### Variable References
- `{{variableName}}` - Access stored variable
- `{{result.object_id}}` - Access nested properties
- `{{task_context.blocks.Title}}` - Deep property access

### Special Variables
- `{{logs}}` - Access execution logs array

---

## Example Workflow: execute_task

The example workflow demonstrates a complete task execution pattern:

### Steps

1. **Load Task Context** (`call_tool`)
   - Calls `get_object` with task_id
   - Stores result in `task_context` variable

2. **Log Task Loaded** (`log`)
   - Outputs task title to console
   - Uses interpolation: `{{task_context.blocks.Title}}`

3. **Check Task Stage** (`conditional`)
   - Condition: `{{task_context.stage}} != 'doing'`
   - **Then branch**: Update task to "doing" stage
   - **Else branch**: Log that task is already in doing

4. **Load Parent Context** (`conditional`)
   - Condition: `{{task_context.parent_id}}`
   - **Then branch**: Load parent object (epic/project)

5. **Build Execution Context** (`set_variable`)
   - Creates comprehensive execution context object
   - Includes task, parent, instructions, workflow steps

6. **Return Context** (`return`)
   - Returns execution context to caller
   - Includes all loaded data and instructions

### Usage
```json
{
  "name": "example_execute_task",
  "arguments": {
    "task_id": 1
  }
}
```

---

## Testing the Implementation

### 1. Verify Database Schema
```bash
# Check templates table
docker exec mcp-postgres psql -U mcp_user -d mcp_tasks -c "\d templates"

# Check template_properties table
docker exec mcp-postgres psql -U mcp_user -d mcp_tasks -c "\d template_properties"

# List workflow templates
docker exec mcp-postgres psql -U mcp_user -d mcp_tasks -c "SELECT id, name, type FROM templates WHERE type = 'workflow'"

# List workflow steps
docker exec mcp-postgres psql -U mcp_user -d mcp_tasks -c "SELECT key, step_type FROM template_properties WHERE step_type != 'property'"
```

### 2. Test MCP Server
```bash
# Start MCP server
cd mcp && npm run dev

# Server should start on http://localhost:3001
# Check logs for workflow loading messages
```

### 3. Test Workflow Registration (UI)
```bash
# Start UI
cd ui && npm run dev

# Navigate to http://localhost:5173/workflows
# Create new workflow or register existing ones
```

### 4. Test Workflow Execution (MCP Client)
Using any MCP client (Windsurf, Claude Desktop, etc.):
```json
{
  "method": "tools/call",
  "params": {
    "name": "example_execute_task",
    "arguments": {
      "task_id": 1
    }
  }
}
```

---

## Current State vs Expected State

### ✅ Completed
- [x] Database schema aligned with code requirements
- [x] All workflow-related columns added
- [x] Indexes created for performance
- [x] Example workflow template created
- [x] WorkflowExecutor implementation complete
- [x] Workflow tools (execute_task, initiate_object) complete
- [x] UI for workflow management complete
- [x] REST API endpoints functional

### 🔄 Current Limitations
- Workflows stored in-memory on server (cleared on restart)
- No workflow versioning system
- No workflow execution history/logs in UI
- No visual workflow builder (JSON only)

### 🚀 Future Enhancements
1. **Persistent Workflow Storage**
   - Store registered workflows in database
   - Automatic re-registration on server restart

2. **Workflow Versioning**
   - Track workflow changes over time
   - Rollback capability

3. **Execution History**
   - Store workflow execution logs
   - UI for viewing past executions

4. **Visual Workflow Builder**
   - Drag-and-drop interface
   - Step library/palette

5. **Advanced Step Types**
   - API calls (HTTP requests)
   - Database queries
   - File operations
   - Async/parallel execution

---

## Files Modified in EPIC 1050

### Database
- ✅ `/database/init/schema.sql` - Updated schema with workflow columns
- ✅ `/database/migrations/add_workflow_example.sql` - Example workflow

### Backend
- ✅ `/mcp/src/tools/workflow-executor.ts` - Created (513 lines)
- ✅ `/mcp/src/tools/workflow-tools.ts` - Created (620 lines)
- ✅ `/mcp/src/mcp/server-factory.ts` - Modified (~130 lines added)
- ✅ `/mcp/src/index.ts` - Modified (~95 lines added)
- ✅ `/mcp/src/server/express-server.ts` - Modified (~10 lines)

### Frontend
- ✅ `/ui/src/pages/Workflows.tsx` - Created (355 lines)
- ✅ `/ui/src/components/workflows/WorkflowEditor.tsx` - Created (188 lines)
- ✅ `/ui/src/services/workflowStorageService.ts` - Created (246 lines)
- ✅ `/ui/src/App.tsx` - Modified (added /workflows route)
- ✅ `/ui/src/pages/Dashboard.tsx` - Modified (added Workflows card)
- ✅ `/ui/src/components/ui/alert-dialog.tsx` - Added via shadcn

### Documentation
- ✅ `/TASK-1049-SUMMARY.md` - Implementation summary
- ✅ `/EPIC-1050-SUMMARY.md` - This document

---

## Critical Implementation Notes

### 1. Template Type Distinction
The `templates.type` column is critical for distinguishing:
- **'object'**: Standard templates (Task, Project, Epic, Rule) with properties
- **'workflow'**: Workflow templates with executable steps

### 2. Step Type Distinction
The `template_properties.step_type` column determines behavior:
- **'property'**: Standard object property (Title, Description, etc.)
- **'call_tool'**, **'log'**, etc.: Workflow execution steps

### 3. Metadata Structure
The `templates.metadata` JSONB column stores:
```json
{
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
}
```

### 4. Step Config Structure
The `template_properties.step_config` JSONB column varies by step_type:

**For call_tool:**
```json
{
  "tool_name": "get_object",
  "parameters": {"object_id": "{{input.task_id}}"},
  "result_variable": "task_context"
}
```

**For log:**
```json
{
  "message": "Starting workflow: {{input.message}}"
}
```

**For set_variable:**
```json
{
  "variableName": "result",
  "value": "{{input.data}}"
}
```

**For conditional:**
```json
{
  "condition": "{{variable}} == value",
  "then": [...],
  "else": [...]
}
```

**For return:**
```json
{
  "value": {"success": true, "data": "{{result}}"}
}
```

---

## Migration Path for Restored Databases

If you restore a database backup from before EPIC 1050:

### Step 1: Add Workflow Columns
```sql
-- Add to templates
ALTER TABLE templates
ADD COLUMN IF NOT EXISTS type text DEFAULT 'object' NOT NULL,
ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}' NOT NULL,
ADD CONSTRAINT templates_type_check CHECK (type = ANY (ARRAY['object'::text, 'workflow'::text]));

-- Add to template_properties
ALTER TABLE template_properties
ADD COLUMN IF NOT EXISTS step_type text DEFAULT 'property' NOT NULL,
ADD COLUMN IF NOT EXISTS step_config jsonb DEFAULT '{}' NOT NULL,
ADD CONSTRAINT template_properties_step_type_check CHECK (step_type = ANY (ARRAY['property'::text, 'call_tool'::text, 'log'::text, 'set_variable'::text, 'conditional'::text, 'return'::text]));
```

### Step 2: Add Indexes
```sql
CREATE INDEX IF NOT EXISTS idx_templates_type ON templates USING btree (type);
CREATE INDEX IF NOT EXISTS idx_templates_metadata ON templates USING gin (metadata);
CREATE INDEX IF NOT EXISTS idx_template_properties_step_type ON template_properties USING btree (step_type);
CREATE INDEX IF NOT EXISTS idx_template_properties_step_config ON template_properties USING gin (step_config);
```

### Step 3: Create Example Workflow
```bash
docker exec -i mcp-postgres psql -U mcp_user -d mcp_tasks < /root/projects/project-flows/database/migrations/add_workflow_example.sql
```

---

## Conclusion

EPIC 1050 successfully implemented a comprehensive workflow system that enables:

1. ✅ **Database-driven workflow definitions** stored as templates
2. ✅ **Dynamic MCP tool registration** from workflow templates
3. ✅ **Powerful execution engine** with step interpolation and tool calling
4. ✅ **UI for workflow management** (create, edit, register, delete)
5. ✅ **Example workflow** demonstrating full execution pattern

The database schema has been fully aligned with the code implementation. All missing columns have been added, and an example workflow has been created to demonstrate the functionality.

**Next Steps:**
1. Test the example workflow with MCP clients
2. Create additional workflow templates for common operations
3. Consider implementing persistent workflow storage
4. Add workflow execution history tracking
5. Build visual workflow builder for improved UX

---

**Document Version:** 1.0
**Last Updated:** 2025-10-15
**Author:** Claude Code
**Status:** Complete ✅

# Agent Node Design Pattern

## Overview
Agent nodes are executable workflow steps that surface dynamic prompts to AI agents. The workflow engine interpolates the prompt with context and returns it to the agent for execution.

## How It Works

### 1. **Agent Node Structure**
- **Type**: `agent`
- **Prompt Field**: Contains instructions/context for the AI agent
- **Dynamic Interpolation**: Supports `{{input.field}}` and `{{variable.name}}` syntax

### 2. **Execution Flow**
```
Workflow Start → Previous Steps → Agent Node → Workflow Pauses
                                      ↓
                        Returns Interpolated Prompt to Agent
                                      ↓
                            Agent Executes Prompt
                                      ↓
                        (Workflow can continue if needed)
```

### 3. **Prompt Interpolation**
The prompt can reference:
- **Workflow Inputs**: `{{input.parameter_name}}` - Values passed when calling the workflow
- **Previous Step Results**: `{{variable.result_name}}` - Results from previous workflow steps
- **Nested Properties**: `{{variable.object.property}}` - Access nested object properties

### 4. **Example Use Case: Create Task Workflow**

**Workflow Setup:**
1. **Start Node** - Defines workflow parameters (e.g., `project_id`, `requirements`)
2. **Agent Node** - Prompts agent to analyze and create task breakdown
3. **End Node** - Workflow completes

**Agent Node Prompt Example:**
```
You are tasked with creating a new task for project {{input.project_id}}.

Requirements:
{{input.requirements}}

Please analyze these requirements and create a task with:
- Title: Clear, actionable title
- Description: Detailed description with acceptance criteria
- Analysis: Technical analysis of what needs to be done

Use the create_task tool to create the task.
```

**When Executed:**
- Workflow receives: `{project_id: 123, requirements: "Add user authentication"}`
- Agent sees: "You are tasked with creating a new task for project 123..."
- Agent acts on the prompt and creates the task

### 5. **Multi-Stage Workflows**

You can chain multiple agent nodes for complex workflows:

```
Start → Load Context → Agent Node 1 (Plan) → Agent Node 2 (Execute) → Agent Node 3 (Review) → End
```

Each agent node can:
- Reference previous agent results via `{{variable.name}}`
- Build upon previous context
- Execute different phases of work

### 6. **Dynamic Prompts**

The prompt changes based on workflow inputs and previous steps:

**Example: Task Execution Workflow**
```
Agent Node Prompt:
Execute the following task:

Task ID: {{input.task_id}}
Task Title: {{task_data.title}}
Task Description: {{task_data.description}}

Project Context:
{{project_context.guidelines}}

Please implement this task following the project guidelines.
```

## Implementation Details

### Frontend (UI)
- **AgentNode Component**: Visual representation with Bot icon and purple background
- **NodeEditModal**: Configuration panel with prompt textarea
- **Interpolation Hints**: UI shows available `{{input.*}}` and `{{variable.*}}` references

### Backend (Workflow Executor)
- **Step Type**: `'agent'` added to WorkflowStep type union
- **executeAgent Method**: Interpolates prompt and returns to agent
- **Workflow Pause**: Execution stops at agent node, returns prompt as result

### Database Schema
- **step_type**: `'agent'`
- **step_config**: `{ prompt: string }`
- Stored in `template_properties` table

## Benefits

1. **Flexible Agent Interaction**: Agents can execute complex, context-aware prompts
2. **Dynamic Context**: Prompts adapt based on workflow state and inputs
3. **Reusable Patterns**: Create workflow templates that agents can execute repeatedly
4. **Clear Separation**: Workflow orchestration separate from agent execution
5. **Composable**: Chain multiple agent nodes for multi-phase workflows

## Example Workflows

### Workflow 1: Create Task from Requirements
```
Start (input: requirements, project_id)
  ↓
Agent Node: "Analyze requirements and create task breakdown"
  ↓
End
```

### Workflow 2: Task Execution Pipeline
```
Start (input: task_id)
  ↓
Load Task Data (call_tool: get_object)
  ↓
Agent Node 1: "Analyze task and create implementation plan"
  ↓
Agent Node 2: "Execute the implementation plan"
  ↓
Agent Node 3: "Review and test the implementation"
  ↓
Update Task Status (call_tool: update_task)
  ↓
End
```

### Workflow 3: Project Breakdown
```
Start (input: project_description)
  ↓
Agent Node 1: "Break down project into epics"
  ↓
Save Epics (set_variable: epic_list)
  ↓
Agent Node 2: "For each epic, create tasks using {{epic_list}}"
  ↓
End
```

## Design Pattern: Agent as Executor

The key insight is that **agent nodes surface context** rather than execute directly:

- **Traditional Approach**: Workflow tries to do everything automatically
- **Agent Node Approach**: Workflow prepares context, agent decides how to act

This allows:
- Agents to apply reasoning and judgment
- Flexible execution based on context
- Human-like decision making in workflows
- Adaptation to changing requirements

## Future Enhancements

1. **Agent Response Capture**: Store agent's response back into workflow variables
2. **Conditional Agent Nodes**: Branch based on agent's decision
3. **Multi-Agent Workflows**: Different agents for different steps
4. **Agent Feedback Loop**: Agent can trigger workflow continuation
5. **Prompt Templates**: Reusable prompt patterns with parameter substitution

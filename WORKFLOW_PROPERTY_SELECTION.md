# Workflow Property Selection Guide

## Overview

The `create_object` and `load_object` workflow steps allow workflows to explicitly define which properties to use and how to populate them. The system implements a **unified step model** where workflow inputs are treated as the first step in the execution chain, making all parameters (inputs and previous step outputs) accessible through a consistent interface.

## Key Concepts

### Unified Step Model

All parameter sources are treated as "steps" in the workflow:
- **Workflow Parameters**: The first step (named "input") containing all workflow input parameters defined in the start node
- **Previous Steps**: All executed steps before the current step, with their result variables

This creates a consistent mental model: `{{steps.stepName.variable}}` works for both workflow parameters and previous step outputs.

### Parameter Resolution

The workflow executor supports multiple parameter reference syntaxes:

```javascript
{{steps.input.paramName}}        // Workflow input (explicit)
{{input.paramName}}              // Workflow input (backward compatible)
{{steps.stepName.resultVar}}    // Previous step output
{{variableName}}                 // Context variable
```

## Backend Behavior

The workflow executor:
- ✅ Stores workflow inputs as the first "step" result
- ✅ Supports `{{steps.stepName.variable}}` syntax for all references
- ✅ Validates that referenced steps exist and are defined before use
- ✅ Provides clear error messages for missing references
- ✅ Maintains backward compatibility with `{{input.field}}` syntax

### Workflow Step Configuration

When creating a `create_object` workflow step, you define:

```json
{
  "step_type": "create_object",
  "step_config": {
    "template_id": 1,
    "properties": {
      "Title": "{{steps.input.title}}",
      "Description": "{{steps.analyze.summary}}",
      "Analysis": "Static value"
    },
    "result_variable": "created_task"
  }
}
```

**Key Points:**
- Only properties listed in `properties` will be used
- You can omit any property (e.g., optional fields)
- Values support multiple syntaxes:
  - `{{steps.input.field}}` - Workflow input parameter
  - `{{steps.stepName.var}}` - Previous step output
  - `{{input.field}}` - Backward compatible workflow input
  - Plain text - Static value

## UI Implementation Guide

The UI uses the **ParameterSelector** component to provide a unified interface for selecting parameter sources.

### ParameterSelector Component

Located at `ui/src/components/workflows/ParameterSelector.tsx`

**Features:**
- Two-mode toggle: "Reference Parameter" or "Manual Value"
- Unified dropdown showing workflow parameters + previous step outputs
- Automatic syntax generation: `{{steps.stepName.variable}}`
- Support for static values in manual mode

**Props:**
```typescript
{
  value: string | boolean;                // Current parameter value
  onChange: (value: string | boolean) => void;
  propertyKey: string;                    // Property name
  propertyType?: string;                  // Data type (text, number, etc.)
  propertyDescription?: string;           // Help text
  workflowParameters: string[];          // Workflow input parameter names
  previousSteps: PreviousStep[];         // Array of previous steps with variables
  placeholder?: string;
}
```

### Integration Example (NodeEditModal.tsx)

```tsx
import { ParameterSelector, PreviousStep } from './ParameterSelector';

// Extract previous steps (simplified - needs workflow graph traversal)
const [previousSteps, setPreviousSteps] = useState<PreviousStep[]>([]);

// For each property:
<ParameterSelector
  value={selectedProperties[propKey]}
  onChange={(newValue) => updatePropertyMapping(propKey, newValue)}
  propertyKey={propKey}
  propertyType={property?.type || 'text'}
  propertyDescription={property?.description}
  workflowParameters={workflowParameters}
  previousSteps={previousSteps}
  placeholder="Select parameter or enter value"
/>
```

### Workflow Graph Traversal (TODO)

To extract previous steps from the workflow graph:

```typescript
const extractPreviousSteps = (currentNode: Node, allNodes: Node[], edges: Edge[]): PreviousStep[] => {
  const steps: PreviousStep[] = [];

  // Find all nodes that come before the current node
  // by traversing edges backward from current node

  // For each previous node, extract:
  // - name: node.data.label
  // - variables: [node.data.config.result_variable] or infer from node type
  // - type: node.type

  return steps;
};
```

## Example Workflows

### Example 1: Workflow Input Parameters

```json
{
  "name": "create_minimal_task",
  "step_type": "create_object",
  "step_config": {
    "template_id": 1,
    "properties": {
      "Title": "{{steps.input.task_title}}",
      "Description": "{{steps.input.task_description}}"
    }
  }
}
```

### Example 2: Previous Step Output

```json
{
  "steps": [
    {
      "name": "analyze_task",
      "step_type": "call_tool",
      "step_config": {
        "tool_name": "analyze_requirements",
        "parameters": { "text": "{{steps.input.requirements}}" },
        "result_variable": "analysis"
      }
    },
    {
      "name": "create_task",
      "step_type": "create_object",
      "step_config": {
        "template_id": 1,
        "properties": {
          "Title": "{{steps.input.title}}",
          "Description": "{{steps.input.description}}",
          "Analysis": "{{steps.analyze_task.summary}}"
        }
      }
    }
  ]
}
```

### Example 3: Mixed Sources (Inputs + Steps + Static)

```json
{
  "name": "create_full_task",
  "step_type": "create_object",
  "step_config": {
    "template_id": 1,
    "properties": {
      "Title": "{{steps.input.title}}",
      "Description": "{{steps.analyze.summary}}",
      "Analysis": "Generated from automated analysis"
    }
  }
}
```

### Example 4: Backward Compatible Syntax

```json
{
  "name": "create_task_legacy",
  "step_type": "create_object",
  "step_config": {
    "template_id": 1,
    "properties": {
      "Title": "{{input.title}}",
      "Description": "{{input.description}}"
    }
  }
}
```

## API Reference

### list_properties Tool

Get available properties for a template:

```typescript
const response = await mcpClient.callTool('list_properties', {
  template_id: 1 // 1=Task, 2=Project, 3=Epic, 4=Rule
});

// Response structure:
{
  properties: [
    {
      id: 1,
      template_id: 1,
      key: "Title",
      type: "text",
      description: "Task title",
      step_type: "property",
      execution_order: 1
    },
    // ... more properties
  ]
}
```

### create_object Tool

Create an object with selected properties:

```typescript
const response = await mcpClient.callTool('create_object', {
  template_id: 1,
  properties: {
    Title: "My Task",
    Description: "Task description"
    // Analysis omitted - workflow choice
  },
  stage: "draft", // optional
  related: [{ id: 123, object: "project" }] // optional
});
```

## Benefits

✅ **Workflow Flexibility**: Each workflow decides which properties to use  
✅ **Reduced Complexity**: Don't force users to provide all fields  
✅ **UI Control**: Property selection happens in the visual workflow builder  
✅ **Reusability**: Same tool works for different use cases (minimal vs full)  
✅ **Clear Intent**: Workflow configuration shows exactly what's being created  

## Migration Notes

If you have existing workflows using the old approach:

**Before (hardcoded in tool):**
- Tool enforced all required fields
- No way to omit optional fields

**After (workflow-controlled):**
- Workflow explicitly lists properties to use
- Can omit any property
- More flexible and maintainable

## Testing

Test that property selection works:

```typescript
// Test 1: Minimal properties (Title + Description only)
await mcpClient.callTool('create_object', {
  template_id: 1,
  properties: {
    Title: "Test Task",
    Description: "Test Description"
  }
});
// ✅ Should succeed without Analysis

// Test 2: Full properties
await mcpClient.callTool('create_object', {
  template_id: 1,
  properties: {
    Title: "Test Task",
    Description: "Test Description",
    Analysis: "Test Analysis"
  }
});
// ✅ Should succeed with all fields

// Test 3: Different template
await mcpClient.callTool('create_object', {
  template_id: 3, // Epic
  properties: {
    Title: "Test Epic",
    Description: "Epic Description"
  }
});
// ✅ Should work for any template type
```

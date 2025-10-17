# Workflow Property Selection Guide

## Overview

The `create_object` workflow step allows workflows to explicitly define which properties to use when creating objects. This gives workflow designers full control over which fields to populate, rather than being forced to provide all template properties.

## How It Works

### Backend Behavior

The `create_object` tool:
- ✅ Accepts any subset of properties from the template schema
- ✅ Does NOT enforce all required fields
- ✅ Validates dependencies between provided properties only
- ✅ Allows workflows to omit optional fields like `Analysis`

### Workflow Step Configuration

When creating a `create_object` workflow step, you define:

```json
{
  "step_type": "create_object",
  "step_config": {
    "template_id": 1,
    "properties": {
      "Title": "{{input.title}}",
      "Description": "{{input.description}}"
    },
    "result_variable": "created_task"
  }
}
```

**Key Points:**
- Only properties listed in `properties` will be used
- You can omit any property (e.g., `Analysis`)
- Values support interpolation: `{{input.field}}`, `{{variable.name}}`

## UI Implementation Guide

### Step 1: Template Selection

```tsx
// Dropdown to select template type
<Select value={templateId} onChange={setTemplateId}>
  <option value={1}>Task</option>
  <option value={2}>Project</option>
  <option value={3}>Epic</option>
  <option value={4}>Rule</option>
</Select>
```

### Step 2: Load Available Properties

```typescript
// Call MCP tool to get available properties for selected template
const response = await mcpClient.callTool('list_properties', {
  template_id: templateId
});

// Filter to only 'property' type (exclude workflow steps)
const availableProperties = response.properties.filter(
  prop => prop.step_type === 'property'
);
```

### Step 3: Property Selection UI

```tsx
// Show checkboxes for each available property
{availableProperties.map(prop => (
  <div key={prop.key}>
    <Checkbox
      checked={selectedProperties.includes(prop.key)}
      onChange={() => toggleProperty(prop.key)}
    />
    <label>{prop.key}</label>
    <span className="text-muted">{prop.description}</span>
  </div>
))}
```

### Step 4: Value Configuration

```tsx
// For each selected property, show input for value/interpolation
{selectedProperties.map(propKey => {
  const prop = availableProperties.find(p => p.key === propKey);
  return (
    <div key={propKey}>
      <label>{propKey}</label>
      <Input
        placeholder="e.g., {{input.title}} or static value"
        value={propertyValues[propKey] || ''}
        onChange={(e) => setPropertyValue(propKey, e.target.value)}
      />
      <small>{prop.description}</small>
    </div>
  );
})}
```

### Step 5: Build Step Configuration

```typescript
const stepConfig = {
  template_id: templateId,
  properties: Object.fromEntries(
    selectedProperties.map(key => [key, propertyValues[key]])
  ),
  result_variable: resultVariable // optional
};

// Save to workflow step
await saveWorkflowStep({
  key: stepName,
  step_type: 'create_object',
  step_config: stepConfig,
  execution_order: order
});
```

## Example Workflows

### Minimal Task Creation (Title + Description only)

```json
{
  "name": "create_minimal_task",
  "step_type": "create_object",
  "step_config": {
    "template_id": 1,
    "properties": {
      "Title": "{{input.task_title}}",
      "Description": "{{input.task_description}}"
    }
  }
}
```

### Full Task Creation (All Fields)

```json
{
  "name": "create_full_task",
  "step_type": "create_object",
  "step_config": {
    "template_id": 1,
    "properties": {
      "Title": "{{input.title}}",
      "Description": "{{input.description}}",
      "Analysis": "{{analysis_result}}"
    }
  }
}
```

### Epic Creation with Parent

```json
{
  "name": "create_epic",
  "step_type": "create_object",
  "step_config": {
    "template_id": 3,
    "properties": {
      "Title": "{{input.epic_title}}",
      "Description": "{{input.epic_description}}"
    },
    "stage": "draft",
    "related": [{"id": "{{project_id}}", "object": "project"}]
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

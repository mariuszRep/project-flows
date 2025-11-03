# Test Sampling Tool - README

## Overview

This is a **small, isolated, and disposable** MCP tool for testing the sampling functionality of the Model Context Protocol (MCP). It allows you to send prompts to an LLM agent and receive responses through the MCP sampling API.

## Purpose

- Test the MCP sampling API (`sampling/createMessage`)
- Pass prompts to an LLM agent executing the tool
- Verify that sampling works correctly in your MCP setup
- Isolated and self-contained for easy deletion

## Files

This test tool consists of only **two files**:

1. `test-sampling-tool.ts` - The tool implementation
2. `TEST_SAMPLING_README.md` - This documentation file

## Integration

The tool is integrated into the MCP server in `mcp/server-factory.ts`:

```typescript
// Import (line ~17)
import { createTestSamplingTool } from "../tools/test-sampling-tool.js";

// Create instance (line ~400)
const testSamplingTool = createTestSamplingTool(server);

// Register in tool list (line ~585)
...testSamplingTool.getToolDefinitions(),

// Register handler (line ~635)
if (testSamplingTool.canHandle(name)) {
  return await testSamplingTool.handle(name, toolArgs);
}
```

## Usage

### Tool Name
`test_sampling`

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `prompt` | string | Yes | The prompt to send to the LLM agent |
| `max_tokens` | number | No | Maximum tokens for response (default: 1000) |
| `system_prompt` | string | No | Optional system prompt to guide agent behavior |

### Example Usage

```typescript
// Basic usage
{
  "tool": "test_sampling",
  "arguments": {
    "prompt": "What is 2 + 2? Please explain your reasoning."
  }
}

// With max tokens
{
  "tool": "test_sampling",
  "arguments": {
    "prompt": "Write a short poem about coding",
    "max_tokens": 500
  }
}

// With system prompt
{
  "tool": "test_sampling",
  "arguments": {
    "prompt": "Explain quantum computing",
    "max_tokens": 800,
    "system_prompt": "You are a physics professor. Explain concepts clearly and concisely."
  }
}
```

### Response Format

```json
{
  "success": true,
  "sampling_result": "The LLM's response text here...",
  "metadata": {
    "prompt_length": 45,
    "response_length": 234,
    "max_tokens": 1000,
    "system_prompt_provided": false
  }
}
```

### Error Response

```json
{
  "success": false,
  "error": "Error message here",
  "error_details": { ... }
}
```

## How to Delete This Tool

When you're done testing, you can easily remove this tool by following these steps:

### 1. Delete the tool files
```bash
rm /root/projects/project-flows/mcp/src/tools/test-sampling-tool.ts
rm /root/projects/project-flows/mcp/src/tools/TEST_SAMPLING_README.md
```

### 2. Remove integration from `mcp/src/mcp/server-factory.ts`

Remove the import (line ~17):
```typescript
import { createTestSamplingTool } from "../tools/test-sampling-tool.js";
```

Remove the instance creation (line ~400):
```typescript
const testSamplingTool = createTestSamplingTool(server);
```

Remove from tool list (line ~585):
```typescript
...testSamplingTool.getToolDefinitions(),
```

Remove the handler (line ~635):
```typescript
if (testSamplingTool.canHandle(name)) {
  return await testSamplingTool.handle(name, toolArgs);
}
```

### 3. Rebuild
```bash
cd /root/projects/project-flows/mcp
npm run build
```

### 4. Delete compiled files (optional)
```bash
rm /root/projects/project-flows/mcp/dist/tools/test-sampling-tool.js
rm /root/projects/project-flows/mcp/dist/tools/test-sampling-tool.d.ts
```

## Technical Details

### Sampling API

The tool uses the MCP sampling API:

```typescript
const response = await this.server.request({
  method: 'sampling/createMessage',
  params: {
    messages: [
      {
        role: "user",
        content: {
          type: "text",
          text: prompt
        }
      }
    ],
    maxTokens: maxTokens,
    systemPrompt: systemPrompt  // optional
  }
});
```

### Key Features

- **Isolated**: No dependencies on other tools or business logic
- **Self-contained**: All code in a single file
- **Easy to delete**: Only 2 files, minimal integration points
- **Well-documented**: Clear comments and this README
- **Error handling**: Graceful failure with detailed error messages
- **Logging**: Console logs for debugging

### Limitations

- Sampling may not work with SSE transport (MCP issue #907)
- Requires MCP client to support sampling capability
- Requires server instance to be passed to the tool

## References

- [MCP Sampling Specification](https://modelcontextprotocol.io/specification/2025-06-18/client/sampling)
- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)
- [Workflow Executor Implementation](./workflow-executor.ts) - Example of sampling usage

## License

This is test code. Use and modify freely.

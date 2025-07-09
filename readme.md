# MCP Markdown Script Generator

A TypeScript MCP (Model Context Protocol) server that generates structured markdown scripts based on flexible block configurations. This server allows you to create markdown documents with dynamic sections and LLM content generation instructions.

## Features

- **Flexible Block Structure**: Define custom sections with any header names
- **LLM Integration Ready**: Each block includes instructions for content generation
- **Stage Management**: Track document stages (Draft, Review, Final, etc.)
- **Header Level Control**: Customize markdown header hierarchy
- **Default Templates**: Quick start with predefined common sections

## Installation

```bash
npm install
npm run build
```

## Usage

### Basic Structure

The server expects a structure like this:

```typescript
{
  title: "Your Document Title",
  stage: "Draft",
  blocks: [
    { "Prompt": "improved user prompt instruction" },
    { "Notes": "reasoning investigation instruction" },
    { "Items": "list creation instruction" }
  ]
}
```

### Available Tools

#### 1. `generate_markdown_script`

Generates markdown from your custom structure.

**Parameters:**
- `script`: Object containing title, stage, and blocks array
- `headerLevel` (optional): Starting header level (default: 1)

**Example:**

```json
{
  "script": {
    "title": "API Integration Planning",
    "stage": "Draft",
    "blocks": [
      {
        "Prompt": "Create a detailed plan for integrating the payment API"
      },
      {
        "Requirements Analysis": "Analyze technical requirements and constraints"
      },
      {
        "Implementation Steps": "Break down the integration into actionable steps"
      },
      {
        "Testing Strategy": "Define comprehensive testing approach"
      }
    ]
  },
  "headerLevel": 1
}
```

#### 2. `create_default_script`

Creates a template with common sections.

**Parameters:**
- `title` (optional): Custom title (default: "Generated Script")
- `includeOptionalSections` (optional): Add References and Conclusion sections

**Example:**

```json
{
  "title": "My New Project",
  "includeOptionalSections": true
}
```

### Generated Output Example

```markdown
# API Integration Planning

**Stage:** Draft

---

## Prompt

> **LLM Instruction:** Create a detailed plan for integrating the payment API

<!-- Generated content for Prompt will appear here -->

---

## Requirements Analysis

> **LLM Instruction:** Analyze technical requirements and constraints

<!-- Generated content for Requirements Analysis will appear here -->

---

## Implementation Steps

> **LLM Instruction:** Break down the integration into actionable steps

<!-- Generated content for Implementation Steps will appear here -->

---

## Testing Strategy

> **LLM Instruction:** Define comprehensive testing approach

<!-- Generated content for Testing Strategy will appear here -->

---
```

## Running the Server

### Development Mode

```bash
npm run dev
```

### Production Mode

```bash
npm run build
npm start
```

### Testing

```bash
npm test
```

## MCP Client Configuration

Add this server to your MCP client configuration:

```json
{
  "mcpServers": {
    "markdown-script-generator": {
      "command": "node",
      "args": ["path/to/dist/index.js"]
    }
  }
}
```

## Advanced Usage

### Custom Block Types

You can create any type of block with custom headers:

```typescript
{
  title: "Research Document",
  stage: "Review",
  blocks: [
    { "Executive Summary": "Provide a high-level overview of findings" },
    { "Methodology": "Explain the research approach and methods used" },
    { "Key Findings": "List the most important discoveries" },
    { "Recommendations": "Suggest actionable next steps" },
    { "Appendix": "Include supporting data and references" }
  ]
}
```

### Multiple Sections in One Block

```typescript
{
  blocks: [
    {
      "Problem Statement": "Define the core issue to be addressed",
      "Success Criteria": "Establish measurable goals for success"
    }
  ]
}
```

### Nested Header Levels

Control the header hierarchy:

```typescript
// This will start with ## headers (level 2)
{
  "script": { /* your structure */ },
  "headerLevel": 2
}
```

## File Structure

```
mcp-markdown-script-generator/
├── src/
│   └── index.ts              # Main server implementation
├── dist/                     # Compiled JavaScript output
├── package.json              # Dependencies and scripts
├── tsconfig.json            # TypeScript configuration
└── README.md                # This file
```

## Error Handling

The server includes comprehensive error handling for:
- Invalid script structures
- Missing required fields
- Tool execution errors
- Type validation failures

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT License - see LICENSE file for details.

## Support

For issues and questions:
- Check the error messages in the MCP client
- Review the tool schemas for required parameters
- Ensure your script structure matches the expected format

## Changelog

### v1.0.0
- Initial release
- Basic markdown script generation
- Default template creation
- Flexible block structure support
- LLM instruction integration
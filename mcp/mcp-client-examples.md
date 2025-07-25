# MCP Client Examples

This document contains example MCP client configurations for different clients.

## Claude Code

```bash
claude mcp add --transport sse project-flows http://localhost:3001/sse --header "X-MCP-Client: claude-code"
```

## Windsurf

```json
{
  "mcpServers": {
    "project-flows": {
      "serverUrl": "http://localhost:3001/sse",
      "headers": {
        "X-MCP-Client": "windsurf"
      }
    }
  }
}
```

## Gemini CLI

```json
{
  "mcpServers": {
    "project-flows": {
      "url": "http://localhost:3001/sse?clientId=gemini-cli"
    }
  }
}
```

## Claude Desktop

```json
{
  "mcpServers": {
    "project-flows": {
      "command": "node",
      "args": ["/path/to/project-flows/mcp/dist/index.js"],
      "env": {
        "MCP_CLIENT_ID": "claude-desktop"
      }
    }
  }
}
```

## Cursor

```json
{
  "mcpServers": {
    "project-flows": {
      "serverUrl": "http://localhost:3001/sse?clientId=cursor"
    }
  }
}
```

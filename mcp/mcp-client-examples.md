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


## Claude Desktop

```json
{
  "mcpServers": {
    "project-flows": {
      "command": "npx",
      "args": [
        "mcp-remote",
        "http://localhost:3001/sse?clientId=claude-desktop"
      ]
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

## Gemini CLI (not working properly evry comand will try to use tools)

```json
{
  "mcpServers": {
    "project-flows": {
      "url": "http://localhost:3001/sse?clientId=gemini-cli"
    }
  }
}
```
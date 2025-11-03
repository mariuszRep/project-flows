# MCP Client Examples

This document contains example MCP client configurations for different clients.

**Transport:** Streamable HTTP (protocol version 2025-06-18)
**Endpoint:** `http://localhost:3001/mcp`

## Claude Code

```bash
claude mcp add --transport http project-flows http://localhost:3001/mcp --header "X-MCP-Client: claude-code"
```

## Windsurf

```json
{
  "mcpServers": {
    "project-flows": {
      "serverUrl": "http://localhost:3001/mcp",
      "headers": {
        "X-MCP-Client": "windsurf"
      }
    }
  }
}
```

Alternative with query parameter:
```json
{
  "mcpServers": {
    "project-flows": {
      "serverUrl": "http://localhost:3001/mcp?client=windsurf"
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
        "http://localhost:3001/mcp?client=claude-desktop"
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
      "serverUrl": "http://localhost:3001/mcp?client=cursor"
    }
  }
}
```

## Gemini CLI

```json
{
  "mcpServers": {
    "project-flows": {
      "url": "http://localhost:3001/mcp?client=gemini-cli"
    }
  }
}
```

## Key Changes from SSE Transport

- **Endpoint**: Changed from `/sse` to `/mcp`
- **Transport**: Streamable HTTP instead of SSE (HTTP+SSE)
- **Session Management**: Automatic via `Mcp-Session-Id` headers (no manual sessionId query params)
- **Methods**: Single endpoint handles GET (streaming), POST (requests), DELETE (session termination)
- **Resumability**: Built-in connection resumption via event store
- **Reconnection**: SDK handles exponential backoff automatically
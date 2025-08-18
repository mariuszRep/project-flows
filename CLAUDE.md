# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Architecture

This is a full-stack MCP (Model Context Protocol) task management system with three main components:

### 1. MCP Server (`/mcp/`)
- **TypeScript MCP server** with SSE transport for real-time multi-client communication
- **PostgreSQL integration** for persistent task storage with audit trails
- **Dynamic schema system** for flexible task properties
- **Express.js server** on port 3001 with CORS support

### 2. React UI (`/ui/`)
- **Vite + React + TypeScript** frontend application
- **Supabase authentication** with protected routes
- **shadcn/ui components** with Tailwind CSS styling
- **MCP client integration** via @modelcontextprotocol/sdk
- **Task board interface** with drag-and-drop functionality

### 3. PostgreSQL Database (`/database/`)
- **Docker-containerized** PostgreSQL with initialization scripts
- **Schema management** with migrations and seed data
- **Audit columns** for tracking client operations

## Development Commands

### Root Level Commands (Makefile)
```bash
# Start entire system with Docker
make up

# Development mode (database only)
make dev

# Build all services
make build

# Run tests
make test

# Clean everything
make clean

# Database backup/restore
make backup
make restore FILE=backup.sql
```

### MCP Server (`/mcp/`)
```bash
# Install dependencies
npm install

# Development with auto-reload
npm run dev

# Build TypeScript
npm run build

# Start compiled server
npm start

# Run integration tests
npm test

# Test with local database
npm run test:db
```

### React UI (`/ui/`)
```bash
# Install dependencies
npm install

# Development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Lint code
npm run lint
```

## Key Implementation Details

### MCP Server Architecture
- **Multi-client SSE support**: Multiple MCP clients can connect simultaneously
- **Session management**: Each client gets isolated MCP server instance
- **Client identification**: Automatic detection via User-Agent or headers for audit trails
- **Dynamic properties**: Schema loaded from database with dependency validation
- **Three core tools**: `create_task`, `update_task`, `get_item`

### UI Architecture
- **Context providers**: SessionContext for session state, MCPContext for MCP client management
- **Open access**: All pages are publicly accessible without authentication
- **Theme support**: Dark/light mode with next-themes
- **State management**: React Query for server state, React Context for app state

### Database Schema
- **tasks table**: Core task metadata with audit columns
- **blocks table**: Dynamic property storage linked to tasks
- **schema_properties table**: Configurable task property definitions
- **Audit trail**: All operations track created_by/updated_by with client identification

## MCP Tools Usage

### create_task
Creates new task with automatic ID generation. Requires Title and Summary, accepts dynamic properties like Research and Items with dependency validation.

### update_task  
Updates existing task by numeric ID. All fields optional except task_id. No dependency validation on updates.

### get_item
Retrieves complete task data by numeric ID. Returns structured markdown format.

## Development Workflow

1. **Database first**: Start with `make dev` to run PostgreSQL locally
2. **MCP server**: Run `cd mcp && npm run dev` for server development
3. **UI development**: Run `cd ui && npm run dev` for frontend work
4. **Full system**: Use `make up` to run everything containerized

## UI Development Guidelines

### Markdown Rendering
- **Always use MarkdownRenderer** for task descriptions and content fields in cards and lists
- **Wrap with prose classes**: Use `prose dark:prose-invert max-w-none` for consistent typography
- **Preserve line clamping**: Apply `line-clamp-N` to parent container, not MarkdownRenderer
- **Compact spacing**: Use `prose-p:mb-0 prose-headings:mb-0 prose-headings:mt-0 prose-lists:mb-0` for tight layouts
- **Example usage**:
  ```tsx
  <div className="line-clamp-3 prose dark:prose-invert max-w-none prose-p:mb-0">
    <MarkdownRenderer content={task.body} />
  </div>
  ```

## Environment Configuration

### Required Environment Variables
- `DATABASE_URL`: PostgreSQL connection string
- `VITE_API_BASE_URL`: MCP server URL (UI only)

### MCP Client Configuration
Server runs on `http://localhost:3001/sse` with optional `?client=` parameter for audit tracking.

## Testing

### MCP Server
- Integration tests in `/mcp/tests/`
- Database tests with containerized PostgreSQL
- Tool validation and schema testing

### UI Testing
- No specific test framework configured
- Manual testing via development server

## Build Process

- **MCP**: TypeScript compilation to `/dist/` with ES modules
- **UI**: Vite build process with optimized bundles
- **Database**: Docker build with automated schema loading
- **Orchestration**: Docker Compose for unified deployment
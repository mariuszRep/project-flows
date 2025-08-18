# Project Flows - MCP Task Management System

A Model Context Protocol (MCP) server for task management with PostgreSQL persistence, released under the MIT License.

## 🚀 Quick Setup Guide

### Prerequisites

- [Docker](https://docs.docker.com/get-docker/) and [Docker Compose](https://docs.docker.com/compose/install/)
- Git (for cloning the repository)

### Installation Steps

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/project-flows.git
   cd project-flows
   ```

2. **Configure environment**
   ```bash
   # Copy example environment file
   cp .env.example .env
   
   # Edit with your preferred settings
   nano .env
   ```

3. **Start the services**
   ```bash
   # Start all services in detached mode
   make up
   # Or alternatively
   docker-compose up -d
   ```

4. **Verify installation**
   ```bash
   # Check all services are running
   make status
   # Or alternatively
   docker-compose ps
   
   # View all service logs
   make logs
   # View specific service logs
   make mcp-logs
   make db-logs
   ```

### Default Configuration

- **MCP Server**: Available at `http://localhost:3000`
- **PostgreSQL**: Available at `localhost:5432`
  - Default database: `mcp_tasks`
  - Default user: `mcp_user`
  - Default password: See `.env` file

### Optional Components

- **Database Admin UI**: 
  ```bash
  # Start Adminer web interface on port 8080
  make admin
  # Or alternatively
  docker-compose --profile admin up -d
  ```

## 🔧 Configuration Options

### Environment Variables

Edit the `.env` file to customize your setup:

```env
# Database Configuration
POSTGRES_DB=mcp_tasks
POSTGRES_USER=mcp_user
POSTGRES_PASSWORD=your_secure_password

# MCP Server Configuration
NODE_ENV=production
DATABASE_URL=postgresql://mcp_user:your_secure_password@postgres:5432/mcp_tasks
```

### Production Deployment

For production environments:

```bash
# Production deployment
make prod

# Or alternatively with custom environment
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

## 🔌 Using the MCP Server

### Client Setup

To connect various AI clients to the MCP server:

#### Claude Code

```bash
claude mcp add --transport sse project-flows http://localhost:3001/sse --header "X-MCP-Client: claude-code"
```

#### Windsurf

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

#### Claude Desktop

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

#### Cursor

```json
{
  "mcpServers": {
    "project-flows": {
      "serverUrl": "http://localhost:3001/sse?clientId=cursor"
    }
  }
}
```

#### Gemini CLI

```json
{
  "mcpServers": {
    "project-flows": {
      "url": "http://localhost:3001/sse?clientId=gemini-cli"
    }
  }
}
```

### Available MCP Tools

The following tools are available through the Model Context Protocol (MCP) interface. These tools are designed for integration with AI agents, UIs, and automated systems.

## Task Management Tools

### `create_task`

**Purpose**: Creates a structured task entity with hierarchical relationships and multiple property blocks.

**Schema**:
```typescript
{
  name: "create_task",
  description: "Create a detailed task plan with markdown formatting, make sure you populate 'Title' and 'Description' and later all the rest of the properties. Use parent_id to create hierarchical tasks (e.g., subtasks under a project).",
  inputSchema: {
    type: "object",
    properties: {
      Title: { type: "string" },
      Description: { type: "string" },
      Research: { type: "string" },
      Items: { type: "string" },
      parent_id: { type: "number" }
      // Additional dynamic properties may be available
    },
    required: ["Title", "Description"]
  }
}
```

**Example Request**:
```json
{
  "name": "create_task",
  "arguments": {
    "Title": "Implement feature X",
    "Description": "Add new functionality to the system",
    "Research": "Technical requirements and constraints",
    "Items": "- Task 1\n- Task 2\n- Task 3",
    "parent_id": 5
  }
}
```

**Response Format**:
```json
{
  "success": true,
  "task_id": 42,
  "type": "task",
  "title": "Implement feature X",
  "description": "Add new functionality to the system",
  "project_id": 5,
  "project_name": "Project Name",
  "template_id": 1,
  "stage": "draft",
  "Research": "Technical requirements and constraints",
  "Items": "- Task 1\n- Task 2\n- Task 3"
}
```

### `update_task`

**Purpose**: Updates an existing task's properties, stage, or hierarchical relationships.

**Schema**:
```typescript
{
  name: "update_task",
  description: "Update an existing task plan by task ID. Provide the task_id and any subset of fields to update. All fields except task_id are optional. To change a task's stage, include the 'stage' parameter with one of these values: 'draft', 'backlog', 'doing', 'review', or 'completed'.",
  inputSchema: {
    type: "object",
    properties: {
      task_id: { type: "number" },
      Title: { type: "string" },
      Description: { type: "string" },
      stage: { type: "string", enum: ["draft", "backlog", "doing", "review", "completed"] },
      parent_id: { type: "number" }
      // Additional dynamic properties may be available
    },
    required: ["task_id"]
  }
}
```

**Example Request**:
```json
{
  "name": "update_task",
  "arguments": {
    "task_id": 42,
    "Title": "Updated feature X",
    "stage": "doing"
  }
}
```

**Response Format**:
```json
{
  "success": true,
  "task_id": 42,
  "message": "Task 42 updated successfully",
  "updated_fields": {
    "Title": "Updated feature X"
  }
}
```

### `get_task`

**Purpose**: Retrieves complete task data including all property blocks.

**Schema**:
```typescript
{
  name: "get_task",
  description: "Retrieve a task by its numeric ID. Returns the complete task data in JSON format.",
  inputSchema: {
    type: "object",
    properties: {
      task_id: { type: "number" }
    },
    required: ["task_id"]
  }
}
```

**Example Request**:
```json
{
  "name": "get_task",
  "arguments": {
    "task_id": 42
  }
}
```

**Response Format**:
```json
{
  "id": 42,
  "stage": "doing",
  "template_id": 1,
  "parent_id": 5,
  "parent_type": "project",
  "parent_name": "Project Name",
  "blocks": {
    "Title": "Implement feature X",
    "Description": "Add new functionality to the system",
    "Research": "Technical requirements and constraints",
    "Items": "- Task 1\n- Task 2\n- Task 3"
  }
}
```

### `list_tasks`

**Purpose**: Lists multiple tasks with filtering capabilities for integration with UIs and dashboards.

**Schema**:
```typescript
{
  name: "list_tasks",
  description: "List all tasks with their ID, Title, Summary, Stage, Type, and Parent. Shows hierarchical relationships. Optionally filter by stage, type, or project.",
  inputSchema: {
    type: "object",
    properties: {
      stage: { type: "string", enum: ["draft", "backlog", "doing", "review", "completed"] },
      project_id: { type: "number" }
    }
  }
}
```

**Example Request**:
```json
{
  "name": "list_tasks",
  "arguments": {
    "stage": "doing",
    "project_id": 5
  }
}
```

**Response Format**:
```json
{
  "tasks": [
    {
      "id": 42,
      "title": "Implement feature X",
      "description": "Add new functionality to the system",
      "stage": "doing",
      "template_id": 1,
      "type": "Task",
      "parent_id": 5,
      "parent_name": "Project Name"
    },
    {
      "id": 43,
      "title": "Fix bug Y",
      "description": "Resolve critical issue",
      "stage": "doing",
      "template_id": 1,
      "type": "Task",
      "parent_id": 5,
      "parent_name": "Project Name"
    }
  ],
  "count": 2,
  "filters": {
    "stage": "doing",
    "project_id": 5,
    "template_id": 1
  }
}
```

### `delete_task`

**Purpose**: Permanently removes a task and all associated data.

**Schema**:
```typescript
{
  name: "delete_task",
  description: "Delete a task by its numeric ID. This permanently removes the task and all its associated data.",
  inputSchema: {
    type: "object",
    properties: {
      task_id: { type: "number" }
    },
    required: ["task_id"]
  }
}
```

**Example Request**:
```json
{
  "name": "delete_task",
  "arguments": {
    "task_id": 42
  }
}
```

**Response Format**:
```json
{
  "success": true,
  "task_id": 42,
  "message": "Task with ID 42 has been successfully deleted."
}
```

## Integration Notes

- All responses are returned as JSON for easy parsing by agents and UIs
- Error responses follow a consistent format with `success: false` and an `error` message
- Task stages follow a workflow progression: draft → backlog → doing → review → completed
- The system supports hierarchical relationships between tasks and projects
- Dynamic properties may be available based on the schema configuration

## 🐛 Troubleshooting

### Common Issues

1. **Port conflicts**
   ```bash
   # Check port usage
   lsof -i :5432
   lsof -i :8080
   
   # Stop conflicting services
   docker-compose down
   ```

2. **Database connection errors**
   ```bash
   # Check database logs
   docker-compose logs postgres
   
   # Test connection
   docker exec -it mcp-postgres psql -U mcp_user -d mcp_tasks
   ```

3. **Reset all data**
   ```bash
   make clean
   make up
   # Or alternatively
   docker-compose down -v
   docker-compose up -d
   ```

### Database Management

```bash
# Create a complete database backup
make backup

# Restore database from backup (to default database)
make restore FILE=backups/backup_20250818_123456.dump

# Restore to a new database (safer option)
make restore FILE=backups/backup_20250818_123456.dump TARGET_DB=new_db_name

# List all available backups
make list-backups

# Connect to database via psql
make db-connect
```

## 🛠️ Development Guide

### Local Development Setup

```bash
# Start only the database for development
make dev

# Install dependencies for local development
make install

# Run MCP server locally
cd mcp
npm run dev
```

### Running Tests

```bash
# Run integration tests
make test
```

### Building Docker Images

```bash
# Build all images
make build

# Build and start fresh (clean, build, up)
make fresh
```

## 📁 Project Structure

```
project-flows/
├── mcp/                    # MCP TypeScript Server
│   ├── src/               # Source code
│   ├── tests/             # Test files
│   ├── Dockerfile         # MCP service container
│   └── package.json       # Node.js dependencies
├── database/              # PostgreSQL Database
│   ├── Dockerfile         # Database container
│   ├── schema.sql         # Database schema
│   └── migrations/        # Database migrations
├── docker-compose.yml     # Unified orchestration
└── .env.example           # Example environment variables
```

## 🔒 Security Considerations

1. **Always change default credentials** in the `.env` file
2. **Use environment variables** for all secrets
3. **Enable SSL/TLS** for database connections in production
4. **Run services as non-root users** (already configured in containers)

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](./LICENSE) file for details.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests: `npm test`
5. Submit a pull request

## 📚 Additional Documentation

- [`/mcp/README.md`](./mcp/README.md) - MCP Server documentation
- [`/database/README.md`](./database/README.md) - Database setup guide

## 📋 Available Make Commands

This project includes a Makefile with helpful commands for development and operations:

```bash
make help      # Show available commands
make build     # Build all Docker images
make up        # Start all services
make down      # Stop all services
make logs      # View service logs
make test      # Run integration tests
make clean     # Clean up containers and volumes
make backup    # Create a complete database backup
make restore   # Restore database from backup
make list-backups # List all available backups
make dev       # Start development environment
make admin     # Start with database admin interface
make status    # Check service status
make db-logs   # View database logs specifically
make mcp-logs  # View MCP server logs specifically
make db-connect # Connect to database
make install   # Install dependencies for local development
make fresh     # Build and start fresh
make prod      # Production deployment
```

## 🆘 Support

For issues and questions:
1. Check the troubleshooting section above
2. Review service logs: `docker-compose logs`
3. Create an issue in the repository
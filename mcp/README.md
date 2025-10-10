# MCP TypeScript Server with PostgreSQL

A TypeScript implementation of the Model Context Protocol (MCP) server with PostgreSQL persistence for task management.

## Features

- **Task Management**: Create, update, and retrieve tasks via MCP protocol
- **PostgreSQL Persistence**: All tasks and schema properties stored in database
- **Dynamic Schema**: Schema properties loaded from JSON configuration
- **Docker Integration**: Complete containerized setup with database
- **Dependency Validation**: Ensures proper task property dependencies

## Quick Start

### Prerequisites

- Docker and Docker Compose
- Node.js 18+ (for development)

### Running with Docker

1. **Start the complete stack:**
   ```bash
   docker-compose up -d
   ```

   This starts:
   - PostgreSQL database
   - MCP TypeScript server
   - Automatic schema loading

2. **Check service status:**
   ```bash
   docker-compose ps
   ```

3. **View logs:**
   ```bash
   docker-compose logs -f mcp-server
   docker-compose logs -f postgres
   ```

### Development Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Start PostgreSQL (from database directory):**
   ```bash
   cd ../database
   docker-compose up -d
   ```

3. **Set environment variables:**
   ```bash
   export DATABASE_URL=postgresql://mcp_user:mcp_password@localhost:5432/mcp_tasks
   ```

4. **Run in development mode:**
   ```bash
   npm run dev
   ```

## API Usage

### Available Tools

Task tools provide first-class operations for tasks. Object tools provide generic retrieval and listing.

#### 1. create_task
Create a new task:

```json
{
  "name": "create_task",
  "arguments": {
    "Title": "Implement user authentication",
    "Description": "Add secure login/logout functionality",
    "Items": "- Set up OAuth config\n- Create login endpoint\n- Add session management",
    "stage": "backlog",
    "related": [{ "id": 2, "object": "project" }]
  }
}
```

#### 2. update_task
Update an existing task:

```json
{
  "name": "update_task",
  "arguments": {
    "task_id": 1,
    "Title": "Enhanced user authentication",
    "stage": "doing"
  }
}
```

#### 3. get_object
Retrieve complete object by ID:

```json
{
  "name": "get_object",
  "arguments": { "object_id": 1 }
}
```

#### 4. list_objects
List objects with optional filters:

```json
{ "name": "list_objects", "arguments": { "template_id": 1 } }
{ "name": "list_objects", "arguments": { "template_id": 1, "stage": "backlog" } }
{ "name": "list_objects", "arguments": { "parent_id": 2 } }
```

#### 5. delete_object
Delete object by ID:

```json
{ "name": "delete_object", "arguments": { "object_id": 1 } }
```

## Database Integration

### Schema Structure

- **schema_properties**: Dynamic property definitions from JSON
- **tasks**: Core task data (ID, title, summary, timestamps)
- **blocks**: Task property blocks with foreign key relationships

### Data Flow

1. **Task Creation**: Inserts into `tasks` table + property `blocks`
2. **Task Updates**: Updates `tasks` + upserts `blocks` for properties
3. **Task Retrieval**: Joins `tasks` with `blocks` to reconstruct complete task

### Persistence Features

- **Automatic ID Generation**: Sequential task IDs via database sequence
- **Cascade Deletion**: Deleting tasks removes all associated blocks
- **UPSERT Operations**: Updates existing properties or creates new ones
- **Transaction Safety**: All multi-table operations use database transactions

## Environment Configuration

### Required Variables

```bash
# Database connection
DATABASE_URL=postgresql://mcp_user:mcp_password@postgres:5432/mcp_tasks

# Individual components (alternative to DATABASE_URL)
POSTGRES_HOST=postgres
POSTGRES_PORT=5432
POSTGRES_DB=mcp_tasks
POSTGRES_USER=mcp_user
POSTGRES_PASSWORD=mcp_password
```

### Production Security

⚠️ **Change default credentials in production:**

```bash
export POSTGRES_PASSWORD=your_secure_password
export DATABASE_URL=postgresql://mcp_user:your_secure_password@postgres:5432/mcp_tasks
```

## Build and Deploy

### Build Process

```bash
npm run build
```

Creates `dist/` directory with compiled JavaScript.

### Docker Build

```bash
docker build -t mcp-server .
```

### Production Deployment

1. **Update environment variables** in `.env` file
2. **Run with production settings:**
   ```bash
   NODE_ENV=production docker-compose up -d
   ```

## Development

### Commands

- `npm run dev` - Development mode with auto-reload
- `npm run build` - Compile TypeScript to JavaScript
- `npm start` - Run compiled application
- `npm run clean` - Remove build artifacts

### Database Operations

- **Reset database:**
  ```bash
  docker-compose down -v
  docker-compose up -d
  ```

- **Run migrations manually:**
  ```bash
  cd ../database
  npm run migrate
  ```

- **Load schema properties:**
  ```bash
  cd ../database
  npm run bootstrap
  ```

## Testing

### Manual Testing

1. **Test database connection:**
   ```bash
   docker exec -it mcp-postgres psql -U mcp_user -d mcp_tasks
   ```

2. **Verify schema properties:**
   ```sql
   SELECT * FROM schema_properties;
   ```

3. **Check task creation:**
   ```sql
   SELECT t.*, b.property_name, b.content 
   FROM tasks t 
   LEFT JOIN blocks b ON t.id = b.task_id 
   ORDER BY t.id;
   ```

### Integration Tests

```bash
# TODO: Add test command when tests are implemented
npm test
```

## Troubleshooting

### Common Issues

1. **Database connection failed:**
   - Check if PostgreSQL container is running
   - Verify DATABASE_URL is correct
   - Ensure network connectivity between containers

2. **Schema properties not loading:**
   - Check `schema_properties.json` exists
   - Verify file permissions
   - Review bootstrap script logs

3. **Task operations failing:**
   - Check database table structure
   - Verify foreign key constraints
   - Review application logs

### Debugging

1. **Enable debug logging:**
   ```bash
   DEBUG=* npm run dev
   ```

2. **Check container logs:**
   ```bash
   docker-compose logs -f mcp-server
   ```

3. **Database query debugging:**
   ```sql
   -- Check recent tasks
   SELECT * FROM tasks ORDER BY created_at DESC LIMIT 10;
   
   -- Check blocks for specific task
   SELECT * FROM blocks WHERE task_id = 1 ORDER BY position;
   ```

## Architecture

### Components

- **src/index.ts**: Main MCP server implementation
- **src/database.ts**: Database service layer
- **schema_properties.json**: Dynamic property definitions
- **Dockerfile**: Container build configuration
- **docker-compose.yml**: Multi-service orchestration

### Dependencies

- **@modelcontextprotocol/sdk**: MCP protocol implementation
- **pg**: PostgreSQL driver
- **tsx**: TypeScript execution for development
- **typescript**: TypeScript compiler

## License

MIT License - see LICENSE file for details.

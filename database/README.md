# MCP Database Setup

This directory contains the PostgreSQL database setup for the MCP (Model Context Protocol) task management system.

## Architecture

The database consists of three main tables:

1. **schema_properties** - Stores dynamic schema properties from `schema_properties.json`
2. **tasks** - Stores task metadata (ID, title, summary, timestamps)
3. **blocks** - Stores task property blocks with foreign key relationships

## Quick Start

### Prerequisites

- Docker and Docker Compose installed
- Node.js (for running migration scripts)

### Setup

1. **Start PostgreSQL database:**
   ```bash
   cd /root/projects/project-flows/database
   docker-compose up -d
   ```

2. **Install dependencies (if running scripts manually):**
   ```bash
   npm install
   ```

3. **Run migrations and bootstrap:**
   ```bash
   npm run setup
   ```

### Using with MCP Service

1. **Start the complete stack:**
   ```bash
   cd /root/projects/project-flows/mcp
   docker-compose up -d
   ```

This will start both PostgreSQL and the MCP service with proper networking.

## Database Schema

### schema_properties Table
```sql
CREATE TABLE schema_properties (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

### tasks Table
```sql
CREATE TABLE tasks (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    summary TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

### blocks Table
```sql
CREATE TABLE blocks (
    id SERIAL PRIMARY KEY,
    task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    property_name TEXT NOT NULL,
    content JSONB NOT NULL,
    position INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(task_id, property_name)
);
```

## Environment Variables

### Database Service (.env)
```
POSTGRES_DB=mcp_tasks
POSTGRES_USER=mcp_user
POSTGRES_PASSWORD=mcp_password
POSTGRES_HOST=postgres
POSTGRES_PORT=5432
DATABASE_URL=postgresql://mcp_user:mcp_password@postgres:5432/mcp_tasks
```

### Production Considerations

⚠️ **Important**: Change default credentials in production:

```bash
# Override in production
export POSTGRES_PASSWORD=your_secure_password
export DATABASE_URL=postgresql://mcp_user:your_secure_password@postgres:5432/mcp_tasks
```

## Scripts

- `npm run migrate` - Run database migrations
- `npm run bootstrap` - Load schema_properties.json into database
- `npm run setup` - Run both migration and bootstrap

## Database Operations

### Task Creation
When a task is created via the MCP API:
1. Task metadata is inserted into `tasks` table
2. Dynamic properties are stored as separate records in `blocks` table
3. Each block has a foreign key reference to its parent task

### Task Updates
- Core fields (title, summary) update the `tasks` table
- Dynamic properties create or update records in `blocks` table
- Uses UPSERT to handle existing vs new properties

### Task Deletion
- Deleting a task cascades to delete all associated blocks
- Maintains referential integrity

## Networking

Docker services communicate via the `mcp-network` bridge:
- PostgreSQL container: `postgres:5432`
- MCP service connects using hostname `postgres`

## Troubleshooting

### Connection Issues

1. **Database not ready:**
   ```bash
   docker-compose logs postgres
   ```

2. **MCP service can't connect:**
   ```bash
   docker-compose logs mcp-server
   ```

3. **Test connection manually:**
   ```bash
   docker exec -it mcp-postgres psql -U mcp_user -d mcp_tasks
   ```

### Data Issues

1. **Reset database:**
   ```bash
   docker-compose down -v
   docker-compose up -d
   ```

2. **Check schema properties:**
   ```sql
   SELECT * FROM schema_properties;
   ```

3. **View tasks and blocks:**
   ```sql
   SELECT t.id, t.title, b.property_name, b.content 
   FROM tasks t 
   LEFT JOIN blocks b ON t.id = b.task_id 
   ORDER BY t.id, b.position;
   ```

## Health Checks

The PostgreSQL container includes health checks:
```bash
docker-compose ps
```

Should show `healthy` status for the postgres service.

## Backup and Recovery

### Backup
```bash
docker exec mcp-postgres pg_dump -U mcp_user mcp_tasks > backup.sql
```

### Restore
```bash
docker exec -i mcp-postgres psql -U mcp_user -d mcp_tasks < backup.sql
```
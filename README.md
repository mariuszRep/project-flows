# Project Flows - MCP Task Management System

A complete Model Context Protocol (MCP) task management system with PostgreSQL persistence and Docker integration.

## 🏗️ Architecture

```
project-flows/
├── mcp/                    # MCP TypeScript Server
│   ├── src/               # Source code
│   ├── Dockerfile         # MCP service container
│   └── package.json       # Node.js dependencies
├── database/              # PostgreSQL Database
│   ├── Dockerfile         # Database container with init scripts
│   ├── schema.sql         # Database schema
│   └── bootstrap.js       # Schema properties loader
└── docker-compose.yml     # Unified orchestration
```

## 🚀 Quick Start

### Prerequisites

- Docker and Docker Compose installed
- Git (for cloning/development)

### One-Command Setup

```bash
# Clone and start the entire system
git clone <repository-url>
cd project-flows
docker-compose up -d
```

### Verify Installation

```bash
# Check all services are running
docker-compose ps

# View logs
docker-compose logs -f mcp-server
docker-compose logs -f postgres
```

## 📋 Services

### 1. PostgreSQL Database (`postgres`)
- **Image**: Custom build with initialization scripts
- **Port**: 5432
- **Features**:
  - Automatic schema creation
  - Schema properties loading
  - Persistent data storage
  - Health checks

### 2. MCP Server (`mcp-server`)
- **Image**: Custom Node.js build
- **Features**:
  - TypeScript compilation
  - Database connectivity
  - MCP protocol implementation
  - Non-root user security

### 3. Database Admin (`db-admin`) - Optional
- **Image**: Adminer web interface
- **Port**: 8080
- **Usage**: `docker-compose --profile admin up -d`

## 🛠️ Development

### Local Development

```bash
# Start only database
docker-compose up -d postgres

# Run MCP server locally
cd mcp
npm install
npm run dev
```

### Building Images

```bash
# Build all images
docker-compose build

# Build specific service
docker-compose build mcp-server
docker-compose build postgres
```

### Testing

```bash
# Run integration tests
cd mcp
npm test

# Test with containerized database
docker-compose up -d postgres
npm run test:db
```

## 🔧 Configuration

### Environment Variables

Create `.env` file in project root:

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

```bash
# Production with custom environment
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

## 📊 Database Schema

### Tables

1. **schema_properties** - Dynamic property definitions
2. **tasks** - Task metadata (ID, title, summary)
3. **blocks** - Task property blocks with relationships

### Data Flow

- **Task Creation**: Insert into `tasks` + property `blocks`
- **Task Updates**: Update `tasks` + upsert `blocks`
- **Task Retrieval**: Join `tasks` with `blocks`
- **Task Deletion**: Cascade delete all related `blocks`

## 🔌 API Usage

### Available MCP Tools

#### create_task
```json
{
  "name": "create_task",
  "arguments": {
    "Title": "Implement feature X",
    "Summary": "Add new functionality to the system",
    "Research": "Technical requirements and constraints",
    "Items": "- Task 1\n- Task 2\n- Task 3"
  }
}
```

#### update_task
```json
{
  "name": "update_task",
  "arguments": {
    "task_id": 1,
    "Title": "Updated title",
    "Research": "Updated research"
  }
}
```

#### get_item
```json
{
  "name": "get_item",
  "arguments": {
    "task_id": 1
  }
}
```

## 📁 Directory Structure

```
project-flows/
├── mcp/
│   ├── src/
│   │   ├── index.ts           # Main MCP server
│   │   └── database.ts        # Database service layer
│   ├── tests/
│   │   └── integration.test.js # Integration tests
│   ├── Dockerfile             # MCP service container
│   ├── package.json           # Dependencies
│   └── schema_properties.json # Dynamic schema config
├── database/
│   ├── Dockerfile             # Database container
│   ├── schema.sql             # Database schema
│   ├── bootstrap.js           # Schema loader
│   ├── migrate.js             # Migration script
│   └── docker-entrypoint.sh   # Custom entrypoint
├── docker-compose.yml         # Main orchestration
└── README.md                  # This file
```

## 🐛 Troubleshooting

### Common Issues

1. **Port conflicts**:
   ```bash
   # Check port usage
   lsof -i :5432
   lsof -i :8080
   
   # Stop conflicting services
   docker-compose down
   ```

2. **Database connection errors**:
   ```bash
   # Check database logs
   docker-compose logs postgres
   
   # Test connection
   docker exec -it mcp-postgres psql -U mcp_user -d mcp_tasks
   ```

3. **Schema not loading**:
   ```bash
   # Check bootstrap logs
   docker-compose logs postgres | grep bootstrap
   
   # Manually run bootstrap
   docker exec -it mcp-postgres node /app/bootstrap.js
   ```

### Health Checks

```bash
# Check service health
docker-compose ps

# Manual health check
curl -f http://localhost:8080 || echo "Adminer not accessible"
```

### Data Management

```bash
# Backup database
docker exec mcp-postgres pg_dump -U mcp_user mcp_tasks > backup.sql

# Restore database
docker exec -i mcp-postgres psql -U mcp_user -d mcp_tasks < backup.sql

# Reset all data
docker-compose down -v
docker-compose up -d
```

## 🔒 Security

### Production Considerations

1. **Change default credentials**
2. **Use environment variables for secrets**
3. **Enable SSL/TLS for database connections**
4. **Run services as non-root users**
5. **Implement proper network isolation**

### Security Features

- Non-root user in MCP container
- Health checks for service monitoring
- Secrets management via environment variables
- Network isolation via Docker networks

## 📚 Documentation

- [`/mcp/README.md`](./mcp/README.md) - MCP Server documentation
- [`/database/README.md`](./database/README.md) - Database setup guide
- [`/mcp/tests/`](./mcp/tests/) - Integration test examples

## 🤝 Contributing

1. Fork the repository
2. Create feature branch
3. Make changes
4. Run tests: `npm test`
5. Submit pull request

## 📄 License

MIT License - see LICENSE file for details.

## 🆘 Support

For issues and questions:
1. Check the troubleshooting section
2. Review service logs: `docker-compose logs`
3. Create an issue in the repository
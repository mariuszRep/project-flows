# Database Backup and Restore

This directory contains scripts for backing up and restoring the PostgreSQL database used by Project Flows.

## Prerequisites

- PostgreSQL client tools (`pg_dump` and `pg_restore`) must be installed on the system
- Node.js environment
- Database connection details (in `.env` file or environment variables)

## Backup

The backup script creates a complete backup of the PostgreSQL database, including schema, data, and all relationships.

### Quick Backup

To create a backup with default settings:

```bash
npm run backup:trigger
```

This will create a backup in the `./backups` directory using the custom format with compression level 5.

### Advanced Backup Options

For more control over the backup process:

```bash
npm run backup -- [options]
```

Or directly:

```bash
node backup.js [options]
```

Available options:

- `--output-dir=<path>` - Directory to store backups (default: ./backups)
- `--format=<format>` - Backup format: plain, custom, directory, tar (default: custom)
- `--compress=<level>` - Compression level 0-9 (default: 5)
- `--no-owner` - Exclude commands to set object ownership
- `--verbose` - Show detailed progress information

Example:

```bash
node backup.js --output-dir=/backup/postgres --format=plain --verbose
```

## Restore

To restore a database from a backup file:

```bash
npm run restore -- <backup-file> [options]
```

Or directly:

```bash
node restore.js <backup-file> [options]
```

Available options:

- `--clean` - Clean (drop) database objects before recreating
- `--create` - Create the database before restoring
- `--no-owner` - Skip restoration of object ownership
- `--verbose` - Show detailed progress information

Example:

```bash
node restore.js ./backups/mcp_tasks_backup_2025-08-15T13-45-30-000Z.dump --clean --verbose
```

## Scheduling Backups

### Using Cron (Linux/macOS)

To schedule regular backups using cron, add a line to your crontab:

```bash
# Edit crontab
crontab -e

# Add a line to run backup daily at 2 AM
0 2 * * * cd /path/to/project-flows/database && node backup-trigger.js >> /path/to/backup.log 2>&1
```

### Using Docker

If running in Docker, you can modify the docker-compose.yml to include a backup service:

```yaml
services:
  # ... other services
  
  db-backup:
    build: ./database
    volumes:
      - ./backups:/app/backups
    environment:
      - DATABASE_URL=postgresql://mcp_user:mcp_password@postgres:5432/mcp_tasks
    command: ["node", "backup-trigger.js"]
    depends_on:
      - postgres
```

Then run the backup manually with:

```bash
docker-compose run db-backup
```

## Backup File Management

The backup script creates two files for each backup:

1. The actual backup file (`.dump` or `.sql` depending on format)
2. A JSON metadata file with information about the backup

You can implement a rotation policy to manage backup files, for example:
- Keep daily backups for the last week
- Keep weekly backups for the last month
- Keep monthly backups for the last year

## Troubleshooting

If you encounter issues:

1. Check database connection details in your `.env` file
2. Ensure PostgreSQL client tools are installed and in your PATH
3. Verify that the database user has sufficient permissions
4. Check the console output for specific error messages

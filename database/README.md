# Database Setup and Management

This directory contains all database-related files for the project-flows MCP system.

## Quick Start

### Initialize Fresh Database
```bash
# From project root
make init-fresh

# Or from database directory
cd database && ./init-fresh.sh
```

### Backup Current Database
```bash
# From project root
make backup

# Or from database directory
cd database && ./backup-fresh.sh
```

### Restore from Backup
```bash
# From project root
make restore FILE=database/backups/full_backup_20250109_120000.dump

# Or from database directory
cd database && ./restore-fresh.sh backups/full_backup_20250109_120000.dump
```

---

## Files Overview

### Core Schema Files

#### `schema.sql`
Complete database schema including:
- **5 Tables:** objects, object_properties, templates, template_properties, global_state
- **2 Functions:** `update_updated_at_column()`, `notify_data_change()` (for real-time SSE)
- **5 Triggers:** Auto-update timestamps, data change notifications
- **6 Indexes:** Performance optimization
- **Constraints:** Primary keys, foreign keys, unique constraints
- **Types:** task_stage enum (draft, backlog, doing, review, completed)

#### `seed.sql`
Essential seed data including:
- **4 Templates:** Task, Project, Epic, Rule
- **10 Template Properties:** With validation rules and prompts
- **4 Sequence Values:** For auto-increment IDs

---

## Shell Scripts

### `init-fresh.sh` - Fresh Database Initialization
Initializes a completely fresh database from scratch.

**What it does:**
1. Drops existing database (if exists)
2. Creates new empty database
3. Applies schema from `schema.sql`
4. Loads seed data from `seed.sql`
5. Verifies installation (counts tables, functions, triggers)

**Usage:**
```bash
./init-fresh.sh
# or
make init-fresh
```

**Output:**
```
🔧 Initialize Fresh Database
========================================
Creating fresh database...
✅ Database created
Applying schema from schema.sql...
✅ Schema applied
Loading seed data from seed.sql...
✅ Seed data loaded

Verifying database setup...
  📊 Tables: 5
  ⚙️  Functions: 2
  🔔 Triggers: 5
  📋 Templates: 4
  🏷️  Properties: 10

🎉 Fresh database initialized successfully!
```

---

### `backup-fresh.sh` - Comprehensive Backup
Creates comprehensive backups in multiple formats.

**What it creates:**
- `.dump` - Compressed binary format (recommended for restore) - ~112KB
- `.sql` - Plain SQL for human inspection - ~335KB
- `schema_*.sql` - Schema only (structure) - ~14KB
- `data_*.sql` - Data only (inserts) - ~346KB

**Usage:**
```bash
./backup-fresh.sh
# or
make backup
```

**Output:**
```
📦 Database Backup Script
========================================
✅ Compressed dump: backups/full_backup_20251009_110746.dump
✅ SQL dump: backups/full_backup_20251009_110746.sql
✅ Schema dump: backups/schema_backup_20251009_110746.sql
✅ Data dump: backups/data_backup_20251009_110746.sql

🎉 Backup completed successfully!
```

---

### `backup-minimal.sh` - Minimal Backup
Creates only the essential `.dump` file (75% space savings).

**Usage:**
```bash
./backup-minimal.sh
```

---

### `restore-fresh.sh` - Safe Database Restore
Restores database from backup with safety checks.

**Features:**
- Supports both `.dump` and `.sql` formats
- Interactive confirmation for production database
- Can restore to different database name for testing
- Lists available backups if FILE not specified

**Usage:**
```bash
# Restore to production (requires "yes" confirmation)
./restore-fresh.sh backups/full_backup_20251009_110746.dump

# Restore to test database (no confirmation)
./restore-fresh.sh backups/full_backup_20251009_110746.dump mcp_tasks_test

# From project root
make restore FILE=database/backups/full_backup_20251009_110746.dump
make restore FILE=database/backups/backup.dump TARGET_DB=test_db
```

**Output:**
```
🔄 Database Restore Script
========================================
⚠️  WARNING: You are about to restore to the main database 'mcp_tasks'
   This will DELETE all current data!

Are you sure you want to continue? (yes/no): yes

Restoring from backups/full_backup_20251009_110746.dump...

🎉 Database restored successfully!
```

---

### `extract-schema.sh` - Extract Schema from Database
Extracts current database structure to `schema.sql`.

**What it extracts:**
- All tables with structure
- All functions (including triggers)
- All triggers
- All indexes
- All constraints

**Usage:**
```bash
./extract-schema.sh
# or
make extract-schema
```

**When to use:**
- After adding new triggers/functions via migrations
- After database schema changes
- Before committing schema updates to git

**Output:**
```
📋 Extract Schema from Database
========================================
✅ Schema extracted successfully!
File: schema.sql
Size: 16K

Contents:
  📊 Tables: 5
  ⚙️  Functions: 2
  🔔 Triggers: 5
  🔍 Indexes: 6
```

---

### `extract-seed.sh` - Extract Seed Data from Database
Extracts templates and properties to `seed.sql`.

**What it extracts:**
- Templates table (4 rows)
- Template_properties table (10 rows)
- Sequence values (current IDs)

**Usage:**
```bash
./extract-seed.sh
# or
make regenerate-seed
```

**When to use:**
- After adding new templates via UI/MCP
- After modifying template properties
- Before committing seed updates to git

**Output:**
```
🌱 Extract Seed Data from Database
========================================
✅ Templates exported: 4 rows
✅ Template properties exported: 10 rows

🎉 Seed data extracted successfully!
File: seed.sql
Size: 16K

Contents:
  📋 Templates: 4 rows
  🏷️  Properties: 10 rows
  🔢 Sequences: 4 values
```

---

## Makefile Commands

From project root, you can use these convenient commands:

### Database Operations
```bash
make backup              # Create comprehensive backup (4 files)
make restore FILE=...    # Restore with safety checks
make list-backups        # List available backups
make init-fresh          # Initialize fresh database
make regenerate-seed     # Extract seed.sql from database
make extract-schema      # Extract schema.sql from database
make extract-all         # Extract both schema and seed
```

### Docker Operations
```bash
make build              # Build all Docker images
make up                 # Start all services
make down               # Stop all services
make dev                # Start database only (development)
make clean              # Clean up containers and volumes
```

### Monitoring
```bash
make status             # Check service status
make logs               # View all logs
make db-logs            # View database logs
make mcp-logs           # View MCP server logs
make db-connect         # Connect to database via psql
```

---

## Directory Structure

```
database/
├── backups/                      # Database backups (ignored by git)
│   ├── full_backup_*.dump        # Compressed backups
│   ├── full_backup_*.sql         # Plain SQL backups
│   ├── schema_backup_*.sql       # Schema-only backups
│   └── data_backup_*.sql         # Data-only backups
│
├── archive/                      # Obsolete scripts (ignored by git)
│   ├── migrate.js                # Old migration script
│   ├── run_migration.js          # Old migration runner
│   └── generate-seed.js          # Old Node.js seed generator
│
├── backup-fresh.sh               # Comprehensive backup (4 files)
├── backup-minimal.sh             # Minimal backup (.dump only)
├── restore-fresh.sh              # Safe restore with confirmations
├── init-fresh.sh                 # Fresh database initialization
├── extract-schema.sh             # Extract schema.sql
├── extract-seed.sh               # Extract seed.sql
│
├── schema.sql                    # Database structure (commit this)
├── seed.sql                      # Seed data (commit this)
├── Dockerfile                    # PostgreSQL container config
├── package.json                  # Node dependencies (minimal)
└── *.md                          # Documentation
```

---

## Database Schema Details

### Tables (5)

#### `templates`
Defines object templates (Task, Project, Epic, Rule)
- `id`, `name`, `description`
- Audit columns: `created_at`, `updated_at`, `created_by`, `updated_by`

#### `template_properties`
Defines properties for each template
- `id`, `template_id`, `key`, `type`, `description`
- `dependencies` - Array of dependent property keys
- `execution_order` - Order of execution
- `fixed` - Whether property is immutable

#### `objects`
Stores task/project/epic/rule instances
- `id`, `template_id`, `parent_id`, `user_id`
- `stage` - ENUM: draft, backlog, doing, review, completed
- Self-referential foreign key for hierarchy

#### `object_properties`
Stores property values for objects
- `id`, `task_id`, `property_id`, `content`, `position`

#### `global_state`
Stores application-wide state
- `key`, `value` (JSONB)
- Example: `selected_project_id`

### Functions (2)

#### `update_updated_at_column()`
Trigger function that automatically updates `updated_at` timestamp.

**Attached to:** All tables via `BEFORE UPDATE` triggers

#### `notify_data_change()` ⭐ CRITICAL
Trigger function that sends PostgreSQL notifications when objects are modified.

**What it does:**
- Fires on INSERT, UPDATE, DELETE on `objects` table
- Sends JSON payload via `pg_notify('data_changed', ...)`
- Enables real-time SSE notifications to MCP clients

**Without this function, real-time updates won't work!**

**Attached to:** `objects` table via `objects_notify_change` trigger

### Triggers (5)

| Trigger | Table | Event | Function |
|---------|-------|-------|----------|
| `objects_notify_change` ⭐ | objects | INSERT/UPDATE/DELETE | `notify_data_change()` |
| `update_tasks_updated_at` | objects | UPDATE | `update_updated_at_column()` |
| `update_blocks_updated_at` | object_properties | UPDATE | `update_updated_at_column()` |
| `update_properties_updated_at` | template_properties | UPDATE | `update_updated_at_column()` |
| `update_global_state_updated_at` | global_state | UPDATE | `update_updated_at_column()` |

---

## Common Workflows

### 1. First Time Setup
```bash
git clone <repo>
cd project-flows
make dev                # Start postgres
make init-fresh         # Initialize database
cd mcp && npm run dev   # Start MCP server
```

### 2. Daily Backup
```bash
make backup
# Creates 4 files in database/backups/
```

### 3. Update Database Structure
```bash
# After making changes via UI/MCP:
make extract-all

# Verify changes:
git diff database/schema.sql
git diff database/seed.sql

# Commit:
git add database/schema.sql database/seed.sql
git commit -m "Update database structure"
```

### 4. Disaster Recovery
```bash
make list-backups
make restore FILE=database/backups/full_backup_20251009_110746.dump
# Type "yes" to confirm
```

### 5. Test with Production Data
```bash
make restore FILE=database/backups/prod.dump TARGET_DB=test_db
# Creates separate test database with production data
```

### 6. Reset Development Environment
```bash
make init-fresh
# Back to clean slate with just templates
```

---

## What's Included in Backups

### All Backup Formats Include:
- ✅ **Tables** - Structure and data
- ✅ **Functions** - Both trigger functions
- ✅ **Triggers** - All 5 triggers (including critical `objects_notify_change`)
- ✅ **Indexes** - All 6 indexes
- ✅ **Constraints** - Primary keys, foreign keys, unique constraints
- ✅ **Types** - task_stage enum
- ✅ **Sequences** - Current sequence values
- ✅ **Data** - All production data (944+ objects in production)
- ✅ **Comments** - Documentation on functions/triggers

### Restore = 100% Functional Database
After restore, everything works immediately:
- ✅ Real-time notifications working
- ✅ Auto-timestamps working
- ✅ All data intact
- ✅ No manual setup needed

---

## Important Notes

### 1. Real-time Notifications Depend on Triggers
The `notify_data_change()` function and `objects_notify_change` trigger are **critical** for SSE notifications. Without them, MCP clients won't receive live updates!

Both are included in:
- ✅ `schema.sql`
- ✅ All backup files
- ✅ Fresh initialization via `init-fresh.sh`

### 2. Backup Location
All backups go to `database/backups/` which is **ignored by git**.

**Why ignored:**
- Contains production data
- Large files (hundreds of KB)
- Can be regenerated with `make backup`

### 3. Archive Directory
The `archive/` directory contains obsolete scripts that have been replaced by shell scripts. It's **ignored by git** and kept for local reference only.

### 4. Sequence Values
Always restore sequence values when loading seed data to avoid ID conflicts. The `extract-seed.sh` script automatically includes current sequence values.

---

## Troubleshooting

### "Container not running"
```bash
docker-compose up -d postgres
sleep 5  # Wait for startup
```

### "Database already exists"
```bash
make init-fresh  # Will drop and recreate
```

### "Permission denied" on scripts
```bash
chmod +x database/*.sh
```

### Missing triggers/functions after restore
Ensure you're using the latest `schema.sql` which includes:
- `notify_data_change()` function
- `objects_notify_change` trigger

Run `make init-fresh` to ensure everything is properly set up.

### Backup files too large for git
Backups are intentionally ignored by git. Use:
- Cloud storage (S3, Google Cloud)
- External backup service
- Automated backup cron jobs

---

## Best Practices

### What to Commit to Git
- ✅ `schema.sql` - Always keep updated
- ✅ `seed.sql` - Essential templates and properties
- ✅ All `.sh` scripts
- ✅ `Dockerfile`, `package.json`
- ✅ Documentation (`.md` files)

### What NOT to Commit
- ❌ `backups/` directory - Production data
- ❌ `archive/` directory - Obsolete scripts
- ❌ Production database exports
- ❌ Temporary backup files

### Backup Strategy
1. **Daily automated backups:**
   ```bash
   # Cron job: Daily at 2 AM
   0 2 * * * cd /path/to/project-flows && make backup
   ```

2. **Before major changes:**
   ```bash
   make backup
   # Make changes
   # Test
   # If bad: make restore FILE=backup.dump
   ```

3. **Cloud backup storage:**
   ```bash
   # Upload to S3/Google Cloud
   aws s3 sync database/backups/ s3://my-backup-bucket/
   ```

---

## Docker Integration

### Dockerfile
The database Dockerfile is simple and uses PostgreSQL's built-in initialization:

```dockerfile
FROM postgres:15

# Copy initialization scripts
COPY schema.sql /docker-entrypoint-initdb.d/01-schema.sql
COPY seed.sql /docker-entrypoint-initdb.d/02-seed.sql

# Set environment variables
ENV POSTGRES_DB=mcp_tasks
ENV POSTGRES_USER=mcp_user
ENV POSTGRES_PASSWORD=mcp_password
```

**On first container start:**
1. PostgreSQL automatically executes files in `/docker-entrypoint-initdb.d/`
2. `01-schema.sql` creates structure
3. `02-seed.sql` loads initial data
4. Database ready!

**No Node.js needed in container!** All maintenance operations use shell scripts on the host.

---

## Migration from Node.js Scripts

Previous setup used Node.js scripts (`generate-seed.js`, `migrate.js`). These have been replaced with pure shell scripts:

| Old (Node.js) | New (Shell) |
|---------------|-------------|
| `generate-seed.js` | `extract-seed.sh` |
| ❌ No schema extraction | `extract-schema.sh` |
| `migrate.js` | `init-fresh.sh` |
| Node.js + pg module required | No dependencies |

**Benefits:**
- ✅ No Node.js dependency for database operations
- ✅ Schema extraction now available
- ✅ Faster execution (uses native `pg_dump`)
- ✅ Simpler codebase (all shell scripts)

Archived scripts are in `database/archive/` for reference.

---

## Additional Documentation

- **CHANGES.md** - Change log with fixes and migrations
- **BACKUP_CONTENTS.md** - Detailed backup contents
- **SCRIPTS_COMPARISON.md** - init-fresh vs restore-fresh
- **SHELL_SCRIPTS_MIGRATION.md** - Node.js to Shell migration
- **DOCKERFILE_SIMPLIFIED.md** - Dockerfile changes
- **MAKEFILE_UPDATED.md** - Makefile alignment
- **COMPLETE_SUMMARY.md** - Comprehensive summary

---

## Support

For issues or questions:
1. Check this README
2. Check specific documentation files (*.md)
3. Run `make help` for available commands
4. Verify container is running: `make status`
5. Check logs: `make db-logs`

---

## Summary

This database setup provides:
- ✅ **Complete Schema** - All tables, functions, triggers
- ✅ **Easy Initialization** - One command fresh setup
- ✅ **Comprehensive Backups** - Multiple formats
- ✅ **Safe Operations** - Confirmations and checks
- ✅ **Shell-Based** - No Node.js for DB operations
- ✅ **Well-Documented** - Extensive documentation
- ✅ **Git-Friendly** - Only essential files tracked
- ✅ **Production-Ready** - Tested and reliable

**Everything you need for database management! 🎉**

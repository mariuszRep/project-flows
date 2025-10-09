# Database Folder Structure

This document describes the reorganized database directory structure.

## Directory Layout

```
database/
├── init/                         # Database initialization files
│   ├── schema.sql                # Database structure (tables, functions, triggers)
│   └── seed.sql                  # Seed data (templates, properties)
│
├── scripts/                      # Database maintenance scripts
│   ├── backup-fresh.sh           # Create comprehensive backup
│   ├── backup-minimal.sh         # Create minimal backup (.dump only)
│   ├── restore-fresh.sh          # Restore from backup
│   ├── init-fresh.sh             # Initialize fresh database
│   ├── extract-schema.sh         # Extract schema.sql from database
│   ├── extract-seed.sh           # Extract seed.sql from database
│   └── test-setup.sh             # Test setup (separate container)
│
├── backups/                      # Database backups (ignored by git)
│   ├── full_backup_*.dump        # Compressed backups
│   ├── full_backup_*.sql         # Plain SQL backups
│   ├── schema_backup_*.sql       # Schema-only backups
│   └── data_backup_*.sql         # Data-only backups
│
├── Dockerfile                    # PostgreSQL container config
├── README.md                     # Main documentation
└── package.json                  # Minimal Node dependencies
```

## Purpose of Each Directory

### `/init/` - Initialization Files

**Purpose**: Contains SQL files used for Docker container initialization and fresh database setup.

**Files**:
- `schema.sql` - Complete database structure
  - 5 tables (objects, object_properties, templates, template_properties, global_state)
  - 2 functions (update_updated_at_column, notify_data_change)
  - 5 triggers (including critical objects_notify_change for SSE)
  - 6 indexes for performance
  - task_stage enum type

- `seed.sql` - Essential seed data
  - 4 templates (Task, Project, Epic, Rule)
  - 10 template properties
  - 4 sequence values

**Used By**:
- Docker entrypoint (`/docker-entrypoint-initdb.d/`)
- `init-fresh.sh` script
- Manual database initialization

**Committed to Git**: ✅ Yes - Essential for fresh setup

---

### `/scripts/` - Maintenance Scripts

**Purpose**: Shell scripts for database operations (backup, restore, extract, test).

**Scripts**:

#### `backup-fresh.sh`
Creates 4 backup files:
- `.dump` - Compressed binary (recommended)
- `.sql` - Plain SQL (human-readable)
- `schema_*.sql` - Schema only
- `data_*.sql` - Data only

Usage: `./backup-fresh.sh` or `make backup`

#### `backup-minimal.sh`
Creates only `.dump` file (75% space savings).

Usage: `./backup-minimal.sh`

#### `restore-fresh.sh`
Restores database from backup with safety checks.
- Supports `.dump` and `.sql` formats
- Interactive confirmation for production
- Can restore to different database name

Usage: `./restore-fresh.sh ../backups/backup.dump [target_db]`

#### `init-fresh.sh`
Initializes fresh database from init/schema.sql and init/seed.sql.
- Drops existing database
- Creates new database
- Applies schema and seed
- Verifies installation

Usage: `./init-fresh.sh` or `make init-fresh`

#### `extract-schema.sh`
Extracts current database structure to init/schema.sql.
- Updates schema.sql with current state
- Use after adding functions/triggers
- Preserves all database objects

Usage: `./extract-schema.sh` or `make extract-schema`

#### `extract-seed.sh`
Extracts templates and properties to init/seed.sql.
- Updates seed.sql with current state
- Includes sequence values
- Use after modifying templates/properties

Usage: `./extract-seed.sh` or `make regenerate-seed`

#### `test-setup.sh` ⭐ NEW
Creates temporary test database in separate container.
- Container: mcp-postgres-test
- Database: mcp_tasks_test
- Port: 5433
- Does NOT affect existing database
- Auto-cleanup with `docker rm -f mcp-postgres-test`

Usage: `./test-setup.sh`

**Committed to Git**: ✅ Yes - Essential tools

---

### `/backups/` - Database Backups

**Purpose**: Stores database backup files.

**Contents**:
- Full backups in 4 formats
- Timestamped filenames
- Production data

**Committed to Git**: ❌ No - Ignored via .gitignore

**Storage Recommendations**:
- Cloud storage (S3, Google Cloud)
- External backup service
- Automated cron jobs

---

## File Paths Used by Scripts

All scripts now use relative paths from the `/scripts/` directory:

```bash
# Paths from scripts directory
../init/schema.sql        # Schema file
../init/seed.sql          # Seed file
../backups/               # Backup directory
```

## Docker Integration

The Dockerfile copies init files to PostgreSQL's auto-initialization directory:

```dockerfile
COPY init/schema.sql /docker-entrypoint-initdb.d/01-schema.sql
COPY init/seed.sql /docker-entrypoint-initdb.d/02-seed.sql
```

On first container start:
1. PostgreSQL executes `01-schema.sql`
2. PostgreSQL executes `02-seed.sql`
3. Database ready with structure and seed data

## Makefile Integration

All Makefile commands now reference the correct paths:

```makefile
backup:           cd database/scripts && ./backup-fresh.sh
restore:          cd database/scripts && ./restore-fresh.sh
init-fresh:       cd database/scripts && ./init-fresh.sh
extract-schema:   cd database/scripts && ./extract-schema.sh
extract-all:      cd database/scripts && ./extract-schema.sh && ./extract-seed.sh
```

## Testing Without Affecting Production

Use the test-setup.sh script:

```bash
cd database/scripts
./test-setup.sh

# Test database is now running on port 5433
docker exec -it mcp-postgres-test psql -U mcp_user -d mcp_tasks_test

# Clean up when done
docker rm -f mcp-postgres-test
```

This creates a completely isolated test environment:
- ✅ Separate container (mcp-postgres-test)
- ✅ Separate database (mcp_tasks_test)
- ✅ Different port (5433)
- ✅ Same schema and seed data
- ✅ Easy cleanup

## Migration from Previous Structure

**Before**:
```
database/
├── schema.sql               # Root level
├── seed.sql                 # Root level
├── backup-fresh.sh          # Root level
├── init-fresh.sh            # Root level
└── migrations/              # Obsolete
```

**After**:
```
database/
├── init/
│   ├── schema.sql           # Moved here
│   └── seed.sql             # Moved here
├── scripts/
│   ├── backup-fresh.sh      # Moved here
│   ├── init-fresh.sh        # Moved here
│   └── test-setup.sh        # NEW
└── backups/                 # Organized
```

## Benefits

1. **Clear Organization**: Separation of concerns
   - `init/` - What goes into the database
   - `scripts/` - How to manage the database
   - `backups/` - Where backups are stored

2. **No Clutter**: Root directory only has Dockerfile and docs

3. **Easy Testing**: test-setup.sh provides safe testing environment

4. **Git Friendly**: Only essential files tracked

5. **Scalable**: Easy to add new scripts or init files

6. **Docker Compatible**: Clean COPY statements in Dockerfile

7. **Makefile Compatible**: All commands updated and working

## Quick Reference

### Initialize Fresh Database
```bash
make init-fresh
# or
cd database/scripts && ./init-fresh.sh
```

### Create Backup
```bash
make backup
# or
cd database/scripts && ./backup-fresh.sh
```

### Restore from Backup
```bash
make restore FILE=database/backups/backup.dump
# or
cd database/scripts && ./restore-fresh.sh ../backups/backup.dump
```

### Update Schema/Seed from Database
```bash
make extract-all
# or
cd database/scripts && ./extract-schema.sh && ./extract-seed.sh
```

### Test Setup
```bash
cd database/scripts && ./test-setup.sh
```

---

## Summary

The new folder structure provides:
- ✅ Clear separation of initialization vs maintenance
- ✅ Organized backup storage
- ✅ Safe testing capability
- ✅ Clean Docker integration
- ✅ Git-friendly organization
- ✅ Makefile compatibility
- ✅ Easy to understand and navigate

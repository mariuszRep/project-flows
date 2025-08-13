# Database Schema Changes

## Overview
This changelog captures the database schema changes made to synchronize the file-based schema with the actual PostgreSQL database structure.

## Date: 2025-08-07

### Changes Made

#### Schema Structure Updates

**Previous Schema (schema.sql):**
- Had a `users` table with authentication fields
- Had a `projects` table with project organization features  
- `tasks` table included `project_id` reference
- `blocks` table used `property_name` (text) and `content` (JSONB)
- Missing several key tables and enums

**Current Database Schema (updated):**
- **Removed tables:** `users`, `projects` (no longer in current database)
- **Added new enum types:**
  - `task_stage` enum: 'draft', 'backlog', 'doing', 'review', 'completed'
  - `task_type` enum: 'project', 'task'
- **Added `global_state` table:** For storing key-value configuration data
- **Modified `tasks` table:**
  - Removed `project_id` column
  - Added `user_id` and `parent_id` columns for hierarchy
  - Added `type` column using `task_type` enum
- **Modified `blocks` table:**
  - Removed `property_name` column
  - Changed `content` from JSONB to TEXT
  - Added `property_id` column referencing `properties` table
  - Added unique constraint on `(task_id, property_id)`

#### New Database Features

1. **Global State Management:**
   - `global_state` table for storing application-wide configuration
   - JSONB value storage with audit tracking

2. **Task Hierarchy:**
   - `parent_id` in tasks table enables nested task structures
   - `task_type` enum distinguishes between projects and tasks

3. **Dynamic Property System:**
   - `properties` table defines available task properties per template
   - `blocks` table links tasks to specific properties via `property_id`
   - Dependency tracking and execution order support

4. **Enhanced Indexing:**
   - Added indexes for `parent_id`, `user_id` in tasks
   - Added indexes for `property_id` in blocks
   - Global state key indexing

#### Audit Trail Improvements
- All tables maintain consistent audit columns (`created_by`, `updated_by`, `created_at`, `updated_at`)
- Automatic timestamp triggers for all tables
- Client identification tracking

### Impact Assessment

**Breaking Changes:**
- Removal of user authentication system
- Removal of project organization (replaced with task hierarchy)
- Change from text-based to ID-based property references in blocks

**Migration Required:**
- Any existing data would need migration scripts
- Applications depending on removed tables need updates

### Files Updated
- `/database/schema.sql` - Updated to reflect current database structure
- This changelog created to document changes

### Next Steps
- [x] Update seed.sql to match current database data
- [x] Verify application code compatibility with schema changes
- [x] Update database.ts to use property_id instead of property_name
- [ ] Create migration scripts if needed for existing deployments

## Code Changes Made (Date: 2025-08-07)

### Fixed Database Query Issues

**Problem**: After schema update, UI was failing with error "column property_name does not exist" when trying to delete properties.

**Root Cause**: The database.ts file was still using the old `property_name` column references, but the new schema uses `property_id` with foreign key relationships to the `properties` table.

**Solution**: Updated all database queries in `database.ts` to:

1. **For INSERT/UPDATE operations**: Look up `property_id` first using property key, then insert/update blocks with the proper `property_id`

2. **For SELECT operations**: Join `blocks` table with `properties` table to get property key from `property_id`

**Files Modified**:
- `/mcp/src/database.ts` - Updated all property_name references to use property_id approach

**Key Changes**:
- Task creation/updating now looks up property IDs before inserting blocks
- Task retrieval now joins with properties table to get property names  
- Project operations updated to use property_id approach
- Property deletion validation updated to check blocks by property_id

**Testing Status**:
- ✅ MCP server builds successfully with TypeScript
- Ready for UI testing
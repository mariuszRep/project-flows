# Cross-Session Project Selection Synchronization

This document describes the implementation of a global project selection system that synchronizes project selection state across all MCP-connected sessions including UI, Windsurf, Claude Desktop, and other agents.

## Overview

The cross-session project selection synchronization system enables users to select a project in one interface (e.g., the UI) and have that selection automatically propagate to all connected MCP tools. This ensures consistent project context across all interactions.

## Architecture

### Database Layer

#### Global State Table
```sql
CREATE TABLE global_state (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by TEXT NOT NULL DEFAULT 'system',
    updated_by TEXT NOT NULL DEFAULT 'system'
);
```

The `global_state` table stores the currently selected project ID under key `selected_project_id`.

### MCP Server Layer

#### New Tools

**`select_project`** - Sets the global project selection
```json
{
  "name": "select_project",
  "arguments": {
    "project_id": 123  // or null to deselect
  }
}
```

**`get_selected_project`** - Retrieves the current global project selection
```json
{
  "name": "get_selected_project",
  "arguments": {}
}
```

#### Real-time Event System

- **Event Emitter**: Global singleton (`stateEvents`) for broadcasting state changes
- **Connection Manager**: Listens for state change events and broadcasts to all connected MCP clients
- **MCP Notifications**: Uses MCP's notification system to send real-time updates

#### Enhanced Task Tools

Task creation tools now automatically use the selected project when no `project_id` is explicitly provided:

```typescript
// In handleCreateTask
const selectedProjectId = await this.sharedDbService.getGlobalState('selected_project_id');
if (selectedProjectId !== null) {
  taskData.project_id = selectedProjectId;
}
```

### UI Layer

#### Enhanced ProjectContext

**New Features:**
- `selectProject()` - Uses MCP tool for selection with fallback to local state
- `syncProjectSelectionFromMCP()` - Syncs selection from server on reconnection
- `isOfflineMode` - Tracks MCP connection status
- Bidirectional synchronization between localStorage and MCP server

#### Cross-Tab Storage Service

**`projectStorageService`** provides:
- Cross-tab synchronization using BroadcastChannel API
- localStorage persistence with storage event fallback
- Subscription system for real-time updates across browser tabs

```typescript
// Subscribe to cross-tab changes
const unsubscribe = projectStorageService.subscribe('selectedProjectId', (newProjectId) => {
  setSelectedProjectId(newProjectId);
});
```

## Data Flow

### Project Selection Workflow

1. **User selects project** (in UI or via MCP tool)
2. **Update database** - Global state stored in `global_state` table
3. **Broadcast event** - State change event emitted globally
4. **Notify all clients** - MCP notification sent to all connected sessions
5. **Update local state** - Each client updates its local project selection
6. **Persist locally** - UI persists to localStorage with cross-tab sync

### Synchronization Events

```typescript
interface StateChangeEvent {
  type: 'state_change';
  key: 'selected_project_id';
  value: number | null;
  timestamp: string;
  source_client: string;
}
```

Events are broadcast to all MCP clients except the originating client to avoid loops.

## Error Handling & Fallbacks

### Offline Mode Support

- **UI Fallback**: When MCP is disconnected, UI falls back to localStorage-only mode
- **Local State Preservation**: Project selection is preserved locally during disconnections
- **Reconnection Sync**: On reconnection, UI syncs with server state
- **Graceful Degradation**: All functionality works offline with local persistence

### Error Scenarios

1. **MCP Server Disconnected**
   - UI switches to offline mode (`isOfflineMode: true`)
   - Project selection continues to work locally
   - Cross-tab synchronization still functions via BroadcastChannel

2. **Database Connection Lost**
   - MCP tools return error messages
   - Local state is preserved in UI
   - Automatic retry on reconnection

3. **Tool Execution Failures**
   - Detailed error messages in tool responses
   - UI shows sync failure warnings
   - Local state remains intact

### Conflict Resolution

- **Server Authority**: Server state takes precedence during sync conflicts
- **Last Writer Wins**: Most recent selection overwrites conflicting states
- **Graceful Merging**: UI only updates when server state differs from local state

## Integration Guide

### For MCP Tool Developers

1. **Check Global Selection**:
```typescript
const selectedProjectId = await dbService.getGlobalState('selected_project_id');
```

2. **Update Task Association**:
```typescript
if (!toolArgs.project_id && selectedProjectId) {
  taskData.project_id = selectedProjectId;
}
```

3. **Respect Project Context**:
- Use selected project as default when no explicit project specified
- Display project information in tool outputs
- Support project filtering in list operations

### For UI Components

1. **Use Project Context**:
```typescript
const { selectedProjectId, selectProject, isOfflineMode } = useProject();
```

2. **Handle Selection Changes**:
```typescript
await selectProject(projectId); // Syncs with MCP server
```

3. **Show Connection Status**:
```typescript
{isOfflineMode && <div>Offline Mode - selections saved locally</div>}
```

## Testing Scenarios

### Manual Testing Checklist

#### Basic Functionality
- [ ] Select project in UI - verify MCP tools use it for new tasks
- [ ] Select project via MCP tool - verify UI updates immediately
- [ ] Clear selection - verify all interfaces show no selection
- [ ] Create task without project_id - verify it uses selected project

#### Cross-Session Synchronization  
- [ ] Select project in Windsurf - verify UI updates
- [ ] Select project in UI - verify Claude Desktop reflects change
- [ ] Multiple browser tabs - verify selection syncs across tabs
- [ ] Real-time updates work without page refresh

#### Error Handling
- [ ] Disconnect MCP server - verify UI shows offline mode
- [ ] Reconnect MCP server - verify sync resumes
- [ ] Database connection lost - verify graceful error handling
- [ ] Invalid project selection - verify proper error messages

#### Edge Cases
- [ ] Project deleted while selected - verify graceful handling
- [ ] Concurrent selections from multiple clients - verify last writer wins
- [ ] Browser storage disabled - verify fallback mechanisms
- [ ] Network interruption during selection - verify retry logic

## Files Modified

### MCP Server
- `database/migration_global_state.sql` - Database schema
- `mcp/src/database.ts` - Global state CRUD operations
- `mcp/src/tools/project-tools.ts` - New select_project and get_selected_project tools
- `mcp/src/tools/task-tools.ts` - Auto-use selected project in task creation
- `mcp/src/events/state-events.ts` - Global event emitter system
- `mcp/src/server/connection-manager.ts` - Real-time broadcasting

### UI
- `ui/src/contexts/ProjectContext.tsx` - Enhanced with MCP synchronization
- `ui/src/services/projectStorageService.ts` - Cross-tab storage service

## Performance Considerations

- **Database Queries**: Global state queries are lightweight (single row lookup)
- **Event Broadcasting**: Only sends to connected clients, excludes source client
- **Local Storage**: Minimal localStorage operations, cached in memory
- **Cross-Tab Communication**: Uses efficient BroadcastChannel API
- **MCP Notifications**: Leverages existing MCP infrastructure

## Security Considerations

- **Input Validation**: All project IDs validated before database operations
- **Client Identification**: Audit trail tracks which client made changes
- **Permission Boundaries**: No elevation of privileges, same access controls apply
- **Data Integrity**: Transaction-based database operations ensure consistency

## Future Enhancements

1. **Project-Based Filtering**: Filter task lists by selected project
2. **Project Switching UI**: Quick project switcher in all interfaces  
3. **Recent Projects**: Track and suggest recently used projects
4. **Project Templates**: Create tasks with project-specific templates
5. **Bulk Operations**: Move multiple tasks between projects
6. **Project Analytics**: Usage statistics and insights per project

## Conclusion

The cross-session project selection synchronization system provides a seamless experience across all MCP-connected interfaces while maintaining robust error handling and offline capabilities. The implementation follows MCP best practices and ensures data consistency through proper conflict resolution and state management.
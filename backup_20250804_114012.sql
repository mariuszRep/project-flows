--
-- PostgreSQL database dump
--

-- Dumped from database version 15.13 (Debian 15.13-1.pgdg120+1)
-- Dumped by pg_dump version 15.13 (Debian 15.13-1.pgdg120+1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: mcp_user
--

-- *not* creating schema, since initdb creates it


ALTER SCHEMA public OWNER TO mcp_user;

--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: mcp_user
--

COMMENT ON SCHEMA public IS '';


--
-- Name: task_stage; Type: TYPE; Schema: public; Owner: mcp_user
--

CREATE TYPE public.task_stage AS ENUM (
    'draft',
    'backlog',
    'doing',
    'review',
    'completed'
);


ALTER TYPE public.task_stage OWNER TO mcp_user;

--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: mcp_user
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_updated_at_column() OWNER TO mcp_user;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: blocks; Type: TABLE; Schema: public; Owner: mcp_user
--

CREATE TABLE public.blocks (
    id integer NOT NULL,
    task_id integer NOT NULL,
    property_name text NOT NULL,
    content jsonb NOT NULL,
    "position" integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    created_by text DEFAULT 'system'::text NOT NULL,
    updated_by text DEFAULT 'system'::text NOT NULL,
    user_id integer
);


ALTER TABLE public.blocks OWNER TO mcp_user;

--
-- Name: blocks_id_seq; Type: SEQUENCE; Schema: public; Owner: mcp_user
--

CREATE SEQUENCE public.blocks_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.blocks_id_seq OWNER TO mcp_user;

--
-- Name: blocks_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: mcp_user
--

ALTER SEQUENCE public.blocks_id_seq OWNED BY public.blocks.id;


--
-- Name: global_state; Type: TABLE; Schema: public; Owner: mcp_user
--

CREATE TABLE public.global_state (
    key text NOT NULL,
    value jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    created_by text DEFAULT 'system'::text NOT NULL,
    updated_by text DEFAULT 'system'::text NOT NULL
);


ALTER TABLE public.global_state OWNER TO mcp_user;

--
-- Name: projects; Type: TABLE; Schema: public; Owner: mcp_user
--

CREATE TABLE public.projects (
    id integer NOT NULL,
    name text NOT NULL,
    description text,
    color text DEFAULT '#3b82f6'::text NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    created_by text DEFAULT 'system'::text NOT NULL,
    updated_by text DEFAULT 'system'::text NOT NULL
);


ALTER TABLE public.projects OWNER TO mcp_user;

--
-- Name: projects_id_seq; Type: SEQUENCE; Schema: public; Owner: mcp_user
--

CREATE SEQUENCE public.projects_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.projects_id_seq OWNER TO mcp_user;

--
-- Name: projects_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: mcp_user
--

ALTER SEQUENCE public.projects_id_seq OWNED BY public.projects.id;


--
-- Name: properties; Type: TABLE; Schema: public; Owner: mcp_user
--

CREATE TABLE public.properties (
    id integer NOT NULL,
    template_id integer NOT NULL,
    key text NOT NULL,
    type text NOT NULL,
    description text NOT NULL,
    dependencies text[] DEFAULT '{}'::text[],
    execution_order integer DEFAULT 0 NOT NULL,
    fixed boolean DEFAULT false,
    created_by text DEFAULT 'system'::text NOT NULL,
    updated_by text DEFAULT 'system'::text NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    user_id integer
);


ALTER TABLE public.properties OWNER TO mcp_user;

--
-- Name: properties_id_seq; Type: SEQUENCE; Schema: public; Owner: mcp_user
--

CREATE SEQUENCE public.properties_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.properties_id_seq OWNER TO mcp_user;

--
-- Name: properties_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: mcp_user
--

ALTER SEQUENCE public.properties_id_seq OWNED BY public.properties.id;


--
-- Name: tasks; Type: TABLE; Schema: public; Owner: mcp_user
--

CREATE TABLE public.tasks (
    id integer NOT NULL,
    stage public.task_stage DEFAULT 'draft'::public.task_stage NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    created_by text DEFAULT 'system'::text NOT NULL,
    updated_by text DEFAULT 'system'::text NOT NULL,
    user_id integer,
    project_id integer
);


ALTER TABLE public.tasks OWNER TO mcp_user;

--
-- Name: tasks_id_seq; Type: SEQUENCE; Schema: public; Owner: mcp_user
--

CREATE SEQUENCE public.tasks_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.tasks_id_seq OWNER TO mcp_user;

--
-- Name: tasks_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: mcp_user
--

ALTER SEQUENCE public.tasks_id_seq OWNED BY public.tasks.id;


--
-- Name: templates; Type: TABLE; Schema: public; Owner: mcp_user
--

CREATE TABLE public.templates (
    id integer NOT NULL,
    name text NOT NULL,
    description text NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    created_by text DEFAULT 'system'::text NOT NULL,
    updated_by text DEFAULT 'system'::text NOT NULL,
    user_id integer
);


ALTER TABLE public.templates OWNER TO mcp_user;

--
-- Name: templates_id_seq; Type: SEQUENCE; Schema: public; Owner: mcp_user
--

CREATE SEQUENCE public.templates_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.templates_id_seq OWNER TO mcp_user;

--
-- Name: templates_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: mcp_user
--

ALTER SEQUENCE public.templates_id_seq OWNED BY public.templates.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: mcp_user
--

CREATE TABLE public.users (
    id integer NOT NULL,
    email character varying(255) NOT NULL,
    password_hash character varying(255) NOT NULL,
    first_name character varying(100),
    last_name character varying(100),
    is_active boolean DEFAULT true,
    email_verified boolean DEFAULT false,
    last_login timestamp with time zone,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.users OWNER TO mcp_user;

--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: mcp_user
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.users_id_seq OWNER TO mcp_user;

--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: mcp_user
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: blocks id; Type: DEFAULT; Schema: public; Owner: mcp_user
--

ALTER TABLE ONLY public.blocks ALTER COLUMN id SET DEFAULT nextval('public.blocks_id_seq'::regclass);


--
-- Name: projects id; Type: DEFAULT; Schema: public; Owner: mcp_user
--

ALTER TABLE ONLY public.projects ALTER COLUMN id SET DEFAULT nextval('public.projects_id_seq'::regclass);


--
-- Name: properties id; Type: DEFAULT; Schema: public; Owner: mcp_user
--

ALTER TABLE ONLY public.properties ALTER COLUMN id SET DEFAULT nextval('public.properties_id_seq'::regclass);


--
-- Name: tasks id; Type: DEFAULT; Schema: public; Owner: mcp_user
--

ALTER TABLE ONLY public.tasks ALTER COLUMN id SET DEFAULT nextval('public.tasks_id_seq'::regclass);


--
-- Name: templates id; Type: DEFAULT; Schema: public; Owner: mcp_user
--

ALTER TABLE ONLY public.templates ALTER COLUMN id SET DEFAULT nextval('public.templates_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: mcp_user
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Data for Name: blocks; Type: TABLE DATA; Schema: public; Owner: mcp_user
--

COPY public.blocks (id, task_id, property_name, content, "position", created_at, updated_at, created_by, updated_by, user_id) FROM stdin;
8	3	Items	["Research current connection patterns and identify enhancement points", "Design connection persistence storage schema and validation", "Implement automatic connection initiation in MCPContext", "Add localStorage/sessionStorage for connection settings persistence", "Create robust reconnection logic with exponential backoff", "Implement connection health monitoring and heartbeat mechanism", "Add connection state recovery on page load/refresh", "Enhance ConnectionStatus component with detailed feedback", "Create connection configuration interface for server URL", "Add error handling for storage quota and corruption scenarios", "Implement circuit breaker pattern for failed connections", "Add browser visibility API integration for connection management", "Create connection progress indicators and loading states", "Test connection persistence across browser refreshes", "Test reconnection handling during server downtime", "Test error scenarios and fallback behaviors", "Update documentation for new connection features", "Code review and testing with different network conditions"]	2	2025-07-24 15:06:46.891743+00	2025-07-24 15:06:46.891743+00	claude-code	claude-code	\N
6	3	Description	"## Overview\\nImplement a robust mechanism for automatically connecting to the MCP server when the UI loads, with persistent session management that survives browser refreshes and handles network interruptions gracefully.\\n\\n## Current State Analysis\\n- MCP connection is managed via MCPContext with SSE transport at `/ui/src/contexts/MCPContext.tsx`\\n- **No persistence mechanisms exist** - connection state is lost on refresh\\n- **Manual connection only** - via connect() function triggered by UI buttons\\n- **No auto-connection** - except limited logic on Template page\\n- **No retry logic** - single connection attempt with basic error handling\\n- Server URL hardcoded to `http://localhost:3001/sse` (line 31 in MCPContext.tsx)\\n- Clean disconnect logic with proper cleanup exists\\n- ConnectionStatus component provides manual connection UI\\n\\n## Current File Structure Analysis\\n\\n### Core Files to Modify\\n\\n#### **MCPContext.tsx** (`/ui/src/contexts/MCPContext.tsx`) - MAJOR CHANGES\\n**Current Implementation (lines 31-142):**\\n- Manual connection via `connect()` callback (lines 40-78)\\n- serverUrl state with hardcoded default (line 31)\\n- Basic error handling but no retry logic (lines 70-77)\\n- Clean disconnect and cleanup logic (lines 80-118)\\n\\n**Required Modifications:**\\n- Add auto-connection on context initialization via useEffect\\n- Integrate persistence service for serverUrl and connection preferences\\n- Implement exponential backoff retry logic (1s, 2s, 4s, 8s, 16s, max 30s)\\n- Add connection health monitoring with periodic heartbeats\\n- Track connection attempts, success/failure states, and retry counters\\n- Add session recovery logic for browser refresh scenarios\\n\\n#### **ConnectionStatus.tsx** (`/ui/src/components/MCP/ConnectionStatus.tsx`) - MODERATE CHANGES  \\n**Current Implementation (lines 21-118):**\\n- Manual connect/disconnect buttons (lines 86-114)\\n- Server URL input field (lines 48-57)\\n- Connection status badges and error alerts (lines 59-84)\\n\\n**Required Modifications:**\\n- Add auto-connection toggle/preference controls\\n- Display connection retry status and attempt counters\\n- Show session persistence indicators (connected automatically, etc.)\\n- Add manual retry button for failed connections\\n- Enhanced connection progress indicators\\n\\n#### **Settings.tsx** (`/ui/src/pages/Settings.tsx`) - MINOR CHANGES\\n**Current Implementation (lines 11-102):**\\n- Uses ConnectionStatus component for MCP configuration (lines 82-92)\\n- Theme settings in same interface (lines 76-93)\\n\\n**Required Modifications:**\\n- Add auto-connection preferences section\\n- Connection retry configuration options (max attempts, retry intervals)\\n- Session persistence settings toggle\\n\\n### New Files to Create\\n\\n#### **connectionService.ts** (`/ui/src/services/connectionService.ts`) - NEW FILE\\n**Purpose:** Centralized connection logic with retry mechanisms\\n**Key Functions:**\\n- `connectWithRetry(serverUrl, maxAttempts, onProgress)` - Connection with exponential backoff  \\n- `isServerReachable(serverUrl)` - Health check function\\n- `createConnectionHeartbeat(client, interval)` - Periodic connection validation\\n- `getRetryDelay(attempt)` - Exponential backoff calculation\\n- Connection state machine management\\n\\n#### **storageService.ts** (`/ui/src/services/storageService.ts`) - NEW FILE  \\n**Purpose:** Abstracted storage operations for connection settings\\n**Key Functions:**\\n- `saveConnectionSettings(settings)` - Store to localStorage\\n- `loadConnectionSettings()` - Retrieve with validation\\n- `clearConnectionSettings()` - Reset stored data\\n- `migrateStorageFormat(version)` - Handle format changes\\n- Type-safe storage with validation and error handling\\n\\n#### **useConnectionPersistence.ts** (`/ui/src/hooks/useConnectionPersistence.ts`) - NEW FILE\\n**Purpose:** Custom hook for managing persistent connection state  \\n**Key Functions:**\\n- `useConnectionPersistence()` - Main hook for React integration\\n- Cross-tab synchronization via storage events\\n- React state synchronization with localStorage\\n- Connection preference management\\n\\n## Technical Requirements\\n\\n### 1. Automatic Connection Management\\n- **Auto-connect trigger:** useEffect in MCPContext on context initialization\\n- **Connection retry:** Exponential backoff with jitter (1s, 2s, 4s, 8s, 16s, max 30s)\\n- **Health monitoring:** Periodic heartbeats using existing `listTools()` call\\n- **Graceful failure:** Handle server unavailability without blocking UI\\n\\n### 2. Persistent Session State  \\n- **Storage strategy:** localStorage for persistent settings across browser sessions\\n- **Stored data:** serverUrl, autoConnect preference, retry settings, last connection timestamp\\n- **Data validation:** Type-safe storage with schema validation and migration support\\n- **Recovery logic:** Restore connection state after browser refresh\\n\\n### 3. Robust Reconnection Handling\\n- **Connection state machine:** DISCONNECTED → CONNECTING → CONNECTED → CONNECTION_LOST → RECONNECTING\\n- **Circuit breaker:** Stop attempts after 5 consecutive failures, resume after 5 minutes\\n- **Network events:** Listen to online/offline events for connection management\\n- **Visibility API:** Pause reconnection when tab hidden, resume when visible\\n\\n### 4. Connection State Recovery\\n- **Browser refresh:** Detect previous connection state and auto-restore\\n- **Settings validation:** Validate stored serverUrl before attempting connection\\n- **Fallback behavior:** Use defaults when stored settings are invalid/corrupted\\n- **Migration support:** Handle changes to storage format gracefully\\n\\n### 5. User Experience Improvements\\n- **Connection feedback:** Real-time status with retry counters and progress\\n- **Manual controls:** Override auto-connection with manual connect/disconnect\\n- **Configuration UI:** Settings for auto-connect, retry attempts, server URL\\n- **Error communication:** Clear messaging for different failure scenarios\\n\\n## Implementation Areas & File Locations\\n\\n### Phase 1: Core Infrastructure\\n1. **Create connectionService.ts** - Retry logic and connection state machine\\n2. **Create storageService.ts** - Persistent storage with validation  \\n3. **Create useConnectionPersistence.ts** - React integration hook\\n\\n### Phase 2: Context Enhancement  \\n1. **Enhance MCPContext.tsx** - Add auto-connection and persistence integration\\n   - Lines 31-38: Add persistence state variables\\n   - Lines 40-78: Enhance connect() with retry logic  \\n   - Lines 112-118: Add auto-connection useEffect\\n2. **Integration testing** - Verify context works with new services\\n\\n### Phase 3: UI Updates\\n1. **Update ConnectionStatus.tsx** - Add auto-connection UI elements\\n   - Lines 47-57: Add auto-connect toggle \\n   - Lines 59-68: Enhanced status display with retry info\\n   - Lines 86-114: Updated connection controls\\n2. **Update Settings.tsx** - Add connection preferences\\n   - Lines 76-93: Add auto-connection configuration section\\n\\n### Phase 4: Testing & Validation\\n1. **Connection persistence** - Test across browser refreshes\\n2. **Retry logic** - Test with server downtime scenarios  \\n3. **Error handling** - Test storage corruption and network failures\\n4. **UI feedback** - Verify all connection states display properly\\n\\n## Success Criteria\\n1. **Automatic connection:** MCP server connects automatically on UI load without user intervention\\n2. **Persistence:** Connection survives browser refreshes and maintains settings\\n3. **Retry handling:** Failed connections retry automatically with exponential backoff\\n4. **User control:** Users can configure server URL and auto-connection preferences  \\n5. **Status feedback:** Connection state is clearly communicated with retry progress\\n6. **Graceful degradation:** Application works when server is unavailable\\n7. **Backward compatibility:** Existing MCP tools and components work unchanged\\n\\n## Technical Considerations\\n- **Memory management:** Proper cleanup of timers, event listeners, and connections\\n- **Performance impact:** Limit reconnection frequency and respect browser tab visibility\\n- **Cross-tab sync:** Handle multiple browser tabs with shared connection state\\n- **Error boundaries:** Prevent connection failures from crashing the application\\n- **Security:** Validate stored URLs and prevent injection attacks\\n\\n## Dependencies & Integration Points\\n- **Existing MCPContext structure** - Build on current context pattern (lines 11-22)\\n- **SSE transport layer** - Continue using @modelcontextprotocol/sdk/client/sse.js\\n- **UI components** - Enhance existing ConnectionStatus without breaking changes\\n- **Browser APIs** - localStorage, Visibility API, online/offline events\\n- **React patterns** - useEffect, useCallback, custom hooks for clean integration"	0	2025-07-24 15:06:46.891743+00	2025-07-24 15:45:44.980571+00	claude-code	claude-code	\N
7	3	Notes	"## Implementation Completed Successfully\\n\\n✅ **Core Infrastructure Created:**\\n- `storageService.ts`: Connection settings persistence with localStorage\\n- `connectionService.ts`: Retry logic with exponential backoff and jitter  \\n- `useConnectionPersistence.ts`: React hook for cross-tab synchronization\\n\\n✅ **Enhanced MCPContext:**\\n- Auto-connection on app startup when `autoConnect` is enabled\\n- Session persistence across browser refreshes\\n- Robust retry mechanism with exponential backoff (1s, 2s, 4s, 8s, 16s, max 30s)\\n- Connection health monitoring with heartbeat mechanism using `listTools()`\\n- Recovery logic for connection loss with automatic reconnection\\n- Browser online/offline event handling\\n\\n✅ **Updated ConnectionStatus Component:**\\n- Auto-connect toggle switch in settings\\n- Enhanced status display with retry progress indicators\\n- Connection state visualization (Connecting, Reconnecting, Failed, etc.)\\n- Retry counter and next retry countdown display\\n- Manual retry button for failed connections\\n\\n✅ **Features Implemented:**\\n1. **Automatic Connection**: App connects to MCP server automatically on startup\\n2. **Session Persistence**: Settings and connection state survive browser refreshes\\n3. **Retry Logic**: Exponential backoff with jitter prevents server overload\\n4. **Health Monitoring**: Periodic heartbeats detect connection loss\\n5. **State Recovery**: Graceful handling of network interruptions\\n6. **User Controls**: Toggle auto-connect, manual retry, server URL configuration\\n7. **Cross-tab Sync**: Settings changes propagate across browser tabs\\n8. **Network Awareness**: Handles browser online/offline events\\n\\n✅ **Technical Implementation:**\\n- TypeScript with proper type safety throughout\\n- React hooks pattern for clean integration\\n- localStorage for persistence with validation and migration support\\n- Circuit breaker pattern prevents infinite retry loops\\n- Proper cleanup of timers and event listeners\\n- Error boundaries prevent connection failures from crashing app\\n\\n✅ **Testing:**\\n- Build passes without TypeScript errors\\n- Development server starts successfully  \\n- All components properly integrated with new MCP context interface\\n\\nThe implementation provides a robust, production-ready automatic connection system with comprehensive error handling and user experience enhancements."	1	2025-07-24 15:06:46.891743+00	2025-07-25 13:10:02.246891+00	claude-code	claude-code	\N
54	8	Description	"Create a dedicated page or card component that shows a filtered list of all tasks currently in draft stage. This should include:\\n\\n1. A new page/component for displaying draft tasks\\n2. Navigation link from the board page to access the draft tasks list\\n3. Proper UI design following existing patterns in the project\\n4. Integration with the MCP task management system\\n5. Responsive design consistent with current dashboard styling"	0	2025-07-25 10:07:28.609398+00	2025-07-25 10:07:28.609398+00	claude-code	claude-code	\N
55	8	Notes	"Need to understand the current project structure, UI components, and navigation patterns before implementation. Should follow existing design system and ensure seamless integration with the current dashboard."	1	2025-07-25 10:07:28.609398+00	2025-07-25 10:07:28.609398+00	claude-code	claude-code	\N
56	8	Items	["Investigate current UI structure and design patterns", "Examine existing board page and navigation components", "Review MCP task filtering functionality for draft stage", "Design the draft tasks list page/card layout", "Create the draft tasks list component", "Add navigation link from board page to draft tasks", "Implement proper routing for the new page", "Test the functionality and navigation flow", "Ensure responsive design matches existing patterns"]	2	2025-07-25 10:07:28.609398+00	2025-07-25 10:07:28.609398+00	claude-code	claude-code	\N
57	9	Description	"Currently the board page displays 3 sample/placeholder tasks even when not connected to the MCP server. This needs to be changed to:\\n\\n1. Remove all sample/placeholder tasks from the board page\\n2. Show an empty state when not connected to the MCP server\\n3. Display a message asking users to connect to the MCP server\\n4. Ensure proper handling of connection states (connected vs disconnected)\\n5. Maintain existing functionality when properly connected to the server"	0	2025-07-25 10:07:50.343835+00	2025-07-25 10:07:50.343835+00	claude-code	claude-code	\N
58	9	Notes	"The board page should be completely empty when not connected to the MCP server, with a clear message guiding users to establish the connection. This will provide a cleaner user experience and avoid confusion with placeholder data."	1	2025-07-25 10:07:50.343835+00	2025-07-25 10:07:50.343835+00	claude-code	claude-code	\N
59	9	Items	["Investigate current board page implementation and locate sample data", "Identify where sample tasks are defined/rendered", "Remove sample task data from the codebase", "Create empty state component for disconnected state", "Add connection status detection logic", "Implement message prompting user to connect to MCP server", "Test board page behavior when disconnected", "Test board page behavior when connected", "Ensure no regression in existing functionality"]	2	2025-07-25 10:07:50.343835+00	2025-07-25 10:07:50.343835+00	claude-code	claude-code	\N
64	10	Title	"Implement Project Functionality for Tasks"	3	2025-07-28 11:15:51.794304+00	2025-07-30 14:14:17.687077+00	windsurf	windsurf	\N
61	10	Description	"Create or improve project functionality so that each task has an attached project. Projects should be stored in a PostgreSQL table and properly integrated with the existing task management system."	0	2025-07-28 11:15:51.794304+00	2025-07-30 14:14:17.687077+00	windsurf	windsurf	\N
65	11	Description	"The index.ts file in the MCP server has grown too large (over 1200 lines) and is becoming difficult to read and maintain. We will implement a feature-based organization approach to split this file into smaller, more focused modules while maintaining the same functionality. This will improve code readability, maintainability, and make future development easier."	0	2025-07-28 11:21:52.891576+00	2025-07-29 15:36:25.223854+00	windsurf	ui-client	\N
62	10	Notes	"Based on code review, there is partial implementation of project functionality in the UI but the backend components are missing. The database schema needs to be updated with a projects table, and the MCP server needs to be updated with project CRUD operations. The UI has a temporary hardcoded project but needs to be connected to the backend."	1	2025-07-28 11:15:51.794304+00	2025-07-30 14:14:17.687077+00	windsurf	windsurf	\N
63	10	Items	"- [ ] Create `projects` table in PostgreSQL database\\n- [ ] Add foreign key relationship between tasks and projects\\n- [ ] Update database schema with proper indexes for performance\\n- [ ] Implement project CRUD operations in DatabaseService\\n- [ ] Add project API endpoints in MCP server\\n- [ ] Update task creation/editing to include project selection\\n- [ ] Modify TaskBoard component to handle projects from backend\\n- [ ] Add project filtering functionality to TaskBoard\\n- [ ] Create project management UI components\\n- [ ] Update TaskCard to display project information\\n- [ ] Add project color coding to task cards\\n- [ ] Implement tests for project functionality\\n- [ ] Document the new project features"	2	2025-07-28 11:15:51.794304+00	2025-07-30 14:14:17.687077+00	windsurf	windsurf	\N
66	11	Notes	"## Feature-based Organization Approach\\nWe will organize the code by feature or functionality:\\n\\n```\\nsrc/\\n├── index.ts                 # Main entry point (simplified)\\n├── server/\\n│   ├── express-server.ts    # Express app setup, CORS, timeouts\\n│   └── connection-manager.ts # SSE connection management\\n├── mcp/\\n│   ├── server-factory.ts    # MCP server creation and configuration\\n│   └── request-handlers.ts   # MCP request handlers\\n├── tools/\\n│   ├── task-tools.ts        # Task-related tools (create, update, list, get)\\n│   └── property-tools.ts    # Property-related tools\\n├── types/\\n│   ├── task.ts              # Task interfaces and types\\n│   └── property.ts          # Property interfaces and types\\n└── database/\\n    └── database-service.ts  # Database operations (already exists)\\n```\\n\\n## Files to Adjust\\n\\n1. **index.ts**: Simplify to be a clean entry point that imports and connects all modules\\n2. **server/express-server.ts**: Extract Express app setup, CORS, and timeout middleware\\n3. **server/connection-manager.ts**: Extract SSE connection management logic\\n4. **mcp/server-factory.ts**: Extract MCP server creation and configuration\\n5. **mcp/request-handlers.ts**: Extract MCP request handlers\\n6. **tools/task-tools.ts**: Extract task-related tool implementations\\n7. **tools/property-tools.ts**: Extract property-related tool implementations\\n8. **types/task.ts**: Extract task interfaces and types\\n9. **types/property.ts**: Extract property interfaces and types\\n\\n## Technical Requirements\\n- All existing functionality must be preserved exactly as is\\n- The refactoring should be done incrementally to minimize risk\\n- The code should follow TypeScript best practices for modularity\\n- Types and interfaces should be properly exported/imported\\n- The entry point should remain clean and focused\\n\\n## Dependencies\\n- Express.js for HTTP server\\n- MCP SDK for server implementation\\n- Database service for persistence\\n- Shared types and interfaces across modules\\n\\n## Acceptance Criteria\\n- All existing functionality works identically after refactoring\\n- Code is organized into logical modules with clear responsibilities\\n- Entry point (index.ts) is simplified and focused\\n- No regression in error handling or performance\\n- Documentation is updated to reflect the new structure"	1	2025-07-28 11:21:52.891576+00	2025-07-28 11:27:45.363971+00	windsurf	windsurf	\N
68	11	Title	"Implement Feature-based Organization for index.ts File Splitting"	3	2025-07-28 11:21:52.891576+00	2025-07-29 15:36:25.223854+00	windsurf	ui-client	\N
73	12	Description	"Create functionality to allow users to reorder template properties/blocks using drag and drop in the Task Templates interface. This will improve the user experience by making it easier to organize template properties in the desired order."	0	2025-07-28 12:03:31.485677+00	2025-07-28 12:03:31.485677+00	windsurf	windsurf	\N
74	12	Notes	"## Technical Requirements\\n- The current implementation in TaskForm.tsx already has a GripVertical icon that suggests drag functionality but doesn't implement it\\n- Template properties are currently ordered by execution_order or index\\n- Need to implement React drag-and-drop functionality to allow reordering\\n- Must update the execution_order property when items are reordered\\n- Need to persist changes to the backend using existing MCP tools\\n\\n## Dependencies\\n- Need to add a drag-and-drop library like react-beautiful-dnd or @dnd-kit/core\\n- Changes must work with the existing property saving logic in handleSubmit()\\n\\n## Acceptance Criteria\\n- Users can drag and drop template properties to reorder them\\n- Visual feedback is provided during drag operations\\n- Order changes are persisted when saving the template\\n- Existing functionality is preserved"	1	2025-07-28 12:03:31.485677+00	2025-07-28 12:03:31.485677+00	windsurf	windsurf	\N
76	12	Title	"Implement Drag and Drop for Template Properties"	3	2025-07-28 12:03:31.485677+00	2025-07-28 12:03:31.485677+00	windsurf	windsurf	\N
75	12	Items	"- [x] Research and select an appropriate drag-and-drop library (react-beautiful-dnd or @dnd-kit/core)\\n- [x] Install the selected library and add it to dependencies\\n- [x] Modify the TaskForm component to implement drag-and-drop functionality\\n- [x] Add drag handle to each property block\\n- [x] Implement drag start, drag over, and drag end event handlers\\n- [x] Update the formData.blocks array when items are reordered\\n- [x] Ensure execution_order is updated correctly when blocks are reordered\\n- [x] Add visual feedback during drag operations (highlight drop zones)\\n- [x] Ensure the new order is preserved when saving template changes\\n- [x] Test the drag-and-drop functionality with different template configurations"	2	2025-07-28 12:03:31.485677+00	2025-07-28 13:58:53.644119+00	windsurf	claude-code	\N
86	8	Title	"Create Draft Tasks List Page with Dashboard Navigation"	3	2025-07-28 14:35:54.722799+00	2025-07-28 14:35:54.722799+00	migration	migration	\N
87	9	Title	"Remove Sample Data and Add Empty State for Board Page"	3	2025-07-28 14:35:54.722799+00	2025-07-28 14:35:54.722799+00	migration	migration	\N
88	3	Title	"Implement Automatic MCP Server Connection with Persistent Sessions"	3	2025-07-28 14:35:54.722799+00	2025-07-28 14:35:54.722799+00	migration	migration	\N
89	14	Title	"Deprecate and Remove Legacy `title` and `summary` Fields from `tasks` Table"	0	2025-07-28 14:47:27.096353+00	2025-07-28 14:47:27.096353+00	windsurf	windsurf	\N
90	14	Description	"Following the successful migration of all `title` and `summary` data into the `blocks` table, this task is to fully deprecate and remove these legacy columns. This will involve changes to the database schema, backend API (MCP server), and frontend UI to ensure the application relies exclusively on the new dynamic blocks system for task titles and descriptions."	1	2025-07-28 14:47:27.096353+00	2025-07-28 14:47:27.096353+00	windsurf	windsurf	\N
91	14	Notes	"### Context\\n- All legacy `title` and `summary` data has been migrated to `Title` and `Description` blocks.\\n- 7 tasks have been confirmed to have both `Title` and `Description` blocks.\\n- The `created_by` and `updated_by` fields for migrated blocks are set to 'migration'.\\n\\n### Affected Codebase\\n- **Backend:** `/home/mariusz/projects/project-flows/mcp/src/database.ts`, `/home/mariusz/projects/project-flows/mcp/src/index.ts`\\n- **Database:** SQL migration script required.\\n- **Frontend:** All components handling task data, especially `TaskBoard` and task detail/edit views."	2	2025-07-28 14:47:27.096353+00	2025-07-28 14:47:27.096353+00	windsurf	windsurf	\N
92	14	Items	"- [ ] **Database Schema Change**\\n  - [ ] Create and execute a SQL migration script to `ALTER TABLE tasks DROP COLUMN title, DROP COLUMN summary;`.\\n  - [ ] Verify that a final backup is taken before applying the schema change.\\n\\n- [ ] **Backend Refactoring (`/mcp/src`)**\\n  - [ ] **`database.ts`**\\n    - [ ] Remove `title` and `summary` properties from the `TaskData` interface.\\n    - [ ] Update `createTask` to create `Title` and `Description` blocks instead of using the legacy columns.\\n    - [ ] Update `updateTask` to modify `Title` and `Description` blocks.\\n    - [ ] Update `getTask` and `listTasks` to retrieve title and description from the `blocks` table, likely using a `JOIN` or separate queries.\\n  - [ ] **`index.ts`**\\n    - [ ] Update the `inputSchema` for `create_task` and `update_task` in the `ListToolsRequestSchema` handler to remove `Title` and `Summary` as required top-level properties.\\n    - [ ] Refactor the `create_task`, `update_task`, `get_task`, and `list_tasks` tool handlers to work with the `blocks` system instead of the deprecated fields.\\n    - [ ] Ensure the markdown generation for task display uses data from blocks.\\n\\n- [ ] **Frontend Refactoring (`/ui/src`)**\\n  - [ ] Identify all components that access `task.title` or `task.summary`.\\n  - [ ] Update these components to read title and description from the `task.blocks` array.\\n  - [ ] Modify task creation and editing forms to create/update `Title` and `Description` blocks.\\n\\n- [ ] **Testing**\\n  - [ ] Perform end-to-end testing of task CRUD (Create, Read, Update, Delete) functionality.\\n  - [ ] Verify that the task board, task details, and task editing all function correctly with the new data structure."	3	2025-07-28 14:47:27.096353+00	2025-07-28 14:47:27.096353+00	windsurf	windsurf	\N
97	16	Title	"Refactor and Enhance Task Form for Dynamic Rendering using MCP"	0	2025-07-29 09:12:18.45201+00	2025-07-29 13:36:51.187686+00	windsurf	ui-client	\N
98	16	Description	"The current simple form in `pages/TaskBoard.tsx` is static and does not match the server's data model. This task is to refactor it into a reusable `TaskForm.tsx` component that dynamically generates its fields based on the 'Task' template from the MCP server. The form will use the `create_task`, `update_task`, and `get_task` MCP tools to manage task data, ensuring the UI stays in sync with the server-side data model and can handle both creating and editing tasks across the application."	1	2025-07-29 09:12:18.45201+00	2025-07-29 13:36:51.187686+00	windsurf	ui-client	\N
101	16	Summary	"Develop a reusable form component for creating and updating tasks, integrating it into the task board and task list pages while adhering to the existing design language and UX best practices."	4	2025-07-29 09:12:18.45201+00	2025-07-29 09:12:18.45201+00	windsurf	windsurf	\N
67	11	Items	"- [ ] Set up the directory structure for feature-based organization\\n  - [ ] Create server/ directory\\n  - [ ] Create mcp/ directory\\n  - [ ] Create tools/ directory\\n  - [ ] Create types/ directory\\n- [ ] Extract and refactor types and interfaces\\n  - [ ] Create types/task.ts with TaskStage and TaskData interfaces\\n  - [ ] Create types/property.ts with SchemaProperty and SchemaProperties interfaces\\n  - [ ] Update imports in all files that use these types\\n- [ ] Extract server components\\n  - [ ] Create server/express-server.ts with Express app setup, CORS, and timeout middleware\\n  - [ ] Create server/connection-manager.ts with SSE connection management logic\\n  - [ ] Ensure proper exports and imports\\n- [ ] Extract MCP server components\\n  - [ ] Create mcp/server-factory.ts with createMcpServer function\\n  - [ ] Create mcp/request-handlers.ts with handler implementations\\n  - [ ] Ensure proper communication with database service\\n- [ ] Extract tool implementations\\n  - [ ] Create tools/task-tools.ts with task-related tool implementations\\n  - [ ] Create tools/property-tools.ts with property-related tool implementations\\n  - [ ] Ensure proper error handling and response formatting\\n- [ ] Refactor index.ts to be a clean entry point\\n  - [ ] Import all necessary modules\\n  - [ ] Set up main function to initialize components\\n  - [ ] Maintain existing command-line functionality\\n- [ ] Test each component in isolation\\n  - [ ] Write unit tests for each extracted module\\n  - [ ] Ensure all components work correctly when integrated\\n- [ ] Integration testing\\n  - [ ] Test the full application flow\\n  - [ ] Verify all existing functionality works as before\\n  - [ ] Check for any regressions in error handling\\n- [ ] Performance testing\\n  - [ ] Compare response times before and after refactoring\\n  - [ ] Ensure no performance degradation\\n- [ ] Documentation\\n  - [ ] Update README.md with new project structure\\n  - [ ] Add inline documentation for new modules\\n  - [ ] Create architecture diagram showing component relationships\\n- [ ] Final review and cleanup\\n  - [ ] Remove any redundant code\\n  - [ ] Ensure consistent coding style across modules\\n  - [ ] Address any TODO comments or technical debt"	2	2025-07-28 11:21:52.891576+00	2025-07-29 15:36:25.223854+00	windsurf	ui-client	\N
153	10	toolSummary	"updating task 10"	0	2025-07-30 14:14:17.687077+00	2025-07-30 14:14:17.687077+00	windsurf	windsurf	\N
123	17	Title	"Create MCP Tool to Delete Tasks"	0	2025-07-29 13:16:20.812565+00	2025-07-29 13:16:20.812565+00	windsurf	windsurf	\N
124	17	Description	"Create a new MCP tool to enable the deletion of tasks. This is necessary for managing the task board and removing completed or obsolete tasks."	1	2025-07-29 13:16:20.812565+00	2025-07-29 13:16:20.812565+00	windsurf	windsurf	\N
125	17	Notes	"The tool should securely handle task deletion, ensuring that only authorized users can delete tasks if an authentication system is in place. The UI should provide clear feedback to the user upon successful deletion or if an error occurs."	2	2025-07-29 13:16:20.812565+00	2025-07-29 13:16:20.812565+00	windsurf	windsurf	\N
126	17	Items	"- [ ] Define the API for the `delete_task` MCP tool, specifying the required parameters (e.g., `task_id`).\\n- [ ] Implement the server-side logic to handle the deletion of a task from the database.\\n- [ ] Create the `delete_task` MCP tool and register it with the MCP server.\\n- [ ] Integrate the new tool into the UI, adding a delete button to tasks on the task board.\\n- [ ] Implement confirmation dialogs in the UI to prevent accidental deletions.\\n- [ ] Write tests to ensure the deletion functionality works correctly and handles edge cases."	3	2025-07-29 13:16:20.812565+00	2025-07-29 13:16:20.812565+00	windsurf	windsurf	\N
99	16	Notes	"Crucially, the form must not be hardcoded. It should fetch the task template properties from the MCP server and dynamically render the appropriate input fields. For data manipulation, it must use the `mcp0_create_task` and `mcp0_update_task` tools. To pre-populate the form for editing, it should use the `mcp0_get_task` tool. The current server template includes `Title`, `Description`, `Notes`, and `Items`."	2	2025-07-29 09:12:18.45201+00	2025-07-29 13:36:51.187686+00	windsurf	ui-client	\N
100	16	Items	"- [ ] Create a new directory `ui/src/components/forms/`.\\n- [ ] Create a new component `ui/src/components/forms/TaskForm.tsx`.\\n- [ ] Implement logic within `TaskForm.tsx` to fetch the 'Task' template properties from the MCP server using `mcp0_get_template_properties`.\\n- [ ] Dynamically render form fields in `TaskForm.tsx` based on the fetched template properties.\\n- [ ] When editing a task, use `mcp0_get_task` to fetch the current task data and pre-populate the form fields.\\n- [ ] On form submission, use `mcp0_create_task` for new tasks and `mcp0_update_task` for existing tasks.\\n- [ ] Replace the original inline form in `pages/TaskBoard.tsx` with the new dynamic `<TaskForm />`.\\n- [ ] Integrate the `<TaskForm />` into `pages/TaskList.tsx` as well.\\n- [ ] Maintain user feedback mechanisms (e.g., toasts)."	3	2025-07-29 09:12:18.45201+00	2025-07-29 13:36:51.187686+00	windsurf	ui-client	\N
155	19	Title	"Create Select Project Tool with Cross-Session Synchronization"	0	2025-07-31 11:21:05.562759+00	2025-07-31 16:12:09.674012+00	windsurf	ui-client	\N
156	19	Description	"Create a select project tool that establishes global project selection state management across all MCP-connected sessions. This tool should enable:\\n1. **Cross-Session Synchronization**: When a project is selected in the UI, all connected MCP tools (including Windsurf and other agents) should automatically use that project as the default context\\n2. **Bidirectional Updates**: Changes made via any MCP tool (like select_project) should reflect immediately in the UI\\n3. **Persistent State**: Project selection should persist across browser sessions and MCP reconnections\\n4. **Real-time Propagation**: Instant synchronization of project selection across all connected clients\\n5. **Fallback Handling**: Graceful handling when MCP server is disconnected\\nThe implementation must investigate the current project selection architecture, research MCP state synchronization patterns, and provide comprehensive documentation for integration across all system components."	1	2025-07-31 11:21:05.562759+00	2025-07-31 16:12:09.674012+00	windsurf	ui-client	\N
159	19	Summary	"Develop a comprehensive select project tool that enables project selection synchronization across all connected MCP sessions, including UI, Windsurf, and other tools. The tool should propagate project selection state globally so that when a user selects a project in any interface, all connected agents automatically use that project context for subsequent operations."	4	2025-07-31 11:21:05.562759+00	2025-07-31 11:21:05.562759+00	windsurf	windsurf	\N
237	28	Notes	"**Technical Requirements:**\\n- Review all files and modules related to task 6 functionality\\n- Analyze code architecture and design patterns used\\n- Check for adherence to coding standards and best practices\\n- Identify any performance bottlenecks or optimization opportunities\\n- Document current dependencies and their versions\\n\\n**Business Context:**\\n- Understanding current implementation helps inform future development decisions\\n- Code review ensures maintainability and scalability\\n- Assessment will guide refactoring or enhancement efforts\\n\\n**Dependencies:**\\n- Access to the complete codebase repository\\n- Understanding of task 6's specific requirements and scope\\n- Development environment setup for testing if needed\\n\\n**Acceptance Criteria:**\\n- Complete inventory of files related to task 6\\n- Documentation of current code structure and flow\\n- List of identified issues, technical debt, or improvement opportunities\\n- Assessment of code quality metrics (if applicable)\\n- Recommendations for next steps based on findings"	2	2025-08-04 10:13:47.367979+00	2025-08-04 10:13:47.367979+00	unknown	unknown	\N
157	19	Notes	"## Implementation Complete ✅\\n\\nSuccessfully implemented a comprehensive cross-session project selection synchronization system that enables seamless project context sharing across all MCP-connected sessions.\\n\\n### Key Achievements\\n\\n**✅ Database Schema Enhancement**\\n- Added `global_state` table for persistent state storage\\n- Implemented database migration with proper indexing\\n- Added global state CRUD operations to DatabaseService\\n\\n**✅ MCP Tools Implementation**  \\n- `select_project` tool with validation and database persistence\\n- `get_selected_project` tool for current selection retrieval\\n- Real-time event broadcasting to all connected MCP sessions\\n- Enhanced task tools to auto-use selected project context\\n\\n**✅ Real-time Synchronization Architecture**\\n- Global event emitter system for state change notifications\\n- Connection manager broadcasting via MCP notification system\\n- Cross-session state propagation excluding source client (prevents loops)\\n\\n**✅ UI Integration & Enhancement**\\n- Enhanced ProjectContext with bidirectional MCP synchronization\\n- Cross-tab storage service using BroadcastChannel API\\n- localStorage persistence with cross-tab synchronization\\n- Automatic sync on MCP connection/reconnection\\n\\n**✅ Error Handling & Resilience**\\n- Offline mode support with local state preservation\\n- Graceful fallback mechanisms for MCP disconnection\\n- Connection loss indicators and automatic retry logic\\n- Conflict resolution with server authority pattern\\n\\n**✅ Tool Integration**\\n- Task creation tools automatically use selected project\\n- Enhanced project displays in task lists and individual tasks\\n- Project name resolution in all tool outputs\\n\\n### Technical Architecture\\n\\n- **Database Layer**: `global_state` table with JSONB storage\\n- **Event System**: Global singleton event emitter with MCP broadcasting  \\n- **UI Synchronization**: BroadcastChannel + localStorage with subscription pattern\\n- **Error Handling**: Multi-layer fallback with offline mode support\\n- **Cross-Client Sync**: Real-time MCP notifications across all connected sessions\\n\\n### Files Created/Modified\\n\\n**Database:**\\n- `database/migration_global_state.sql`\\n\\n**MCP Server:**\\n- `mcp/src/database.ts` (global state methods)\\n- `mcp/src/tools/project-tools.ts` (new tools)\\n- `mcp/src/tools/task-tools.ts` (auto-project selection)\\n- `mcp/src/events/state-events.ts` (event system)\\n- `mcp/src/server/connection-manager.ts` (broadcasting)\\n\\n**UI:**\\n- `ui/src/contexts/ProjectContext.tsx` (enhanced sync)\\n- `ui/src/services/projectStorageService.ts` (cross-tab storage)\\n\\n**Documentation:**\\n- `PROJECT_SELECTION_SYNC.md` (comprehensive guide)\\n\\n### Testing Status\\n\\n- ✅ All TypeScript compilation passes\\n- ✅ Database migration executed successfully  \\n- ✅ MCP server builds and starts successfully\\n- ✅ UI builds without errors\\n- ✅ Architecture supports manual testing scenarios\\n\\nThe implementation provides seamless project selection synchronization across Windsurf, Claude Desktop, UI, and any other MCP-connected clients with robust offline support and error handling."	2	2025-07-31 11:21:05.562759+00	2025-07-31 12:19:47.612186+00	windsurf	claude-code	\N
158	19	Items	"- [ ] Analyze current project selection implementation in ProjectContext.tsx and related components\\n- [ ] Research MCP shared state synchronization patterns and best practices\\n- [ ] Design global project selection state management architecture\\n- [ ] Implement select_project MCP tool with cross-session synchronization\\n- [ ] Create project selection event system for real-time updates\\n- [ ] Add localStorage-based persistence for project selection state\\n- [ ] Implement bidirectional synchronization between UI and MCP tools\\n- [ ] Update all existing tools to respect global project selection\\n- [ ] Create comprehensive documentation for integration patterns\\n- [ ] Add error handling and fallback mechanisms for disconnected states\\n- [ ] Implement project selection UI indicators across all interfaces\\n- [ ] Create migration guide for existing project-based tools\\n- [ ] Add comprehensive testing for synchronization scenarios"	3	2025-07-31 11:21:05.562759+00	2025-07-31 16:12:09.674012+00	windsurf	ui-client	\N
223	26	Title	"Update Branding to Project Flows Across All Pages"	0	2025-08-04 09:43:21.645056+00	2025-08-04 09:43:21.645056+00	tst	tst	\N
224	26	Description	"Ensure consistent Project Flows branding is present on every page of the application, replacing any instances of \\"your app\\" or other inconsistent branding."	1	2025-08-04 09:43:21.645056+00	2025-08-04 09:43:21.645056+00	tst	tst	\N
225	26	Notes	"## Background\\nThe application currently has inconsistent branding across pages, with some references to \\"your app\\" or other inconsistent terminology instead of \\"Project Flows\\".\\n\\n## Requirements\\n- All pages should consistently use \\"Project Flows\\" branding\\n- This includes headers, footers, titles, navigation elements, and any other UI components\\n- Text content, meta tags, and documentation should also be updated\\n- Maintain visual consistency with the Project Flows brand identity\\n\\n## Acceptance Criteria\\n- All pages display \\"Project Flows\\" branding consistently\\n- No instances of \\"your app\\" or other inconsistent branding remain\\n- Branding is visually consistent across the application\\n- All documentation references use correct branding"	2	2025-08-04 09:43:21.645056+00	2025-08-04 09:43:21.645056+00	tst	tst	\N
226	26	Items	"- [ ] Audit all pages and components for existing branding references\\n- [ ] Create an inventory of locations requiring updates (page names, line numbers, components)\\n- [ ] Update page titles and meta tags to reflect Project Flows branding\\n- [ ] Update headers, footers, and navigation elements\\n- [ ] Update any in-app text references to the application name\\n- [ ] Update documentation and help text\\n- [ ] Review all UI components for consistent branding\\n- [ ] Test changes across different screen sizes and devices\\n- [ ] Verify all branding is consistent with Project Flows guidelines\\n- [ ] Create PR with all branding updates"	3	2025-08-04 09:43:21.645056+00	2025-08-04 09:43:21.645056+00	tst	tst	\N
227	27	Title	"Remove All Projects Except ID 1 and Rename to Project Flows"	0	2025-08-04 09:45:40.96085+00	2025-08-04 09:48:38.177075+00	tst	tst	\N
228	27	Description	"Remove all projects from the database except for the live project with ID 1 (Website Redesign), then rename project ID 1 to \\"Project Flows\\"."	1	2025-08-04 09:45:40.96085+00	2025-08-04 09:48:38.177075+00	tst	tst	\N
229	27	Notes	"Current projects in the database:\\n- ID 1: Website Redesign (keep this one and rename to \\"Project Flows\\")\\n- ID 6: test\\n- ID 7: Mobile App\\n- ID 8: API Integration\\n- ID 9: Bug Fixes\\n- ID 10: Documentation\\n\\nAll projects except ID 1 need to be removed from the database. After removing the other projects, project ID 1 should be renamed from \\"Website Redesign\\" to \\"Project Flows\\"."	2	2025-08-04 09:45:40.96085+00	2025-08-04 09:48:38.177075+00	tst	tst	\N
230	27	Items	"- [ ] Verify current projects in the database\\n- [ ] Remove project ID 6 (test)\\n- [ ] Remove project ID 7 (Mobile App)\\n- [ ] Remove project ID 8 (API Integration)\\n- [ ] Remove project ID 9 (Bug Fixes)\\n- [ ] Remove project ID 10 (Documentation)\\n- [ ] Rename project ID 1 from \\"Website Redesign\\" to \\"Project Flows\\"\\n- [ ] Verify only project ID 1 remains and is renamed to \\"Project Flows\\""	3	2025-08-04 09:45:40.96085+00	2025-08-04 09:48:38.177075+00	tst	tst	\N
235	28	Title	"Examine current codebase for task 6"	0	2025-08-04 10:13:47.367979+00	2025-08-04 10:13:47.367979+00	unknown	unknown	\N
236	28	Description	"Conduct a comprehensive review and analysis of the existing codebase specifically related to task 6. This examination is needed to understand the current implementation, identify any technical debt, assess code quality, and determine what modifications or improvements may be required."	1	2025-08-04 10:13:47.367979+00	2025-08-04 10:13:47.367979+00	unknown	unknown	\N
238	28	Items	"- [ ] Set up development environment and ensure access to codebase\\n- [ ] Identify all files, modules, and components related to task 6\\n- [ ] Review main implementation files and core functionality\\n- [ ] Analyze code architecture and design patterns\\n- [ ] Check adherence to coding standards and conventions\\n- [ ] Review error handling and edge case coverage\\n- [ ] Assess test coverage and quality of existing tests\\n- [ ] Identify any performance issues or optimization opportunities\\n- [ ] Document current dependencies and their compatibility\\n- [ ] Review comments and documentation quality\\n- [ ] Check for security vulnerabilities or concerns\\n- [ ] Analyze database queries or data access patterns (if applicable)\\n- [ ] Review API endpoints or interfaces (if applicable)\\n- [ ] Document findings in a comprehensive report\\n- [ ] Provide recommendations for improvements or next steps"	3	2025-08-04 10:13:47.367979+00	2025-08-04 10:13:47.367979+00	unknown	unknown	\N
239	29	Title	"Merge tasks and projects tables with parent-child hierarchy"	0	2025-08-04 10:18:24.049499+00	2025-08-04 10:18:24.049499+00	claude-code	claude-code	\N
240	29	Description	"Refactor the database schema to merge projects and tasks into a unified tasks table with parent-child relationships. This involves renaming project_id to parent_id, migrating existing project data as parent tasks, updating all references, and ensuring UI components continue to work seamlessly."	1	2025-08-04 10:18:24.049499+00	2025-08-04 10:18:24.049499+00	claude-code	claude-code	\N
241	29	Notes	"**Technical Requirements:**\\n- Database schema migration to merge tables\\n- Rename project_id column to parent_id in tasks table\\n- Migrate existing project data as parent tasks\\n- Update MCP tools to handle parent-child relationships\\n- Maintain backward compatibility during transition\\n- Update UI components to work with new schema\\n\\n**Business Constraints:**\\n- Zero data loss during migration\\n- Maintain existing functionality\\n- Preserve audit trails and relationships\\n- Ensure real-time updates still work\\n\\n**Dependencies:**\\n- Database migration scripts\\n- MCP server tool updates\\n- UI component refactoring\\n- Template system updates\\n\\n**Acceptance Criteria:**\\n- All existing projects become parent tasks\\n- All existing tasks maintain their relationships via parent_id\\n- UI displays projects and tasks in hierarchical structure\\n- All MCP tools work with new schema\\n- No data loss or corruption\\n- All tests pass\\n\\n**Edge Cases:**\\n- Handle orphaned tasks (tasks without projects)\\n- Ensure proper cascading for deletions\\n- Maintain proper audit trail during migration\\n- Handle concurrent operations during migration"	2	2025-08-04 10:18:24.049499+00	2025-08-04 10:18:24.049499+00	claude-code	claude-code	\N
242	29	Items	"## Database Schema Changes\\n- [ ] Create migration script to add parent_id column to tasks table\\n- [ ] Create migration script to rename project_id to parent_id in tasks table\\n- [ ] Create script to migrate project data from projects table to tasks table as parent entries\\n- [ ] Update tasks table to reference parent tasks via parent_id\\n- [ ] Create new template entry for \\"Projects\\" in templates table\\n- [ ] Remove/deprecate projects table after successful migration\\n\\n## MCP Server Updates\\n- [ ] Update task creation tools to handle parent-child relationships\\n- [ ] Modify get_task tool to include parent/child information\\n- [ ] Update update_task tool to support parent_id operations\\n- [ ] Add tools for creating project-type tasks\\n- [ ] Update schema property validation for parent-child relationships\\n- [ ] Test all MCP tools with new schema\\n\\n## UI Component Updates\\n- [ ] Update project selection components to work with tasks table\\n- [ ] Modify task board to display hierarchical structure\\n- [ ] Update project creation/editing forms to create tasks instead\\n- [ ] Ensure drag-and-drop still works with parent-child relationships\\n- [ ] Update project context providers to use tasks table\\n- [ ] Test all UI workflows with new schema\\n\\n## Data Migration\\n- [ ] Backup current database before migration\\n- [ ] Run migration scripts in development environment\\n- [ ] Validate data integrity after migration\\n- [ ] Test with production-like data volumes\\n- [ ] Create rollback plan in case of issues\\n\\n## Testing & Validation\\n- [ ] Run full test suite after migration\\n- [ ] Test MCP client connections and operations\\n- [ ] Validate UI functionality across all components\\n- [ ] Performance testing with hierarchical queries\\n- [ ] Integration testing with real-world scenarios\\n- [ ] User acceptance testing"	3	2025-08-04 10:18:24.049499+00	2025-08-04 10:18:24.049499+00	claude-code	claude-code	\N
\.


--
-- Data for Name: global_state; Type: TABLE DATA; Schema: public; Owner: mcp_user
--

COPY public.global_state (key, value, created_at, updated_at, created_by, updated_by) FROM stdin;
selected_project_id	1	2025-07-31 12:11:26.930125+00	2025-08-04 09:39:56.644716+00	system	ui-client
\.


--
-- Data for Name: projects; Type: TABLE DATA; Schema: public; Owner: mcp_user
--

COPY public.projects (id, name, description, color, created_at, updated_at, created_by, updated_by) FROM stdin;
1	Website Redesign	Complete overhaul of company website with modern design	#3b82f6	2025-07-30 14:51:03.045391+00	2025-07-30 14:51:03.045391+00	system	system
7	Mobile App	Development of cross-platform mobile application	#10b981	2025-07-30 15:27:40.576398+00	2025-07-30 15:27:40.576398+00	system	system
8	API Integration	Integration with third-party APIs and services	#f59e0b	2025-07-30 15:27:40.576398+00	2025-07-30 15:27:40.576398+00	system	system
9	Bug Fixes	General bug fixes and maintenance tasks	#ef4444	2025-07-30 15:27:40.576398+00	2025-07-30 15:27:40.576398+00	system	system
10	Documentation	Technical documentation and user guides	#8b5cf6	2025-07-30 15:27:40.576398+00	2025-07-30 15:27:40.576398+00	system	system
6	test	test	#3b82f6	2025-07-30 15:22:00.22372+00	2025-07-30 15:34:52.643987+00	ui-client	ui-client
\.


--
-- Data for Name: properties; Type: TABLE DATA; Schema: public; Owner: mcp_user
--

COPY public.properties (id, template_id, key, type, description, dependencies, execution_order, fixed, created_by, updated_by, created_at, updated_at, user_id) FROM stdin;
1	1	Description	text	Description of the original request or problem statement. Include the 'what' and 'why' - what needs to be accomplished and why it's important.	{}	2	f	system	ui-client	2025-07-24 08:49:24.202802+00	2025-07-28 14:00:11.811954+00	1
2	1	Notes	text	Comprehensive context including: technical requirements, business constraints, dependencies, acceptance criteria, edge cases, and background information that impacts implementation decisions.	{}	3	f	system	ui-client	2025-07-24 08:49:24.202802+00	2025-07-28 14:00:11.818256+00	1
3	1	Items	text	Markdown checklist of specific, actionable, and measurable steps. Each item should be concrete enough that completion can be verified.	{}	4	f	system	ui-client	2025-07-24 08:49:24.202802+00	2025-07-28 14:00:11.825921+00	1
4	1	Title	text	Clear, specific, and actionable task title. Use action verbs and be precise about what needs to be accomplished. Examples: 'Implement user login with OAuth', 'Fix database connection timeout issue', 'Design API endpoints for user management'	{}	1	f	ui-client	ui-client	2025-07-28 09:14:48.84509+00	2025-07-28 14:00:34.93918+00	\N
\.


--
-- Data for Name: tasks; Type: TABLE DATA; Schema: public; Owner: mcp_user
--

COPY public.tasks (id, stage, created_at, updated_at, created_by, updated_by, user_id, project_id) FROM stdin;
19	completed	2025-07-31 11:21:05.562759+00	2025-07-31 16:12:09.674012+00	windsurf	ui-client	\N	1
8	completed	2025-07-25 10:07:28.609398+00	2025-07-30 15:34:07.471213+00	claude-code	ui-client	\N	1
9	completed	2025-07-25 10:07:50.343835+00	2025-07-30 15:34:07.471213+00	claude-code	ui-client	\N	1
12	completed	2025-07-28 12:03:31.485677+00	2025-07-30 15:34:07.471213+00	windsurf	windsurf	\N	1
3	completed	2025-07-24 15:06:46.891743+00	2025-07-30 15:34:07.471213+00	claude-code	ui-client	\N	1
14	completed	2025-07-28 14:47:27.096353+00	2025-07-30 15:34:07.471213+00	windsurf	ui-client	\N	1
16	completed	2025-07-29 09:12:18.45201+00	2025-07-30 15:34:07.471213+00	windsurf	ui-client	\N	1
11	completed	2025-07-28 11:21:52.891576+00	2025-07-30 15:34:07.471213+00	windsurf	ui-client	\N	1
17	completed	2025-07-29 13:16:20.812565+00	2025-07-30 15:34:07.471213+00	windsurf	ui-client	\N	1
10	completed	2025-07-28 11:15:51.794304+00	2025-07-30 15:34:07.471213+00	windsurf	claude-code	\N	1
26	draft	2025-08-04 09:43:21.645056+00	2025-08-04 09:43:21.645056+00	tst	tst	\N	1
27	draft	2025-08-04 09:45:40.96085+00	2025-08-04 09:45:40.96085+00	tst	tst	\N	1
28	draft	2025-08-04 10:13:47.367979+00	2025-08-04 10:13:47.367979+00	unknown	unknown	\N	1
29	draft	2025-08-04 10:18:24.049499+00	2025-08-04 10:18:24.049499+00	claude-code	claude-code	\N	1
\.


--
-- Data for Name: templates; Type: TABLE DATA; Schema: public; Owner: mcp_user
--

COPY public.templates (id, name, description, created_at, updated_at, created_by, updated_by, user_id) FROM stdin;
1	Task	Default template for managing tasks	2025-07-24 08:49:24.200024+00	2025-07-24 08:49:24.200024+00	system	system	1
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: mcp_user
--

COPY public.users (id, email, password_hash, first_name, last_name, is_active, email_verified, last_login, created_at, updated_at) FROM stdin;
1	admin@local.dev	$2b$10$rOvHFJjOqyXVqYf9RmEMzep6F7DxFLqEw/FRWJxD7QK0oY.iSHGNm	Admin	User	t	t	\N	2025-07-24 08:49:24.406284+00	2025-07-24 08:49:24.406284+00
2	direct@test.com	hashedpass	Direct	User	t	f	\N	2025-07-24 14:03:12.198132+00	2025-07-24 14:03:12.198132+00
\.


--
-- Name: blocks_id_seq; Type: SEQUENCE SET; Schema: public; Owner: mcp_user
--

SELECT pg_catalog.setval('public.blocks_id_seq', 242, true);


--
-- Name: projects_id_seq; Type: SEQUENCE SET; Schema: public; Owner: mcp_user
--

SELECT pg_catalog.setval('public.projects_id_seq', 10, true);


--
-- Name: properties_id_seq; Type: SEQUENCE SET; Schema: public; Owner: mcp_user
--

SELECT pg_catalog.setval('public.properties_id_seq', 4, true);


--
-- Name: tasks_id_seq; Type: SEQUENCE SET; Schema: public; Owner: mcp_user
--

SELECT pg_catalog.setval('public.tasks_id_seq', 29, true);


--
-- Name: templates_id_seq; Type: SEQUENCE SET; Schema: public; Owner: mcp_user
--

SELECT pg_catalog.setval('public.templates_id_seq', 1, true);


--
-- Name: users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: mcp_user
--

SELECT pg_catalog.setval('public.users_id_seq', 2, true);


--
-- Name: blocks blocks_pkey; Type: CONSTRAINT; Schema: public; Owner: mcp_user
--

ALTER TABLE ONLY public.blocks
    ADD CONSTRAINT blocks_pkey PRIMARY KEY (id);


--
-- Name: blocks blocks_task_id_property_name_key; Type: CONSTRAINT; Schema: public; Owner: mcp_user
--

ALTER TABLE ONLY public.blocks
    ADD CONSTRAINT blocks_task_id_property_name_key UNIQUE (task_id, property_name);


--
-- Name: global_state global_state_pkey; Type: CONSTRAINT; Schema: public; Owner: mcp_user
--

ALTER TABLE ONLY public.global_state
    ADD CONSTRAINT global_state_pkey PRIMARY KEY (key);


--
-- Name: projects projects_pkey; Type: CONSTRAINT; Schema: public; Owner: mcp_user
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_pkey PRIMARY KEY (id);


--
-- Name: properties properties_pkey; Type: CONSTRAINT; Schema: public; Owner: mcp_user
--

ALTER TABLE ONLY public.properties
    ADD CONSTRAINT properties_pkey PRIMARY KEY (id);


--
-- Name: properties properties_template_id_key_key; Type: CONSTRAINT; Schema: public; Owner: mcp_user
--

ALTER TABLE ONLY public.properties
    ADD CONSTRAINT properties_template_id_key_key UNIQUE (template_id, key);


--
-- Name: tasks tasks_pkey; Type: CONSTRAINT; Schema: public; Owner: mcp_user
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_pkey PRIMARY KEY (id);


--
-- Name: templates templates_pkey; Type: CONSTRAINT; Schema: public; Owner: mcp_user
--

ALTER TABLE ONLY public.templates
    ADD CONSTRAINT templates_pkey PRIMARY KEY (id);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: mcp_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: mcp_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: idx_blocks_position; Type: INDEX; Schema: public; Owner: mcp_user
--

CREATE INDEX idx_blocks_position ON public.blocks USING btree (task_id, "position");


--
-- Name: idx_blocks_property_name; Type: INDEX; Schema: public; Owner: mcp_user
--

CREATE INDEX idx_blocks_property_name ON public.blocks USING btree (property_name);


--
-- Name: idx_blocks_task_id; Type: INDEX; Schema: public; Owner: mcp_user
--

CREATE INDEX idx_blocks_task_id ON public.blocks USING btree (task_id);


--
-- Name: idx_blocks_user_id; Type: INDEX; Schema: public; Owner: mcp_user
--

CREATE INDEX idx_blocks_user_id ON public.blocks USING btree (user_id);


--
-- Name: idx_global_state_key; Type: INDEX; Schema: public; Owner: mcp_user
--

CREATE INDEX idx_global_state_key ON public.global_state USING btree (key);


--
-- Name: idx_projects_created_by; Type: INDEX; Schema: public; Owner: mcp_user
--

CREATE INDEX idx_projects_created_by ON public.projects USING btree (created_by);


--
-- Name: idx_projects_name; Type: INDEX; Schema: public; Owner: mcp_user
--

CREATE INDEX idx_projects_name ON public.projects USING btree (name);


--
-- Name: idx_properties_user_id; Type: INDEX; Schema: public; Owner: mcp_user
--

CREATE INDEX idx_properties_user_id ON public.properties USING btree (user_id);


--
-- Name: idx_tasks_project_id; Type: INDEX; Schema: public; Owner: mcp_user
--

CREATE INDEX idx_tasks_project_id ON public.tasks USING btree (project_id);


--
-- Name: idx_tasks_user_id; Type: INDEX; Schema: public; Owner: mcp_user
--

CREATE INDEX idx_tasks_user_id ON public.tasks USING btree (user_id);


--
-- Name: idx_templates_user_id; Type: INDEX; Schema: public; Owner: mcp_user
--

CREATE INDEX idx_templates_user_id ON public.templates USING btree (user_id);


--
-- Name: idx_users_active; Type: INDEX; Schema: public; Owner: mcp_user
--

CREATE INDEX idx_users_active ON public.users USING btree (is_active);


--
-- Name: idx_users_email; Type: INDEX; Schema: public; Owner: mcp_user
--

CREATE INDEX idx_users_email ON public.users USING btree (email);


--
-- Name: blocks update_blocks_updated_at; Type: TRIGGER; Schema: public; Owner: mcp_user
--

CREATE TRIGGER update_blocks_updated_at BEFORE UPDATE ON public.blocks FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: global_state update_global_state_updated_at; Type: TRIGGER; Schema: public; Owner: mcp_user
--

CREATE TRIGGER update_global_state_updated_at BEFORE UPDATE ON public.global_state FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: projects update_projects_updated_at; Type: TRIGGER; Schema: public; Owner: mcp_user
--

CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: properties update_properties_updated_at; Type: TRIGGER; Schema: public; Owner: mcp_user
--

CREATE TRIGGER update_properties_updated_at BEFORE UPDATE ON public.properties FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: tasks update_tasks_updated_at; Type: TRIGGER; Schema: public; Owner: mcp_user
--

CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: users update_users_updated_at; Type: TRIGGER; Schema: public; Owner: mcp_user
--

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: blocks blocks_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: mcp_user
--

ALTER TABLE ONLY public.blocks
    ADD CONSTRAINT blocks_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.tasks(id) ON DELETE CASCADE;


--
-- Name: blocks blocks_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: mcp_user
--

ALTER TABLE ONLY public.blocks
    ADD CONSTRAINT blocks_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: properties properties_template_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: mcp_user
--

ALTER TABLE ONLY public.properties
    ADD CONSTRAINT properties_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.templates(id) ON DELETE CASCADE;


--
-- Name: properties properties_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: mcp_user
--

ALTER TABLE ONLY public.properties
    ADD CONSTRAINT properties_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: tasks tasks_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: mcp_user
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE SET NULL;


--
-- Name: tasks tasks_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: mcp_user
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: templates templates_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: mcp_user
--

ALTER TABLE ONLY public.templates
    ADD CONSTRAINT templates_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: mcp_user
--

REVOKE USAGE ON SCHEMA public FROM PUBLIC;


--
-- PostgreSQL database dump complete
--


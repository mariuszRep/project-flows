import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { ListToolsRequestSchema, CallToolRequestSchema, Tool } from "@modelcontextprotocol/sdk/types.js";
import { SchemaProperties, ExecutionChainItem, ToolContext } from "../types/property.js";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import DatabaseService from "../database.js";
import { createPropertyTools } from "../tools/property-tools.js";
import { createObjectTools } from "../tools/object-tools.js";
import { createTaskTools } from "../tools/task-tools.js";
import { createProjectTools } from "../tools/project-tools.js";
import { createEpicTools } from "../tools/epic-tools.js";
import { createRuleTools } from "../tools/rule-tools.js";
import { createWorkflowTools } from "../tools/workflow-tools.js";
import { createTemplateTools } from "../tools/template-tools.js";
import { WorkflowDefinition, WorkflowExecutor } from "../tools/workflow-executor.js";
import pg from 'pg';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Global in-memory storage for dynamic workflow tools
const dynamicWorkflows = new Map<string, WorkflowDefinition>();
const workflowTemplateMap = new Map<string, number>(); // Maps tool name to template_id
let workflowExecutor: WorkflowExecutor;

/**
 * Load workflows from database and register them as dynamic MCP tools
 */
async function loadWorkflowsFromDatabase(dbService: DatabaseService): Promise<void> {
  try {
    console.log('Loading workflows from database...');

    // Get all templates
    const templates = await dbService.getTemplates();

    // Filter workflow templates that are published
    const workflowTemplates = templates.filter((t: any) => {
      const metadata = t.metadata || {};
      return t.type === 'workflow' && metadata.published === true;
    });

    console.log(`Found ${workflowTemplates.length} published workflow(s)`);

    // Clear existing workflows
    dynamicWorkflows.clear();
    workflowTemplateMap.clear();

    // Load each workflow
    for (const template of workflowTemplates) {
      try {
        // Load workflow definition using workflow executor (extracts tool name from start node)
        const workflow = await workflowExecutor.loadWorkflowFromDatabase(template.id);

        if (!workflow) {
          console.warn(`Failed to load workflow definition for template ${template.id}`);
          continue;
        }

        // Check for duplicate tool names
        if (dynamicWorkflows.has(workflow.name)) {
          console.error(`⚠️  Duplicate tool name detected: ${workflow.name} (template_id: ${template.id}). Skipping.`);
          continue;
        }

        // Register workflow
        dynamicWorkflows.set(workflow.name, workflow);
        workflowTemplateMap.set(workflow.name, template.id);

        console.log(`✅ Registered workflow: ${workflow.name} (template_id: ${template.id})`);
        console.log(`   Steps loaded: ${workflow.steps.length}`);
      } catch (error) {
        console.error(`Error loading workflow template ${template.id}:`, error);
      }
    }

    console.log(`Successfully registered ${dynamicWorkflows.size} workflow tool(s)`);
  } catch (error) {
    console.error('Error loading workflows from database:', error);
  }
}

export function createMcpServer(clientId: string = 'unknown', sharedDbService: DatabaseService): Server {
  const server = new Server(
    {
      name: "project-flows",
      version: "1.0.0",
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // Simple in-memory cache for schema properties with context support
  const schemaCache = new Map<string, { properties: SchemaProperties; timestamp: number }>();
  const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  function generateCacheKey(templateId: number, context?: ToolContext): string {
    if (!context) {
      return `schema_${templateId}`;
    }
    
    const contextHash = JSON.stringify({
      projectId: context.projectId,
      userRole: context.userRole,
      parentTaskId: context.parentTaskId,
      clientId: context.clientId
    });
    
    return `schema_${templateId}_${Buffer.from(contextHash).toString('base64')}`;
  }

  function getCachedSchema(templateId: number, context?: ToolContext): SchemaProperties | null {
    const key = generateCacheKey(templateId, context);
    const cached = schemaCache.get(key);
    
    if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
      return cached.properties;
    }
    
    // Clean expired entry
    if (cached) {
      schemaCache.delete(key);
    }
    
    return null;
  }

  function setCachedSchema(templateId: number, properties: SchemaProperties, context?: ToolContext): void {
    const key = generateCacheKey(templateId, context);
    schemaCache.set(key, {
      properties: { ...properties }, // Clone to prevent mutation
      timestamp: Date.now()
    });
  }

  function invalidateCache(templateId?: number): void {
    if (templateId !== undefined) {
      // Invalidate all cache entries for specific template
      const keysToDelete: string[] = [];
      for (const key of schemaCache.keys()) {
        if (key.startsWith(`schema_${templateId}`)) {
          keysToDelete.push(key);
        }
      }
      keysToDelete.forEach(key => schemaCache.delete(key));
    } else {
      // Clear entire cache
      schemaCache.clear();
    }
  }

  // Database change monitoring setup
  let notificationClient: pg.Client | null = null;

  async function setupDatabaseNotifications(): Promise<void> {
    try {
      const { Client } = pg;
      notificationClient = new Client({
        connectionString: process.env.DATABASE_URL || 'postgresql://mcp_user:mcp_password@localhost:5432/mcp_tasks',
      });

      await notificationClient.connect();
      console.log('Connected to PostgreSQL for notifications');

      // Listen for schema changes
      await notificationClient.query('LISTEN schema_changed');

      notificationClient.on('notification', (msg) => {
        try {
          if (msg.channel === 'schema_changed' && msg.payload) {
            const notification = JSON.parse(msg.payload);
            console.log('Schema change notification received:', notification);

            // Invalidate cache based on notification
            if (notification.template_id) {
              invalidateCache(notification.template_id);
            } else {
              invalidateCache(); // Clear all cache if template_id not specified
            }

            // Trigger tools/changed notification
            notifyToolsChanged().catch(console.error);
          }
        } catch (error) {
          console.error('Error processing schema change notification:', error);
        }
      });

      notificationClient.on('error', (error) => {
        console.error('PostgreSQL notification client error:', error);
        // Attempt to reconnect after a delay
        setTimeout(() => {
          setupDatabaseNotifications().catch(console.error);
        }, 5000);
      });

    } catch (error) {
      console.error('Failed to setup database notifications:', error);
    }
  }

  function cleanupDatabaseNotifications(): void {
    if (notificationClient) {
      notificationClient.end().catch(console.error);
      notificationClient = null;
    }
  }

  // MCP tools changed notification
  async function notifyToolsChanged(): Promise<void> {
    try {
      // Note: The MCP SDK may not have built-in support for tools/changed notifications
      // This is a placeholder for when the feature becomes available
      console.log('Tools schema changed - clients should refresh tool definitions');
      
      // If the server supports notifications, we could send them here
      // server.sendNotification('tools/changed', {});
    } catch (error) {
      console.error('Error sending tools changed notification:', error);
    }
  }

  // Start database notification monitoring
  setupDatabaseNotifications().catch(console.error);

  // Cleanup on process exit
  process.on('exit', cleanupDatabaseNotifications);
  process.on('SIGINT', cleanupDatabaseNotifications);
  process.on('SIGTERM', cleanupDatabaseNotifications);

  async function loadDynamicSchemaProperties(): Promise<SchemaProperties>;
  async function loadDynamicSchemaProperties(context: ToolContext): Promise<SchemaProperties>;
  async function loadDynamicSchemaProperties(context?: ToolContext): Promise<SchemaProperties> {
    // Check cache first
    const cached = getCachedSchema(1, context);
    if (cached) {
      return cached;
    }

    try {
      // Load task properties only (template_id = 1)
      const properties = context 
        ? await sharedDbService.getSchemaProperties(1, context)
        : await sharedDbService.getSchemaProperties(1);
      
      // Cache the result
      setCachedSchema(1, properties, context);
      
      return properties;
    } catch (error) {
      console.error('Error loading schema properties from database:', error);
      // Fallback to file-based loading (no context support in fallback)
      if (!context) {
        try {
          const schemaFile = join(__dirname, "..", "..", "schema_properties.json");
          const data = readFileSync(schemaFile, "utf8");
          const properties = JSON.parse(data);
          
          // Cache the fallback result
          setCachedSchema(1, properties, context);
          
          return properties;
        } catch (fallbackError) {
          console.error('Fallback file loading also failed:', fallbackError);
          return {};
        }
      } else {
        // With context but database failed, return empty
        return {};
      }
    }
  }

  async function loadProjectSchemaProperties(): Promise<SchemaProperties>;
  async function loadProjectSchemaProperties(context: ToolContext): Promise<SchemaProperties>;
  async function loadProjectSchemaProperties(context?: ToolContext): Promise<SchemaProperties> {
    // Check cache first
    const cached = getCachedSchema(2, context);
    if (cached) {
      return cached;
    }

    try {
      // Load project properties (template_id = 2)
      const properties = context
        ? await sharedDbService.getSchemaProperties(2, context)
        : await sharedDbService.getSchemaProperties(2);
      
      // Cache the result
      setCachedSchema(2, properties, context);
      
      return properties;
    } catch (error) {
      console.error('Error loading project schema properties from database:', error);
      return {};
    }
  }

  async function loadEpicSchemaProperties(): Promise<SchemaProperties>;
  async function loadEpicSchemaProperties(context: ToolContext): Promise<SchemaProperties>;
  async function loadEpicSchemaProperties(context?: ToolContext): Promise<SchemaProperties> {
    // Check cache first
    const cached = getCachedSchema(3, context);
    if (cached) {
      return cached;
    }

    try {
      // Load epic properties (template_id = 3)
      const properties = context
        ? await sharedDbService.getSchemaProperties(3, context)
        : await sharedDbService.getSchemaProperties(3);

      // Cache the result
      setCachedSchema(3, properties, context);

      return properties;
    } catch (error) {
      console.error('Error loading epic schema properties from database:', error);
      return {};
    }
  }

  async function loadRuleSchemaProperties(): Promise<SchemaProperties>;
  async function loadRuleSchemaProperties(context: ToolContext): Promise<SchemaProperties>;
  async function loadRuleSchemaProperties(context?: ToolContext): Promise<SchemaProperties> {
    // Check cache first
    const cached = getCachedSchema(4, context);
    if (cached) {
      return cached;
    }

    try {
      // Load rule properties (template_id = 4)
      const properties = context
        ? await sharedDbService.getSchemaProperties(4, context)
        : await sharedDbService.getSchemaProperties(4);

      // Cache the result
      setCachedSchema(4, properties, context);

      return properties;
    } catch (error) {
      console.error('Error loading rule schema properties from database:', error);
      return {};
    }
  }


  function createExecutionChain(properties: SchemaProperties): ExecutionChainItem[] {
    const sortedProps: ExecutionChainItem[] = [];
    
    for (const [propName, propConfig] of Object.entries(properties)) {
      const executionOrder = propConfig.execution_order ?? 999;
      sortedProps.push({
        execution_order: executionOrder,
        prop_name: propName,
        prop_config: propConfig,
      });
    }
    
    return sortedProps.sort((a, b) => a.execution_order - b.execution_order);
  }

  function validateDependencies(
    properties: SchemaProperties,
    args: Record<string, any>,
    isUpdateContext: boolean = false
  ): boolean {
    for (const [propName, propConfig] of Object.entries(properties)) {
      const dependencies = propConfig.dependencies || [];
      // Only validate dependencies for properties that are actually provided and have values
      if (propName in args && args[propName]) {
        for (const dep of dependencies) {
          if (isUpdateContext) {
            // In update context, dependency must be provided in the same call
            if (!(dep in args) || !args[dep]) {
              return false;
            }
          } else {
            // In create context, allow base properties to be missing if they have defaults
            if (!(dep in args) || !args[dep]) {
              return false;
            }
          }
        }
      }
    }
    return true;
  }

  // Create tool handlers
  const propertyTools = createPropertyTools(sharedDbService, clientId);
  const templateTools = createTemplateTools(sharedDbService, clientId);

  // Create projectTools first (needed by other tools)
  const projectTools = createProjectTools(
    sharedDbService,
    clientId,
    loadProjectSchemaProperties,
    createExecutionChain,
    validateDependencies
  );

  // Create objectTools with all required dependencies
  const objectTools = createObjectTools(
    sharedDbService,
    clientId,
    createExecutionChain,
    validateDependencies,
    loadDynamicSchemaProperties,
    loadProjectSchemaProperties,
    loadEpicSchemaProperties,
    loadRuleSchemaProperties,
    projectTools
  );

  // Create task, epic, and rule tools
  const taskTools = createTaskTools(
    sharedDbService,
    clientId,
    loadDynamicSchemaProperties,
    createExecutionChain,
    validateDependencies,
    projectTools
  );

  const epicTools = createEpicTools(
    sharedDbService,
    clientId,
    loadEpicSchemaProperties,
    createExecutionChain,
    validateDependencies,
    projectTools
  );

  const ruleTools = createRuleTools(
    sharedDbService,
    clientId,
    loadRuleSchemaProperties,
    createExecutionChain,
    validateDependencies,
    projectTools
  );

  // Inject the correct toolsets: taskTools for task operations, projectTools for project operations, and epicTools for epic operations
  const workflowTools = createWorkflowTools(sharedDbService, clientId, taskTools, projectTools, objectTools, propertyTools, epicTools);

  // Initialize workflow executor with database service and tool caller
  const toolCaller = {
    callTool: async (toolName: string, parameters: Record<string, any>) => {
      // Route tool calls through the appropriate handlers
      if (objectTools.canHandle(toolName)) {
        return await objectTools.handle(toolName, parameters);
      }
      if (taskTools.canHandle(toolName)) {
        return await taskTools.handle(toolName, parameters);
      }
      if (projectTools.canHandle(toolName)) {
        return await projectTools.handle(toolName, parameters);
      }
      if (epicTools.canHandle(toolName)) {
        return await epicTools.handle(toolName, parameters);
      }
      if (ruleTools.canHandle(toolName)) {
        return await ruleTools.handle(toolName, parameters);
      }
      throw new Error(`Tool '${toolName}' not found or not callable from workflow`);
    }
  };

  workflowExecutor = new WorkflowExecutor(sharedDbService, toolCaller);

  // Load workflows from database at startup
  loadWorkflowsFromDatabase(sharedDbService).catch((error) => {
    console.error('Failed to load workflows from database:', error);
  });

  // Set up tool list handler
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    // Detect context from request if available (future enhancement)
    // For now, we could check for custom headers or other indicators
    let context: ToolContext | undefined = undefined;
    
    // Example: detect context from client ID or custom indicators
    // This could be extended to parse context from request metadata
    if (clientId && clientId !== 'unknown') {
      context = {
        clientId: clientId,
        // Additional context could be inferred or passed via other means
      };
    }

    // Get task properties (template_id = 1) with optional context
    const taskProperties = context 
      ? await loadDynamicSchemaProperties(context)
      : await sharedDbService.getSchemaProperties(1);
      
    // Get project properties (template_id = 2) with optional context
    const projectProperties = context
      ? await loadProjectSchemaProperties(context) 
      : await sharedDbService.getSchemaProperties(2);

    // Get epic properties (template_id = 3) with optional context
    const epicProperties = context
      ? await loadEpicSchemaProperties(context)
      : await sharedDbService.getSchemaProperties(3);

    // Get rule properties (template_id = 4) with optional context
    const ruleProperties = context
      ? await loadRuleSchemaProperties(context)
      : await sharedDbService.getSchemaProperties(4);

    // Clean properties for schema (remove execution metadata and convert types)
    function cleanSchemaProperties(properties: SchemaProperties): Record<string, any> {
      const schemaProperties: Record<string, any> = {};
      for (const [propName, propConfig] of Object.entries(properties)) {
        const cleanConfig: Record<string, any> = {};
        for (const [key, value] of Object.entries(propConfig)) {
          if (!["dependencies", "execution_order", "template_id", "id", "created_by", "updated_by", "created_at", "updated_at", "fixed"].includes(key)) {
            if (key === "type") {
              // Convert custom types to JSON Schema types
              switch (value) {
                case "text":
                  cleanConfig[key] = "string";
                  break;
                case "list":
                  cleanConfig[key] = "array";
                  cleanConfig["items"] = { "type": "string" };
                  break;
                case "number":
                  cleanConfig[key] = "number";
                  break;
                case "boolean":
                  cleanConfig[key] = "boolean";
                  break;
                default:
                  cleanConfig[key] = "string"; // fallback to string for unknown types
              }
            } else {
              cleanConfig[key] = value;
            }
          }
        }
        schemaProperties[propName] = cleanConfig;
      }
      return schemaProperties;
    }

    const taskSchemaProperties = cleanSchemaProperties(taskProperties);
    const projectSchemaProperties = cleanSchemaProperties(projectProperties);
    const epicSchemaProperties = cleanSchemaProperties(epicProperties);
    const ruleSchemaProperties = cleanSchemaProperties(ruleProperties);

    // Generate dynamic workflow tools
    const dynamicWorkflowTools: Tool[] = Array.from(dynamicWorkflows.values()).map(workflow => ({
      name: workflow.name,
      description: workflow.description,
      inputSchema: workflow.inputSchema,
    }));

    return {
      tools: [
        ...propertyTools.getToolDefinitions(),
        ...templateTools.getToolDefinitions(),
        // Expose restored task and project tools
        ...taskTools.getToolDefinitions(taskSchemaProperties),
        ...projectTools.getToolDefinitions(projectSchemaProperties),
        // Add epic tools
        ...epicTools.getToolDefinitions(epicSchemaProperties),
        // Add rule tools
        ...ruleTools.getToolDefinitions(ruleSchemaProperties),
        // Keep generic object tools available
        ...objectTools.getToolDefinitions(),
        ...workflowTools.getToolDefinitions(),
        // Add dynamic workflow tools
        ...dynamicWorkflowTools,
      ],
    };
  });

  // Set up tool call handler
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: toolArgs } = request.params;

    // Handle property tools
    if (propertyTools.canHandle(name)) {
      return await propertyTools.handle(name, toolArgs);
    }

    // Handle template tools
    if (templateTools.canHandle(name)) {
      return await templateTools.handle(name, toolArgs);
    }

    // Handle task tools
    if (taskTools.canHandle(name)) {
      return await taskTools.handle(name, toolArgs);
    }

    // Handle project tools
    if (projectTools.canHandle(name)) {
      return await projectTools.handle(name, toolArgs);
    }

    // Handle epic tools
    if (epicTools.canHandle(name)) {
      return await epicTools.handle(name, toolArgs);
    }

    // Handle rule tools
    if (ruleTools.canHandle(name)) {
      return await ruleTools.handle(name, toolArgs);
    }

    // Handle generic object tools
    if (objectTools.canHandle(name)) {
      return await objectTools.handle(name, toolArgs);
    }

    // Handle workflow tools
    if (workflowTools.canHandle(name)) {
      return await workflowTools.handle(name, toolArgs);
    }

    // Handle dynamic workflow tools
    if (dynamicWorkflows.has(name)) {
      return await handleDynamicWorkflow(name, toolArgs || {});
    }

    throw new Error(`Unknown tool: ${name}`);
  });

  return server;
}

/**
 * Handle execution of a dynamic workflow tool
 */
async function handleDynamicWorkflow(name: string, args: Record<string, any>) {
  const workflow = dynamicWorkflows.get(name);
  if (!workflow) {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            success: false,
            error: `Workflow '${name}' not found`
          })
        }
      ]
    };
  }

  try {
    const context = await workflowExecutor.execute(workflow, args);
    
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            success: true,
            workflow: name,
            result: context.result,
            logs: context.logs,
            variables: Object.fromEntries(context.variables)
          }, null, 2)
        }
      ]
    };
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            success: false,
            workflow: name,
            error: (error as Error).message
          }, null, 2)
        }
      ]
    };
  }
}

/**
 * Register a new dynamic workflow tool
 */
export function registerWorkflow(workflow: WorkflowDefinition): { success: boolean; error?: string } {
  // Validate workflow definition
  if (!workflow.name || typeof workflow.name !== 'string') {
    return { success: false, error: 'Workflow name is required and must be a string' };
  }

  if (!workflow.description || typeof workflow.description !== 'string') {
    return { success: false, error: 'Workflow description is required and must be a string' };
  }

  if (!workflow.inputSchema || typeof workflow.inputSchema !== 'object') {
    return { success: false, error: 'Workflow inputSchema is required and must be an object' };
  }

  if (!Array.isArray(workflow.steps) || workflow.steps.length === 0) {
    return { success: false, error: 'Workflow must have at least one step' };
  }

  // Check for duplicate names
  if (dynamicWorkflows.has(workflow.name)) {
    return { success: false, error: `Workflow '${workflow.name}' already exists` };
  }

  // Store workflow
  dynamicWorkflows.set(workflow.name, workflow);
  console.log(`✅ Registered dynamic workflow: ${workflow.name}`);

  return { success: true };
}

/**
 * Unregister a dynamic workflow tool
 */
export function unregisterWorkflow(name: string): { success: boolean; error?: string } {
  if (!dynamicWorkflows.has(name)) {
    return { success: false, error: `Workflow '${name}' not found` };
  }

  dynamicWorkflows.delete(name);
  console.log(`🗑️  Unregistered dynamic workflow: ${name}`);

  return { success: true };
}

/**
 * List all registered dynamic workflows
 */
export function listDynamicWorkflows(): WorkflowDefinition[] {
  return Array.from(dynamicWorkflows.values());
}

/**
 * Get a specific workflow by name
 */
export function getWorkflow(name: string): WorkflowDefinition | undefined {
  return dynamicWorkflows.get(name);
}

/**
 * Refresh workflows from database - call this after template CRUD operations
 * @param dbService - Database service instance
 */
export async function refreshWorkflows(dbService: DatabaseService): Promise<void> {
  console.log('Refreshing workflows from database...');
  await loadWorkflowsFromDatabase(dbService);
  console.log('Workflows refreshed successfully');
}

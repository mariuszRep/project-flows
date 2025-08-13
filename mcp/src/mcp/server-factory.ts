import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { ListToolsRequestSchema, CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { SchemaProperties, SchemaProperty, ExecutionChainItem } from "../types/property.js";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import DatabaseService from "../database.js";
import { createTaskTools } from "../tools/task-tools.js";
import { createPropertyTools } from "../tools/property-tools.js";
import { createProjectTools } from "../tools/project-tools.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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

  async function loadDynamicSchemaProperties(): Promise<SchemaProperties> {
    try {
      // Load task properties only (template_id = 1)
      return await sharedDbService.getSchemaProperties(1);
    } catch (error) {
      console.error('Error loading schema properties from database:', error);
      // Fallback to file-based loading
      try {
        const schemaFile = join(__dirname, "..", "..", "schema_properties.json");
        const data = readFileSync(schemaFile, "utf8");
        return JSON.parse(data);
      } catch (fallbackError) {
        console.error('Fallback file loading also failed:', fallbackError);
        return {};
      }
    }
  }

  async function loadProjectSchemaProperties(): Promise<SchemaProperties> {
    try {
      // Load project properties (template_id = 2)
      return await sharedDbService.getSchemaProperties(2);
    } catch (error) {
      console.error('Error loading project schema properties from database:', error);
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
  
  const projectTools = createProjectTools(
    sharedDbService,
    clientId,
    loadProjectSchemaProperties,
    createExecutionChain,
    validateDependencies
  );
  
  const taskTools = createTaskTools(
    sharedDbService,
    clientId,
    loadDynamicSchemaProperties,
    createExecutionChain,
    validateDependencies,
    projectTools
  );

  // Set up tool list handler
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    // Get task properties (template_id = 1)
    const taskProperties = await sharedDbService.getSchemaProperties(1);
    // Get project properties (template_id = 2)
    const projectProperties = await sharedDbService.getSchemaProperties(2);

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

    return {
      tools: [
        ...taskTools.getToolDefinitions(taskSchemaProperties),
        ...propertyTools.getToolDefinitions(),
        ...projectTools.getToolDefinitions(projectSchemaProperties),
      ],
    };
  });

  // Set up tool call handler
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: toolArgs } = request.params;

    // Handle task tools
    if (taskTools.canHandle(name)) {
      return await taskTools.handle(name, toolArgs);
    }

    // Handle property tools
    if (propertyTools.canHandle(name)) {
      return await propertyTools.handle(name, toolArgs);
    }

    // Handle project tools
    if (projectTools.canHandle(name)) {
      return await projectTools.handle(name, toolArgs);
    }

    throw new Error(`Unknown tool: ${name}`);
  });

  return server;
}
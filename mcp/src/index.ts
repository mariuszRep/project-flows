#!/usr/bin/env node

/**
 * Simple Hello World MCP Server in TypeScript
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import express from "express";
import cors from "cors";
import { z } from "zod";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
  TextContent,
} from "@modelcontextprotocol/sdk/types.js";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import DatabaseService from "./database.js";

interface SchemaProperty {
  type: string;
  description: string;
  dependencies?: string[];
  execution_order?: number;
  created_by?: string;
  updated_by?: string;
  created_at?: Date;
  updated_at?: Date;
  id?: number;
  template_id?: number;
  fixed?: boolean;
}

interface SchemaProperties {
  [key: string]: SchemaProperty;
}

interface ExecutionChainItem {
  execution_order: number;
  prop_name: string;
  prop_config: SchemaProperty;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Helper function to extract client name from user-agent
function extractClientFromUserAgent(userAgent: string): string | null {
  if (!userAgent) return null;
  
  // Common MCP client patterns
  if (userAgent.includes('windsurf')) return 'windsurf';
  if (userAgent.includes('claude-desktop')) return 'claude-desktop';
  if (userAgent.includes('cursor')) return 'cursor';
  if (userAgent.includes('vscode')) return 'vscode';
  if (userAgent.includes('cline')) return 'cline';
  
  return null;
}

// Initialize shared database service for all connections
const sharedDbService = new DatabaseService();

// Task data interface (moved to database.ts but kept here for compatibility)
type TaskStage = 'draft' | 'backlog' | 'doing' | 'review' | 'completed';

interface TaskData {
  id: number;
  stage?: TaskStage;
  [key: string]: any; // for dynamic properties
}

// Factory function to create a configured MCP server instance
function createMcpServer(clientId: string = 'unknown'): Server {
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
    /**
     * Load schema properties from database.
     */
    try {
      return await sharedDbService.getSchemaProperties();
    } catch (error) {
      console.error('Error loading schema properties from database:', error);
      // Fallback to file-based loading
      try {
        const schemaFile = join(__dirname, "..", "schema_properties.json");
        const data = readFileSync(schemaFile, "utf8");
        return JSON.parse(data);
      } catch (fallbackError) {
        console.error('Fallback file loading also failed:', fallbackError);
        return {};
      }
    }
  }

  function createExecutionChain(properties: SchemaProperties): ExecutionChainItem[] {
    /**
     * Create execution chain based on dependencies and execution order.
     */
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
    /**
     * Validate that dependencies are satisfied for each property that has a value.
     * In update context, all dependencies must be provided in the same call.
     */
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

server.setRequestHandler(ListToolsRequestSchema, async () => {
  /**
   * List available tools.
   */
  // Load all properties from the database
  const dynamicProperties = await loadDynamicSchemaProperties();

  // Filter properties for tasks (template_id = 1)
  const taskProperties: Record<string, any> = {};
  const otherProperties: Record<string, any> = {};
  
  for (const [propName, propConfig] of Object.entries(dynamicProperties)) {
    // Check if this is a task property (template_id = 1)
    if (propConfig.template_id === 1) {
      taskProperties[propName] = propConfig;
    } else {
      otherProperties[propName] = propConfig;
    }
  }

  // Clean properties for schema (remove execution metadata and convert types)
  const schemaProperties: Record<string, any> = {};
  for (const [propName, propConfig] of Object.entries(dynamicProperties)) {
    const cleanConfig: Record<string, any> = {};
    for (const [key, value] of Object.entries(propConfig)) {
      if (!["dependencies", "execution_order"].includes(key)) {
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

  // Use task properties as base properties if available, otherwise use empty object
  const baseProperties = Object.keys(taskProperties).length > 0 ? taskProperties : {};
  const allProperties = { ...baseProperties, ...schemaProperties };

  return {
    tools: [
      {
        name: "create_task",
        description: "Create a detailed task plan with markdown formatting, make sure you populate 'Title' and 'Summary' and later all the rest of the properties",
        inputSchema: {
          type: "object",
          properties: allProperties,
          required: ["Title", "Summary"],
        },
      } as Tool,
      {
        name: "update_task",
        description: "Update an existing task plan by task ID. Provide the task_id and any subset of fields to update. All fields except task_id are optional. To change a task's stage, include the 'stage' parameter with one of these values: 'draft', 'backlog', 'doing', 'review', or 'completed'.",
        inputSchema: {
          type: "object",
          properties: {
            task_id: {
              type: "number",
              description: "The numeric ID of the task to update"
            },
            ...allProperties
          },
          required: ["task_id"],
        },
      } as Tool,
      {
        name: "list_tasks",
        description: "List all tasks with their ID, Title, Summary, and Stage. Optionally filter by stage.",
        inputSchema: {
          type: "object",
          properties: {
            stage: {
              type: "string",
              description: "Optional stage filter: 'draft', 'backlog', 'doing', 'review', or 'completed'"
            }
          },
          required: [],
        },
      } as Tool,
      {
        name: "get_task",
        description: "Retrieve a task by its numeric ID. Returns the complete task data in markdown format.",
        inputSchema: {
          type: "object",
          properties: {
            task_id: {
              type: "number",
              description: "The numeric ID of the task to retrieve"
            }
          },
          required: ["task_id"],
        },
      } as Tool,
      {
        name: "list_templates",
        description: "List all available templates from the templates table.",
        inputSchema: {
          type: "object",
          properties: {},
          required: [],
        },
      } as Tool,
      {
        name: "get_template_properties",
        description: "Get properties for a specific template by template ID.",
        inputSchema: {
          type: "object",
          properties: {
            template_id: {
              type: "number",
              description: "The numeric ID of the template"
            }
          },
          required: ["template_id"],
        },
      } as Tool,
      {
        name: "create_property",
        description: "Create a new property for a specific template by template ID.",
        inputSchema: {
          type: "object",
          properties: {
            template_id: {
              type: "number",
              description: "The numeric ID of the template"
            },
            key: {
              type: "string",
              description: "The property key/name (must be unique within template)"
            },
            type: {
              type: "string",
              description: "The property type (e.g., 'text', 'list', 'number', 'boolean')"
            },
            description: {
              type: "string",
              description: "Description of what this property is for"
            },
            dependencies: {
              type: "array",
              items: { type: "string" },
              description: "Optional array of property keys this property depends on"
            },
            execution_order: {
              type: "number",
              description: "Optional execution order (defaults to 0)"
            },
            fixed: {
              type: "boolean",
              description: "Optional flag indicating if property is fixed/immutable (defaults to false)"
            }
          },
          required: ["template_id", "key", "type", "description"],
        },
      } as Tool,
      {
        name: "update_property",
        description: "Update an existing property by property ID. All fields except property_id are optional.",
        inputSchema: {
          type: "object",
          properties: {
            property_id: {
              type: "number",
              description: "The numeric ID of the property to update"
            },
            key: {
              type: "string",
              description: "The property key/name"
            },
            type: {
              type: "string",
              description: "The property type"
            },
            description: {
              type: "string",
              description: "Description of the property"
            },
            dependencies: {
              type: "array",
              items: { type: "string" },
              description: "Array of property keys this property depends on"
            },
            execution_order: {
              type: "number",
              description: "Execution order"
            },
            fixed: {
              type: "boolean",
              description: "Flag indicating if property is fixed/immutable"
            }
          },
          required: ["property_id"],
        },
      } as Tool,
      {
        name: "delete_property",
        description: "Delete a property by property ID.",
        inputSchema: {
          type: "object",
          properties: {
            property_id: {
              type: "number",
              description: "The numeric ID of the property to delete"
            }
          },
          required: ["property_id"],
        },
      } as Tool,
      {
        name: "list_properties",
        description: "List all properties, optionally filtered by template ID.",
        inputSchema: {
          type: "object",
          properties: {
            template_id: {
              type: "number",
              description: "Optional template ID to filter properties"
            }
          },
          required: [],
        },
      } as Tool,
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  /**
   * Handle tool calls.
   */
  const { name, arguments: toolArgs } = request.params;

  if (name === "create_task") {
    const dynamicProperties = await loadDynamicSchemaProperties();

    // Validate dependencies
    if (!validateDependencies(dynamicProperties, toolArgs || {}, false)) {
      return {
        content: [
          {
            type: "text",
            text: "Error: Dependency validation failed. Check logs for details.",
          } as TextContent,
        ],
      };
    }

    // Create execution chain
    const executionChain = createExecutionChain(dynamicProperties);

    // Prepare task data - all properties go into blocks now
    const taskData: Omit<TaskData, 'id'> = {};

    // Add all properties (including Title and Summary/Description) to task data
    for (const { prop_name } of executionChain) {
      const value = toolArgs?.[prop_name] || "";
      if (value) {
        taskData[prop_name] = value;
      }
    }
    
    // Also add any properties not in the execution chain
    for (const [key, value] of Object.entries(toolArgs || {})) {
      if (value && !taskData[key]) {
        taskData[key] = value;
      }
    }

    // Store task in database
    let taskId: number;
    try {
      taskId = await sharedDbService.createTask(taskData, clientId);
    } catch (error) {
      console.error('Error creating task:', error);
      return {
        content: [
          {
            type: "text",
            text: "Error: Failed to create task in database.",
          } as TextContent,
        ],
      };
    }

    // Create the markdown formatted task plan
    const title = toolArgs?.Title || "";
    const description = toolArgs?.Description || toolArgs?.Summary || "";
    
    let markdownContent = `# Task
**Task ID:** ${taskId}

**Title:** ${title}

## Description

${description}
`;

    // Process properties in execution order
    for (const { prop_name } of executionChain) {
      const value = toolArgs?.[prop_name] || "";
      if (value && prop_name !== 'Title' && prop_name !== 'Description') {
        markdownContent += `\n## ${prop_name}\n\n${value}\n`;
      }
    }

    return {
      content: [
        {
          type: "text",
          text: markdownContent,
        } as TextContent,
      ],
    };
  } else if (name === "update_task") {
    // Handle updating an existing task by ID
    const taskId = toolArgs?.task_id;
    
    // Validate task ID
    if (!taskId || typeof taskId !== 'number' || taskId < 1) {
      return {
        content: [
          {
            type: "text",
            text: "Error: Valid numeric task_id is required for update.",
          } as TextContent,
        ],
      };
    }

    // Check if task exists
    const existingTask = await sharedDbService.getTask(taskId);
    if (!existingTask) {
      return {
        content: [
          {
            type: "text",
            text: `Error: Task with ID ${taskId} not found.`,
          } as TextContent,
        ],
      };
    }

    const dynamicProperties = await loadDynamicSchemaProperties();

    // Filter out task_id from validation since it's not a content field
    const contentArgs = { ...toolArgs };
    delete contentArgs.task_id;

    // For updates, we don't validate dependencies since we're only updating partial fields
    // The original task creation would have validated dependencies already

    // Prepare update data - all non-stage properties go to blocks
    const updateData: Partial<TaskData> = {};
    
    // Handle stage explicitly as it's a column in tasks table
    if (toolArgs?.stage !== undefined) {
      // Validate stage value
      const validStages = ['draft', 'backlog', 'doing', 'review', 'completed'];
      if (validStages.includes(String(toolArgs.stage))) {
        updateData.stage = String(toolArgs.stage) as TaskStage;
      }
    }

    // Create execution chain to order fields when building markdown
    const executionChain = createExecutionChain(dynamicProperties);

    // Add all properties (including Title, Summary/Description) to update data
    for (const { prop_name } of executionChain) {
      const value = toolArgs?.[prop_name];
      if (value !== undefined) {
        updateData[prop_name] = value;
      }
    }
    
    // Also add any properties not in the execution chain (except task_id and stage)
    for (const [key, value] of Object.entries(toolArgs || {})) {
      if (key !== 'task_id' && key !== 'stage' && value !== undefined && !updateData.hasOwnProperty(key)) {
        updateData[key] = value;
      }
    }

    // Update task in database
    try {
      await sharedDbService.updateTask(taskId, updateData, clientId);
    } catch (error) {
      console.error('Error updating task:', error);
      return {
        content: [
          {
            type: "text",
            text: "Error: Failed to update task in database.",
          } as TextContent,
        ],
      };
    }

    let markdownContent = `# Task Update
**Task ID:** ${taskId}

`;

    // Include provided core fields first
    if (toolArgs?.Title) {
      markdownContent += `**Title (updated):** ${toolArgs.Title}\n\n`;
    }
    if (toolArgs?.Description) {
      markdownContent += `## Description (updated)\n\n${toolArgs.Description}\n`;
    }
    if (toolArgs?.Summary) {
      markdownContent += `## Summary (updated)\n\n${toolArgs.Summary}\n`;
    }

    // Append any dynamic property updates in order
    for (const { prop_name } of executionChain) {
      const value = toolArgs?.[prop_name];
      if (value && prop_name !== 'Title' && prop_name !== 'Description' && prop_name !== 'Summary') {
        markdownContent += `\n## ${prop_name} (updated)\n\n${value}\n`;
      }
    }

    // If no content fields were supplied, inform user
    const hasContentUpdates = Object.keys(contentArgs).length > 0;
    if (!hasContentUpdates) {
      markdownContent += "No fields supplied for update.";
    }

    return {
      content: [
        {
          type: "text",
          text: markdownContent,
        } as TextContent,
      ],
    };
  } else if (name === "list_tasks") {
    // List all tasks with optional stage filter
    const stageFilter = toolArgs?.stage as string | undefined;
    let tasks: TaskData[];
    try {
      tasks = await sharedDbService.listTasks(stageFilter);
    } catch (error) {
      console.error('Error listing tasks:', error);
      return {
        content: [
          {
            type: "text",
            text: "Error: Failed to retrieve tasks list.",
          } as TextContent,
        ],
      };
    }

    if (tasks.length === 0) {
      const filterMsg = stageFilter ? ` with stage '${stageFilter}'` : '';
      return {
        content: [
          {
            type: "text",
            text: `No tasks found${filterMsg}.`,
          } as TextContent,
        ],
      };
    }

    // Build markdown table with stage column
    let markdownContent = `| ID | Title | Description | Stage |\n| --- | --- | --- | --- |`;
    try {
      for (const task of tasks) {
        const cleanTitle = String(task.Title || '').replace(/\n|\r/g, ' ');
        const cleanDescription = String(task.Description || task.Summary || '').replace(/\n|\r/g, ' ');
        const stage = task.stage || 'draft';
        markdownContent += `\n| ${task.id} | ${cleanTitle} | ${cleanDescription} | ${stage} |`;
      }
    } catch (error) {
      console.error('Error formatting tasks table:', error);
      return {
        content: [
          {
            type: "text",
            text: "Error: Failed to format tasks table.",
          } as TextContent,
        ],
      };
    }

    return {
      content: [
        {
          type: "text",
          text: markdownContent,
        } as TextContent,
      ],
    };
  } else if (name === "get_task") {
    // Handle retrieving a task by ID
    const taskId = toolArgs?.task_id;
    
    // Validate task ID
    if (!taskId || typeof taskId !== 'number' || taskId < 1) {
      return {
        content: [
          {
            type: "text",
            text: "Error: Valid numeric task_id is required for retrieval.",
          } as TextContent,
        ],
      };
    }

    // Get task from database
    const task = await sharedDbService.getTask(taskId);
    if (!task) {
      return {
        content: [
          {
            type: "text",
            text: `Error: Task with ID ${taskId} not found.`,
          } as TextContent,
        ],
      };
    }

    const dynamicProperties = await loadDynamicSchemaProperties();
    const executionChain = createExecutionChain(dynamicProperties);

    // Generate markdown for the complete task
    const title = task.Title || '';
    const description = task.Description || task.Summary || '';
    
    let markdownContent = `# Task
**Task ID:** ${task.id}

**Title:** ${title}

**Stage:** ${task.stage || 'draft'}

## Description

${description}
`;

    // Add dynamic properties in execution order
    for (const { prop_name } of executionChain) {
      const value = task[prop_name];
      if (value && prop_name !== 'Title' && prop_name !== 'Description' && prop_name !== 'Summary') {
        markdownContent += `\n## ${prop_name}\n\n${value}\n`;
      }
    }

    return {
      content: [
        {
          type: "text",
          text: markdownContent,
        } as TextContent,
      ],
    };
  } else if (name === "list_templates") {
    // List all templates from the templates table
    try {
      const templates = await sharedDbService.getTemplates();
      
      if (templates.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: "No templates found.",
            } as TextContent,
          ],
        };
      }

      // Build JSON response with template data
      const templateData = templates.map(template => ({
        id: template.id,
        name: template.name,
        description: template.description,
        created_at: template.created_at,
        updated_at: template.updated_at,
        created_by: template.created_by,
        updated_by: template.updated_by,
      }));

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(templateData, null, 2),
          } as TextContent,
        ],
      };
    } catch (error) {
      console.error('Error listing templates:', error);
      return {
        content: [
          {
            type: "text",
            text: "Error: Failed to retrieve templates list.",
          } as TextContent,
        ],
      };
    }
  } else if (name === "get_template_properties") {
    // Get properties for a specific template
    const templateId = toolArgs?.template_id;
    
    // Validate template ID
    if (!templateId || typeof templateId !== 'number' || templateId < 1) {
      return {
        content: [
          {
            type: "text",
            text: "Error: Valid numeric template_id is required.",
          } as TextContent,
        ],
      };
    }

    try {
      const properties = await sharedDbService.getTemplateProperties(templateId);
      
      if (Object.keys(properties).length === 0) {
        return {
          content: [
            {
              type: "text",
              text: `No properties found for template ID ${templateId}.`,
            } as TextContent,
          ],
        };
      }

      // Return JSON response with properties data
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(properties, null, 2),
          } as TextContent,
        ],
      };
    } catch (error) {
      console.error('Error fetching template properties:', error);
      return {
        content: [
          {
            type: "text",
            text: "Error: Failed to retrieve template properties.",
          } as TextContent,
        ],
      };
    }
  } else if (name === "create_property") {
    // Create a new property for a template
    const templateId = toolArgs?.template_id;
    const key = toolArgs?.key;
    const type = toolArgs?.type;
    const description = toolArgs?.description;
    const dependencies = (toolArgs?.dependencies as string[]) || [];
    const execution_order = (toolArgs?.execution_order as number) || 0;
    const fixed = (toolArgs?.fixed as boolean) || false;
    
    // Validate required parameters
    if (!templateId || typeof templateId !== 'number' || templateId < 1) {
      return {
        content: [
          {
            type: "text",
            text: "Error: Valid numeric template_id is required.",
          } as TextContent,
        ],
      };
    }
    
    if (!key || typeof key !== 'string' || !key.trim()) {
      return {
        content: [
          {
            type: "text",
            text: "Error: Property key is required and must be a non-empty string.",
          } as TextContent,
        ],
      };
    }
    
    if (!type || typeof type !== 'string' || !type.trim()) {
      return {
        content: [
          {
            type: "text",
            text: "Error: Property type is required and must be a non-empty string.",
          } as TextContent,
        ],
      };
    }
    
    if (!description || typeof description !== 'string' || !description.trim()) {
      return {
        content: [
          {
            type: "text",
            text: "Error: Property description is required and must be a non-empty string.",
          } as TextContent,
        ],
      };
    }

    try {
      console.log('Creating property with params:', {
        templateId,
        key: key.trim(),
        type: type.trim(),
        description: description.trim(),
        dependencies,
        execution_order,
        fixed,
        clientId
      });

      const propertyId = await sharedDbService.createProperty(templateId, {
        key: key.trim(),
        type: type.trim(),
        description: description.trim(),
        dependencies,
        execution_order,
        fixed
      }, clientId);

      console.log('Property created successfully with ID:', propertyId);

      return {
        content: [
          {
            type: "text",
            text: `Property created successfully with ID: ${propertyId}`,
          } as TextContent,
        ],
      };
    } catch (error) {
      console.error('Error creating property - Full error details:', error);
      const errorMessage = error instanceof Error ? error.message : "Failed to create property";
      return {
        content: [
          {
            type: "text",
            text: `Error: ${errorMessage}`,
          } as TextContent,
        ],
      };
    }
  } else if (name === "update_property") {
    // Update an existing property by ID
    const propertyId = toolArgs?.property_id;
    
    // Validate property ID
    if (!propertyId || typeof propertyId !== 'number' || propertyId < 1) {
      return {
        content: [
          {
            type: "text",
            text: "Error: Valid numeric property_id is required.",
          } as TextContent,
        ],
      };
    }

    // Build updates object with only provided fields
    const updates: any = {};
    if (toolArgs?.key !== undefined) updates.key = String(toolArgs.key).trim();
    if (toolArgs?.type !== undefined) updates.type = String(toolArgs.type).trim();
    if (toolArgs?.description !== undefined) updates.description = String(toolArgs.description).trim();
    if (toolArgs?.dependencies !== undefined) updates.dependencies = toolArgs.dependencies;
    if (toolArgs?.execution_order !== undefined) updates.execution_order = toolArgs.execution_order;
    if (toolArgs?.fixed !== undefined) updates.fixed = toolArgs.fixed;

    try {
      const success = await sharedDbService.updateProperty(propertyId, updates, clientId);
      
      if (success) {
        return {
          content: [
            {
              type: "text",
              text: `Property ${propertyId} updated successfully.`,
            } as TextContent,
          ],
        };
      } else {
        return {
          content: [
            {
              type: "text",
              text: `Error: Property with ID ${propertyId} not found or no changes made.`,
            } as TextContent,
          ],
        };
      }
    } catch (error) {
      console.error('Error updating property:', error);
      return {
        content: [
          {
            type: "text",
            text: "Error: Failed to update property.",
          } as TextContent,
        ],
      };
    }
  } else if (name === "delete_property") {
    // Delete a property by ID
    const propertyId = toolArgs?.property_id;
    
    // Validate property ID
    if (!propertyId || typeof propertyId !== 'number' || propertyId < 1) {
      return {
        content: [
          {
            type: "text",
            text: "Error: Valid numeric property_id is required.",
          } as TextContent,
        ],
      };
    }

    try {
      const success = await sharedDbService.deleteProperty(propertyId);
      
      if (success) {
        return {
          content: [
            {
              type: "text",
              text: `Property ${propertyId} deleted successfully.`,
            } as TextContent,
          ],
        };
      } else {
        return {
          content: [
            {
              type: "text",
              text: `Error: Property with ID ${propertyId} not found.`,
            } as TextContent,
          ],
        };
      }
    } catch (error) {
      console.error('Error deleting property:', error);
      const errorMessage = error instanceof Error ? error.message : "Failed to delete property.";
      return {
        content: [
          {
            type: "text",
            text: `Error: ${errorMessage}`,
          } as TextContent,
        ],
      };
    }
  } else if (name === "list_properties") {
    // List properties, optionally filtered by template ID
    const templateId = toolArgs?.template_id;
    
    // Validate template ID if provided
    if (templateId !== undefined && (typeof templateId !== 'number' || templateId < 1)) {
      return {
        content: [
          {
            type: "text",
            text: "Error: If provided, template_id must be a valid number.",
          } as TextContent,
        ],
      };
    }

    try {
      const properties = await sharedDbService.listProperties(templateId);
      
      if (properties.length === 0) {
        const filterMsg = templateId ? ` for template ID ${templateId}` : '';
        return {
          content: [
            {
              type: "text",
              text: `No properties found${filterMsg}.`,
            } as TextContent,
          ],
        };
      }

      // Return JSON response with properties data
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(properties, null, 2),
          } as TextContent,
        ],
      };
    } catch (error) {
      console.error('Error listing properties:', error);
      return {
        content: [
          {
            type: "text",
            text: "Error: Failed to retrieve properties list.",
          } as TextContent,
        ],
      };
    }
  } else {
    throw new Error(`Unknown tool: ${name}`);
  }
});

  return server;
}

// Create Express app
const app = express();

// Enable CORS for all routes
app.use(cors());

// Add request timeout and connection limits (but skip for SSE connections)
app.use((req: any, res: any, next: any) => {
  // Skip timeout for SSE connections since they're meant to be long-lived
  if (req.url !== '/sse') {
    res.setTimeout(30000, () => {
      console.log('Request timeout for', req.url);
      if (!res.headersSent) {
        res.status(408).send('Request timeout');
      }
    });
  }
  next();
});

// Support multiple simultaneous connections with per-session MCP servers
const connections: {[sessionId: string]: {transport: SSEServerTransport, server: Server, clientId: string}} = {};

app.get("/", async (_: any, res: any) => {
  res.status(200).send('Project Flows MCP Server - Multiple clients supported with shared database');
});

app.get("/sse", async (req: any, res: any) => {
  try {
    // Extract client ID from headers, query params, or user-agent as fallback
    const clientId = req.headers['x-mcp-client'] || 
                     req.headers['x-client-id'] || 
                     req.query.client || 
                     req.query.clientId || 
                     extractClientFromUserAgent(req.headers['user-agent']) || 
                     'unknown';
    
    const transport = new SSEServerTransport('/messages', res);
    const serverInstance = createMcpServer(clientId); // Create new MCP server instance per connection with client ID
    
    connections[transport.sessionId] = { transport, server: serverInstance, clientId };
    
    // Clean up connection on close
    res.on("close", () => {
      console.log(`Connection closed for session: ${transport.sessionId}`);
      delete connections[transport.sessionId];
    });
    
    console.log(`New connection established with session: ${transport.sessionId}, client: ${clientId}`);
    console.log(`Active connections: ${Object.keys(connections).length}`);
    
    // Each server connects to its own transport
    await serverInstance.connect(transport);
  } catch (error) {
    console.error('Error establishing SSE connection:', error);
    res.status(500).send('Failed to establish connection');
  }
});

app.post("/messages", async (req: any, res: any) => {
  const sessionId = req.query.sessionId as string;
  const connection = connections[sessionId];
  
  if (connection) {
    try {
      // Update client ID from headers if provided in POST request
      const headerClientId = req.headers['x-mcp-client'] || 
                            req.headers['x-client-id'] || 
                            extractClientFromUserAgent(req.headers['user-agent']);
      
      if (headerClientId && headerClientId !== connection.clientId) {
        connection.clientId = headerClientId;
        console.log(`Updated client ID for session ${sessionId}: ${headerClientId}`);
      }
      
      await connection.transport.handlePostMessage(req, res);
    } catch (error) {
      console.error(`Error handling message for session ${sessionId}:`, error);
      res.status(500).send('Error processing message');
    }
  } else {
    console.warn(`No connection found for sessionId: ${sessionId}`);
    console.log(`Available sessions: ${Object.keys(connections).join(', ')}`);
    res.status(400).send('No connection found for sessionId');
  }
});

async function main() {
  /**
   * Main entry point for the server.
   */
  // Initialize database connection
  try {
    await sharedDbService.initialize();
  } catch (error) {
    console.error('Failed to initialize database:', error);
    process.exit(1);
  }

  // Cleanup database connection on exit
  process.on('SIGINT', async () => {
    console.log('Closing database connection...');
    await sharedDbService.close();
    process.exit(0);
  });
  
  process.on('SIGTERM', async () => {
    console.log('Closing database connection...');
    await sharedDbService.close();
    process.exit(0);
  });
  
  const port = process.env.PORT || 3001;
  app.listen(port, () => {
    console.log(`🚀 Project Flows MCP Server running on port ${port}`);
    console.log('📊 Multiple clients can now connect simultaneously');
    console.log('🗄️ Shared database ensures all clients see the same data');
    console.log(`🔗 Connect to: http://localhost:${port}/sse`);
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error("Server error:", error);
    process.exit(1);
  });
}
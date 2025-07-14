#!/usr/bin/env node

/**
 * Simple Hello World MCP Server in TypeScript
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
  TextContent,
} from "@modelcontextprotocol/sdk/types.js";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import {
  createTask,
  updateTask,
  getTask,
  addBlock,
  updateBlock,
  getBlockByType,
  type Task,
} from "./storage.js";

interface SchemaProperty {
  type: string;
  description: string;
  dependencies?: string[];
  execution_order?: number;
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

function loadDynamicSchemaProperties(): SchemaProperties {
  /**
   * Load schema properties from external file.
   */
  try {
    const schemaFile = join(__dirname, "..", "schema_properties.json");
    const data = readFileSync(schemaFile, "utf8");
    return JSON.parse(data);
  } catch (error) {
    return {};
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
  args: Record<string, any>
): boolean {
  /**
   * Validate that dependencies are satisfied for each property that has a value.
   */
  for (const [propName, propConfig] of Object.entries(properties)) {
    const dependencies = propConfig.dependencies || [];
    // Only validate dependencies for properties that are actually provided and have values
    if (propName in args && args[propName]) {
      for (const dep of dependencies) {
        if (!(dep in args) || !args[dep]) {
          return false;
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
  const baseProperties = {
    Title: {
      type: "string",
      description: "Clear, specific, and actionable task title. Use action verbs and be precise about what needs to be accomplished. Examples: 'Implement user login with OAuth', 'Fix database connection timeout issue', 'Design API endpoints for user management'",
      execution_order: 1,
    },
    Summary: {
      type: "string",
      description: "Description of the original request or problem statement. Include the 'what' and 'why' - what needs to be accomplished and why it's important.",
      execution_order: 2,
    },
  };

  const dynamicProperties = loadDynamicSchemaProperties();

  // Clean properties for schema (remove execution metadata)
  const schemaProperties: Record<string, any> = {};
  for (const [propName, propConfig] of Object.entries(dynamicProperties)) {
    const cleanConfig: Record<string, any> = {};
    for (const [key, value] of Object.entries(propConfig)) {
      if (!["dependencies", "execution_order"].includes(key)) {
        cleanConfig[key] = value;
      }
    }
    schemaProperties[propName] = cleanConfig;
  }

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
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  /**
   * Handle tool calls.
   */
  const { name, arguments: toolArgs } = request.params;

  if (name === "create_task") {
    const title = String(toolArgs?.Title || "");
    const summary = String(toolArgs?.Summary || "");
    
    const dynamicProperties = loadDynamicSchemaProperties();

    // Validate dependencies
    if (!validateDependencies(dynamicProperties, toolArgs || {})) {
      return {
        content: [
          {
            type: "text",
            text: "Error: Dependency validation failed. Check logs for details.",
          } as TextContent,
        ],
      };
    }

    // Create task using helper function
    const task = createTask(title);

    // Add Summary block
    if (summary) {
      addBlock(task.id, "Summary", summary);
    }

    // Create execution chain
    const executionChain = createExecutionChain(dynamicProperties);

    // Add dynamic property blocks
    for (const { prop_name } of executionChain) {
      const value = String(toolArgs?.[prop_name] || "");
      if (value) {
        addBlock(task.id, prop_name, value);
      }
    }

    // Create the markdown formatted task plan
    let markdownContent = `# Task
**Task ID:** ${task.id}

**Title:** ${task.title}

## Summary

${summary}
`;

    // Process properties in execution order
    for (const { prop_name } of executionChain) {
      const value = String(toolArgs?.[prop_name] || "");
      if (value) {
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
    const existingTask = getTask(taskId);
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

    const dynamicProperties = loadDynamicSchemaProperties();

    // Filter out task_id from validation since it's not a content field
    const contentArgs = { ...toolArgs };
    delete contentArgs.task_id;

    // Update task metadata if provided
    const taskUpdates: Partial<Omit<Task, 'id' | 'created_at'>> = {};
    if (toolArgs?.Title) {
      taskUpdates.title = String(toolArgs.Title);
    }
    
    if (Object.keys(taskUpdates).length > 0) {
      updateTask(taskId, taskUpdates);
    }

    // Update or create blocks
    if (toolArgs?.Summary) {
      const existingBlock = getBlockByType(taskId, "Summary");
      if (existingBlock) {
        updateBlock(taskId, "Summary", String(toolArgs.Summary));
      } else {
        addBlock(taskId, "Summary", String(toolArgs.Summary));
      }
    }

    // Create execution chain to order fields when building markdown
    const executionChain = createExecutionChain(dynamicProperties);

    // Update dynamic property blocks
    for (const { prop_name } of executionChain) {
      const value = toolArgs?.[prop_name];
      if (value) {
        const existingBlock = getBlockByType(taskId, prop_name);
        if (existingBlock) {
          updateBlock(taskId, prop_name, String(value));
        } else {
          addBlock(taskId, prop_name, String(value));
        }
      }
    }

    let markdownContent = `# Task Update
**Task ID:** ${taskId}

`;

    // Include provided core fields first
    if (toolArgs?.Title) {
      markdownContent += `**Title (updated):** ${toolArgs.Title}\n\n`;
    }
    if (toolArgs?.Summary) {
      markdownContent += `## Summary (updated)\n\n${toolArgs.Summary}\n`;
    }

    // Append any dynamic property updates in order
    for (const { prop_name } of executionChain) {
      const value = toolArgs?.[prop_name];
      if (value) {
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
  } else if (name === "get_item") {
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

    // Check if task exists
    const task = getTask(taskId);
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

    const dynamicProperties = loadDynamicSchemaProperties();
    const executionChain = createExecutionChain(dynamicProperties);

    // Generate markdown for the complete task
    let markdownContent = `# Task
**Task ID:** ${task.id}

**Title:** ${task.title}

## Summary

`;

    // Get Summary block content
    const summaryBlock = getBlockByType(taskId, "Summary");
    markdownContent += summaryBlock ? summaryBlock.content : "";
    markdownContent += "\n";

    // Add dynamic properties in execution order
    for (const { prop_name } of executionChain) {
      const block = getBlockByType(taskId, prop_name);
      if (block) {
        markdownContent += `\n## ${prop_name}\n\n${block.content}\n`;
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
  } else {
    throw new Error(`Unknown tool: ${name}`);
  }
});

async function main() {
  /**
   * Main entry point for the server.
   */
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error("Server error:", error);
    process.exit(1);
  });
}
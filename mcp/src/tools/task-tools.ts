import { Tool, TextContent } from "@modelcontextprotocol/sdk/types.js";
import { TaskData, TaskStage } from "../types/task.js";
import { SchemaProperties, ExecutionChainItem } from "../types/property.js";
import DatabaseService from "../database.js";

export class TaskTools {
  constructor(
    private sharedDbService: DatabaseService,
    private clientId: string,
    private loadDynamicSchemaProperties: () => Promise<SchemaProperties>,
    private createExecutionChain: (properties: SchemaProperties) => ExecutionChainItem[],
    private validateDependencies: (properties: SchemaProperties, args: Record<string, any>, isUpdateContext?: boolean) => boolean
  ) {}

  getToolDefinitions(allProperties: Record<string, any>): Tool[] {
    return [
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
    ];
  }

  canHandle(toolName: string): boolean {
    return ["create_task", "update_task", "list_tasks", "get_task"].includes(toolName);
  }

  async handle(name: string, toolArgs?: Record<string, any>) {
    switch (name) {
      case "create_task":
        return await this.handleCreateTask(toolArgs);
      case "update_task":
        return await this.handleUpdateTask(toolArgs);
      case "list_tasks":
        return await this.handleListTasks(toolArgs);
      case "get_task":
        return await this.handleGetTask(toolArgs);
      default:
        throw new Error(`Unknown task tool: ${name}`);
    }
  }

  private async handleCreateTask(toolArgs?: Record<string, any>) {
    const dynamicProperties = await this.loadDynamicSchemaProperties();

    // Validate dependencies
    if (!this.validateDependencies(dynamicProperties, toolArgs || {}, false)) {
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
    const executionChain = this.createExecutionChain(dynamicProperties);

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
      taskId = await this.sharedDbService.createTask(taskData, this.clientId);
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
  }

  private async handleUpdateTask(toolArgs?: Record<string, any>) {
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
    const existingTask = await this.sharedDbService.getTask(taskId);
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

    const dynamicProperties = await this.loadDynamicSchemaProperties();

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
    const executionChain = this.createExecutionChain(dynamicProperties);

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
      await this.sharedDbService.updateTask(taskId, updateData, this.clientId);
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
  }

  private async handleListTasks(toolArgs?: Record<string, any>) {
    // List all tasks with optional stage filter
    const stageFilter = toolArgs?.stage as string | undefined;
    let tasks: TaskData[];
    try {
      tasks = await this.sharedDbService.listTasks(stageFilter);
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
  }

  private async handleGetTask(toolArgs?: Record<string, any>) {
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
    const task = await this.sharedDbService.getTask(taskId);
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

    const dynamicProperties = await this.loadDynamicSchemaProperties();
    const executionChain = this.createExecutionChain(dynamicProperties);

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
  }
}

export function createTaskTools(
  sharedDbService: DatabaseService,
  clientId: string,
  loadDynamicSchemaProperties: () => Promise<SchemaProperties>,
  createExecutionChain: (properties: SchemaProperties) => ExecutionChainItem[],
  validateDependencies: (properties: SchemaProperties, args: Record<string, any>, isUpdateContext?: boolean) => boolean
): TaskTools {
  return new TaskTools(
    sharedDbService,
    clientId,
    loadDynamicSchemaProperties,
    createExecutionChain,
    validateDependencies
  );
}
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
    private validateDependencies: (properties: SchemaProperties, args: Record<string, any>, isUpdateContext?: boolean) => boolean,
    private projectTools?: any
  ) {}

  getToolDefinitions(allProperties: Record<string, any>): Tool[] {
    return [
      {
        name: "create_task",
        description: "Create a detailed task plan with markdown formatting, make sure you populate 'Title' and 'Description' and later all the rest of the properties. Use parent_id to create hierarchical tasks (e.g., subtasks under a project).",
        inputSchema: {
          type: "object",
          properties: {
            parent_id: {
              type: "number",
              description: "Optional parent task ID to create hierarchical relationships (subtasks under parent tasks)"
            },
            type: {
              type: "string",
              enum: ["project", "task"],
              description: "Task type: 'project' for top-level organizational tasks, 'task' for regular tasks (defaults to 'task')"
            },
            ...allProperties
          },
          required: ["Title", "Description"],
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
            parent_id: {
              type: "number",
              description: "Optional parent task ID for hierarchical relationships"
            },
            type: {
              type: "string",
              enum: ["project", "task"],
              description: "Task type: 'project' for top-level organizational tasks, 'task' for regular tasks"
            },
            ...allProperties
          },
          required: ["task_id"],
        },
      } as Tool,
      {
        name: "list_tasks",
        description: "List all tasks with their ID, Title, Summary, Stage, Type, and Parent. Shows hierarchical relationships. Optionally filter by stage, type, or project.",
        inputSchema: {
          type: "object",
          properties: {
            stage: {
              type: "string",
              description: "Optional stage filter: 'draft', 'backlog', 'doing', 'review', or 'completed'"
            },
            type: {
              type: "string",
              enum: ["project", "task"],
              description: "Optional type filter: 'project' or 'task'"
            },
            project_id: {
              type: "number",
              description: "Optional project ID filter: only return tasks that belong to this project (parent_id)"
            }
          },
          required: [],
        },
      } as Tool,
      {
        name: "get_task",
        description: "Retrieve a task by its numeric ID. Returns the complete task data in the specified format.",
        inputSchema: {
          type: "object",
          properties: {
            task_id: {
              type: "number",
              description: "The numeric ID of the task to retrieve"
            },
            output_format: {
              type: "string",
              description: "Output format: 'markdown' (default) for human-readable format, 'json' for structured data",
              enum: ["markdown", "json"],
              default: "markdown"
            }
          },
          required: ["task_id"],
        },
      } as Tool,
      {
        name: "delete_task",
        description: "Delete a task by its numeric ID. This permanently removes the task and all its associated data.",
        inputSchema: {
          type: "object",
          properties: {
            task_id: {
              type: "number",
              description: "The numeric ID of the task to delete"
            }
          },
          required: ["task_id"],
        },
      } as Tool,
    ];
  }

  canHandle(toolName: string): boolean {
    return ["create_task", "update_task", "list_tasks", "get_task", "delete_task"].includes(toolName);
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
      case "delete_task":
        return await this.handleDeleteTask(toolArgs);
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

    // Handle parent_id for hierarchical tasks
    if (toolArgs?.parent_id !== undefined) {
      taskData.parent_id = toolArgs.parent_id;
      console.log(`Creating task with parent_id ${toolArgs.parent_id}`);
    } else {
      // If no parent_id is provided, use the selected project from global state
      if (this.projectTools) {
        try {
          // Get the selected project ID from global state
          const selectedProjectId = await this.sharedDbService.getGlobalState('selected_project_id');
          if (selectedProjectId !== null) {
            taskData.parent_id = selectedProjectId;
            console.log(`Using selected project ID ${selectedProjectId} as parent_id`);
          }
        } catch (error) {
          console.error('Error getting selected project:', error);
        }
      }
    }

    // Handle type for project/task distinction
    if (toolArgs?.type !== undefined) {
      const validTypes = ['project', 'task'];
      if (validTypes.includes(toolArgs.type)) {
        taskData.type = toolArgs.type;
        console.log(`Creating ${toolArgs.type} with ID`);
      }
    }

    // Add all properties (including Title and Summary/Description) to task data
    for (const { prop_name } of executionChain) {
      const value = toolArgs?.[prop_name] || "";
      if (value) {
        taskData[prop_name] = value;
      }
    }
    
    // Also add any properties not in the execution chain (exclude parent_id and type as they're already handled)
    for (const [key, value] of Object.entries(toolArgs || {})) {
      if (value && key !== 'parent_id' && key !== 'type' && !taskData[key]) {
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
  
    // Get project/parent information if task has parent_id
    let projectInfo = 'None';
    let projectId = taskData.parent_id;
  
    if (projectId) {
      try {
        const parentTask = await this.sharedDbService.getTask(projectId);
        projectInfo = parentTask ? `${parentTask.Title || 'Untitled'}` : 'Unknown';
      } catch (error) {
        console.error('Error loading parent/project task:', error);
        projectInfo = 'Unknown';
      }
    }
  
    const taskType = taskData.type || 'task';
    const typeDisplay = taskType === 'project' ? 'Project' : 'Task';
  
    let markdownContent = `# ${typeDisplay}
**${typeDisplay} ID:** ${taskId}

**Title:** ${title}

**Project ID:** ${projectId || 'None'}

**Project Name:** ${projectInfo}

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
    
    // Handle stage, parent_id, and type explicitly as they're columns in tasks table
    if (toolArgs?.stage !== undefined) {
      // Validate stage value
      const validStages = ['draft', 'backlog', 'doing', 'review', 'completed'];
      if (validStages.includes(String(toolArgs.stage))) {
        updateData.stage = String(toolArgs.stage) as TaskStage;
      }
    }
    
    if (toolArgs?.parent_id !== undefined) {
      updateData.parent_id = toolArgs.parent_id;
    }
    
    if (toolArgs?.type !== undefined) {
      // Validate type value
      const validTypes = ['project', 'task'];
      if (validTypes.includes(String(toolArgs.type))) {
        updateData.type = String(toolArgs.type) as 'project' | 'task';
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
    
    // Also add any properties not in the execution chain (except task_id, stage, parent_id, and type)
    for (const [key, value] of Object.entries(toolArgs || {})) {
      if (key !== 'task_id' && key !== 'stage' && key !== 'parent_id' && key !== 'type' && value !== undefined && !updateData.hasOwnProperty(key)) {
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
    // List all tasks with optional stage, type, and project_id filters
    const stageFilter = toolArgs?.stage as string | undefined;
    const typeFilter = toolArgs?.type as string | undefined;
    const projectIdFilter = toolArgs?.project_id as number | undefined;
    let tasks: TaskData[];
    try {
      tasks = await this.sharedDbService.listTasks(stageFilter, projectIdFilter);
      
      // Apply type filter if provided (client-side filtering for now)
      if (typeFilter) {
        tasks = tasks.filter(task => task.type === typeFilter);
      }
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
      const filters = [];
      if (stageFilter) filters.push(`stage '${stageFilter}'`);
      if (typeFilter) filters.push(`type '${typeFilter}'`);
      if (projectIdFilter) filters.push(`project_id '${projectIdFilter}'`);
      const filterMsg = filters.length > 0 ? ` with ${filters.join(' and ')}` : '';
      return {
        content: [
          {
            type: "text",
            text: `No tasks found${filterMsg}.`,
          } as TextContent,
        ],
      };
    }

    // Build markdown table with stage, type, and parent task columns
    let markdownContent = `| ID | Title | Description | Stage | Type | Parent | Parent ID |\n| --- | --- | --- | --- | --- | --- | --- |`;
    try {
      // Create a map of task IDs to titles for parent references
      const taskMap = new Map(tasks.map(t => [t.id, t.Title || 'Untitled']));

      for (const task of tasks) {
        const cleanTitle = String(task.Title || '').replace(/\n|\r/g, ' ');
        const cleanDescription = String(task.Description || task.Summary || '').replace(/\n|\r/g, ' ');
        const stage = task.stage || 'draft';
        const type = task.type || 'task';
        const parentName = task.parent_id ? (taskMap.get(task.parent_id) || `Unknown (${task.parent_id})`) : 'None';
        const parentId = task.parent_id || 'None';
        markdownContent += `\n| ${task.id} | ${cleanTitle} | ${cleanDescription} | ${stage} | ${type} | ${parentName} | ${parentId} |`;
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
    const outputFormat = toolArgs?.output_format || 'markdown'; // Default to markdown for backward compatibility
    
    console.log('handleGetTask called with args:', toolArgs);
    console.log('Output format requested:', outputFormat);
    
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
    
    // Get parent task name if task has parent_id
    let parentInfo = 'None';
    if (task.parent_id) {
      try {
        const parentTask = await this.sharedDbService.getTask(task.parent_id);
        parentInfo = parentTask ? `${parentTask.Title || 'Untitled'} (ID: ${parentTask.id})` : `Unknown (ID: ${task.parent_id})`;
      } catch (error) {
        parentInfo = `Error loading parent task (ID: ${task.parent_id})`;
      }
    }
    
    const taskType = task.type || 'task';
    const typeDisplay = taskType === 'project' ? 'Project' : 'Task';
    
    let markdownContent = `# ${typeDisplay}
**${typeDisplay} ID:** ${task.id}

**Title:** ${title}

**Stage:** ${task.stage || 'draft'}

**Type:** ${taskType}

**Parent Task:** ${parentInfo}

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

    // Return based on requested output format
    if (outputFormat === 'json') {
      // Return structured JSON data for UI consumption
      const jsonData = {
        id: task.id,
        title: title,
        description: description,
        stage: task.stage || 'draft',
        type: taskType,
        parent_id: task.parent_id,
        parent_name: parentInfo,
        // Include all dynamic properties
        ...Object.fromEntries(
          Object.entries(task).filter(([key, value]) => 
            key !== 'id' && 
            key !== 'stage' && 
            key !== 'type' && 
            key !== 'parent_id' && 
            value
          )
        )
      };
      
      return {
        content: [
          {
            type: "text", 
            text: JSON.stringify(jsonData, null, 2),
          } as TextContent,
        ],
      };
    }
    
    // Default markdown format
    return {
      content: [
        {
          type: "text",
          text: markdownContent,
        } as TextContent,
      ],
    };
  }

  private async handleDeleteTask(toolArgs?: Record<string, any>) {
    const taskId = toolArgs?.task_id;
    
    // Validate task ID
    if (!taskId || typeof taskId !== 'number' || taskId < 1) {
      return {
        content: [
          {
            type: "text",
            text: "Error: Valid numeric task_id is required for deletion.",
          } as TextContent,
        ],
      };
    }

    // Check if task exists before attempting deletion
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

    // Delete task from database
    try {
      const deleted = await this.sharedDbService.deleteTask(taskId);
      if (deleted) {
        return {
          content: [
            {
              type: "text",
              text: `Task with ID ${taskId} has been successfully deleted.`,
            } as TextContent,
          ],
        };
      } else {
        return {
          content: [
            {
              type: "text",
              text: `Error: Failed to delete task with ID ${taskId}.`,
            } as TextContent,
          ],
        };
      }
    } catch (error) {
      console.error('Error deleting task:', error);
      return {
        content: [
          {
            type: "text",
            text: "Error: Failed to delete task from database.",
          } as TextContent,
        ],
      };
    }
  }
}

export function createTaskTools(
  sharedDbService: DatabaseService,
  clientId: string,
  loadDynamicSchemaProperties: () => Promise<SchemaProperties>,
  createExecutionChain: (properties: SchemaProperties) => ExecutionChainItem[],
  validateDependencies: (properties: SchemaProperties, args: Record<string, any>, isUpdateContext?: boolean) => boolean,
  projectTools?: any
): TaskTools {
  return new TaskTools(
    sharedDbService,
    clientId,
    loadDynamicSchemaProperties,
    createExecutionChain,
    validateDependencies,
    projectTools
  );
}
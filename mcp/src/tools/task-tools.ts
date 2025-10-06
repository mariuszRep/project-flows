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
        description: "Create a task by following each property's individual prompt instructions exactly. Each field (Title, Description, etc.) has specific formatting requirements - read and follow each property's prompt precisely. Do not impose your own formatting or structure. Each property prompt defines exactly what content and format is required for that field. Use parent_id to create hierarchical tasks (e.g., subtasks under a project).",
        inputSchema: {
          type: "object",
          properties: {
            parent_id: {
              type: "number",
              description: "Optional parent task ID to create hierarchical relationships (subtasks under parent tasks)"
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
            stage: {
              type: "string",
              description: "Optional stage: 'draft', 'backlog', 'doing', 'review', or 'completed'",
              enum: ["draft", "backlog", "doing", "review", "completed"]
            },
            parent_id: {
              type: "number",
              description: "Optional parent task ID for hierarchical relationships"
            },
            ...allProperties
          },
          required: ["task_id"],
        },
      } as Tool,
    ];
  }

  canHandle(toolName: string): boolean {
    return ["create_task", "update_task"].includes(toolName);
  }

  async handle(name: string, toolArgs?: Record<string, any>) {
    switch (name) {
      case "create_task":
        return await this.handleCreateTask(toolArgs);
      case "update_task":
        return await this.handleUpdateTask(toolArgs);
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

    // Set template_id to 1 for tasks (create_task always creates tasks, not projects)
    taskData.template_id = 1;

    // Add all properties (including Title and Summary/Description) to task data
    for (const { prop_name } of executionChain) {
      const value = toolArgs?.[prop_name] || "";
      if (value) {
        taskData[prop_name] = value;
      }
    }
    
    // Also add any properties not in the execution chain (exclude parent_id as it's already handled)
    for (const [key, value] of Object.entries(toolArgs || {})) {
      if (value && key !== 'parent_id' && !taskData[key]) {
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

    // Create JSON response with task data
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
  
    const templateId = taskData.template_id || 1;
    const typeDisplay = templateId === 2 ? 'Project' : 'Task';
  
    // Build JSON response with structured data
    const jsonResponse = {
      success: true,
      task_id: taskId,
      type: typeDisplay.toLowerCase(),
      title: title,
      description: description,
      project_id: projectId,
      project_name: projectInfo,
      template_id: templateId,
      stage: taskData.stage || 'draft',
      // Add all dynamic properties
      ...Object.fromEntries(
        executionChain
          .filter(({ prop_name }) => 
            toolArgs?.[prop_name] && 
            prop_name !== 'Title' && 
            prop_name !== 'Description'
          )
          .map(({ prop_name }) => [prop_name, toolArgs?.[prop_name]])
      )
    };

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(jsonResponse, null, 2),
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

    // Prepare update data - all non-stage properties go to blocks
    const updateData: Partial<TaskData> = {};
    
    // Handle stage, parent_id, and template_id explicitly as they're columns in tasks table
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
    
    // Set template_id to 1 for tasks (consistent with create_task)
    updateData.template_id = 1;

    // Create execution chain to order fields when building markdown
    const executionChain = this.createExecutionChain(dynamicProperties);

    // Add all properties (including Title, Summary/Description) to update data
    for (const { prop_name } of executionChain) {
      const value = toolArgs?.[prop_name];
      if (value !== undefined) {
        updateData[prop_name] = value;
      }
    }
    
    // Also add any properties not in the execution chain (except task_id, stage, parent_id, and template_id)
    for (const [key, value] of Object.entries(toolArgs || {})) {
      if (key !== 'task_id' && key !== 'stage' && key !== 'parent_id' && key !== 'template_id' && value !== undefined && !updateData.hasOwnProperty(key)) {
        updateData[key] = value;
      }
    }

    // Update task in database
    try {
      const updateResult = await this.sharedDbService.updateTask(taskId, updateData, this.clientId);
      if (!updateResult) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ success: false, message: "No updates were applied." }, null, 2),
            } as TextContent,
          ],
        };
      }
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

    // After successful update, return the updated task details in JSON format
    const updatedTask = await this.sharedDbService.getTask(taskId);
    if (!updatedTask) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ success: false, message: "Task not found after update." }, null, 2),
          } as TextContent,
        ],
      };
    }

    // Check if task is completed based on checkboxes in Items section
    if (updatedTask.Items && this.isTaskCompleted(updatedTask.Items)) {
      try {
        await this.sharedDbService.updateTask(taskId, { stage: 'review', template_id: 1 }, this.clientId);
        updatedTask.stage = 'review';
      } catch (error) {
        console.error('Error auto-transitioning task to review:', error);
      }
    }

    // Build blocks object dynamically from task properties
    const blocks: Record<string, string> = {};
    const systemFields = ['id', 'stage', 'template_id', 'parent_id', 'created_at', 'updated_at', 'created_by', 'updated_by'];
    for (const [key, value] of Object.entries(updatedTask)) {
      if (!systemFields.includes(key) && value) {
        blocks[key] = String(value);
      }
    }

    const jsonResponse = {
      success: true,
      id: updatedTask.id,
      stage: updatedTask.stage || 'draft',
      template_id: 1,
      parent_id: updatedTask.parent_id,
      blocks: blocks
    };

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(jsonResponse, null, 2),
        } as TextContent,
      ],
    };
  }



  /**
   * Check if all checkboxes in Items section are completed
   * Returns true if all [ ] are changed to [x], false otherwise
   */
  private isTaskCompleted(itemsContent: string): boolean {
    if (!itemsContent || typeof itemsContent !== 'string') {
      return false;
    }

    // Find all checkbox patterns: - [ ] or - [x] (case insensitive)
    const checkboxPattern = /- \[ \]|- \[[xX]\]/g;
    const checkboxes = itemsContent.match(checkboxPattern);
    
    if (!checkboxes || checkboxes.length === 0) {
      // No checkboxes found - consider task not completable via checkboxes
      return false;
    }

    // Check if all checkboxes are completed (marked with x or X)
    const completedPattern = /- \[[xX]\]/;
    return checkboxes.every(checkbox => completedPattern.test(checkbox));
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


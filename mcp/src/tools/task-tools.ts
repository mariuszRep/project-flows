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
        description: "Retrieve a task by its numeric ID. Returns the complete task data in JSON format.",
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

    // For updates, we don't validate dependencies since we're only updating partial fields
    // The original task creation would have validated dependencies already

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

    // Build JSON response with updated fields
    const updatedFields: Record<string, any> = {};

    // Check for automatic completion detection
    // Only check if task is in 'doing' stage and Items field was updated
    if (existingTask.stage === 'doing' && toolArgs?.Items) {
      const isCompleted = this.isTaskCompleted(toolArgs.Items);
      
      if (isCompleted) {
        try {
          // Automatically move task to 'review' stage
          await this.sharedDbService.updateTask(taskId, { stage: 'review' as TaskStage }, this.clientId);
          console.log(`Task ${taskId} automatically moved to 'review' - all checkboxes completed`);
          
          // Update the response to indicate the automatic transition
          updatedFields['stage'] = 'review';
        } catch (error) {
          console.error('Error auto-transitioning task to review:', error);
          // Don't fail the update - log the error but continue
        }
      }
    }
    
    // Include provided core fields
    if (toolArgs?.Title) {
      updatedFields.Title = toolArgs.Title;
    }
    if (toolArgs?.Description) {
      updatedFields.Description = toolArgs.Description;
    }
    if (toolArgs?.Summary) {
      updatedFields.Summary = toolArgs.Summary;
    }

    // Add any dynamic property updates
    for (const { prop_name } of executionChain) {
      const value = toolArgs?.[prop_name];
      if (value && prop_name !== 'Title' && prop_name !== 'Description' && prop_name !== 'Summary') {
        updatedFields[prop_name] = value;
      }
    }

    // Check if any content fields were supplied
    const hasContentUpdates = Object.keys(contentArgs).length > 0;
    
    const jsonResponse = {
      success: true,
      task_id: taskId,
      message: hasContentUpdates 
        ? `Task ${taskId} updated successfully`
        : `Task ${taskId} - no fields supplied for update`,
      updated_fields: hasContentUpdates ? updatedFields : {}
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

  private async handleListTasks(toolArgs?: Record<string, any>) {
    // List all tasks with optional stage and project_id filters
    const stageFilter = toolArgs?.stage as string | undefined;
    const projectIdFilter = toolArgs?.project_id as number | undefined;
    // Always use template_id 1 for consistency
    const templateIdFilter = 1;
    let tasks: TaskData[];
    try {
      tasks = await this.sharedDbService.listTasks(stageFilter, projectIdFilter, templateIdFilter);
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
      filters.push(`template_id '1'`);
      if (projectIdFilter) filters.push(`project_id '${projectIdFilter}'`);
      const filterMsg = filters.length > 0 ? ` with ${filters.join(' and ')}` : '';
      
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              tasks: [],
              count: 0,
              message: `No tasks found${filterMsg}.`,
              filters: {
                stage: stageFilter,
                project_id: projectIdFilter,
                template_id: 1
              }
            }, null, 2),
          } as TextContent,
        ],
      };
    }

    // Build JSON array with task data
    try {
      // Create a map of task IDs to titles for parent references
      const taskMap = new Map(tasks.map(t => [t.id, t.Title || 'Untitled']));

      const tasksList = tasks.map(task => ({
        id: task.id,
        title: task.Title || '',
        description: task.Description || task.Summary || '',
        stage: task.stage || 'draft',
        template_id: task.template_id,
        type: task.template_id === 2 ? 'Project' : 'Task',
        parent_id: task.parent_id,
        parent_name: task.parent_id ? (taskMap.get(task.parent_id) || `Unknown (${task.parent_id})`) : null,
        // Include timestamp fields for sorting
        created_at: task.created_at,
        updated_at: task.updated_at,
        created_by: task.created_by,
        updated_by: task.updated_by,
        // Include any additional properties
        ...Object.fromEntries(
          Object.entries(task).filter(([key, value]) => 
            !['id', 'Title', 'Description', 'stage', 'template_id', 'parent_id', 'created_at', 'updated_at', 'created_by', 'updated_by'].includes(key) &&
            value
          )
        )
      }));

      const jsonResponse = {
        tasks: tasksList,
        count: tasksList.length,
        filters: {
          stage: stageFilter,
          project_id: projectIdFilter,
          template_id: 1
        }
      };

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(jsonResponse, null, 2),
          } as TextContent,
        ],
      };
    } catch (error) {
      console.error('Error formatting tasks list:', error);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              error: "Failed to format tasks list.",
              success: false
            }, null, 2),
          } as TextContent,
        ],
      };
    }
  }

  private async handleGetTask(toolArgs?: Record<string, any>) {
    // Handle retrieving a task by ID
    const taskId = toolArgs?.task_id;
    
    console.log('handleGetTask called with args:', toolArgs);
    
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

    // Get parent task name if task has parent_id (clean format without ID)
    let parentName = null;
    if (task.parent_id) {
      try {
        const parentTask = await this.sharedDbService.getTask(task.parent_id);
        parentName = parentTask ? (parentTask.Title || 'Untitled') : 'Unknown';
      } catch (error) {
        parentName = 'Unknown';
      }
    }
    
    const templateId = task.template_id || 1;
    
    // Build blocks object dynamically from task properties
    const blocks: Record<string, string> = {};
    
    // Add all task properties to blocks, excluding system fields
    const systemFields = ['id', 'stage', 'template_id', 'parent_id', 'created_at', 'updated_at', 'created_by', 'updated_by'];
    
    for (const [key, value] of Object.entries(task)) {
      if (!systemFields.includes(key) && value) {
        blocks[key] = String(value);
      }
    }
    
    // Return structured JSON data with blocks format
    const jsonData = {
      id: task.id,
      stage: task.stage || 'draft',
      template_id: templateId,
      parent_id: task.parent_id,
      parent_type: 'project',
      parent_name: parentName,
      blocks: blocks
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
        const jsonResponse = {
          success: true,
          task_id: taskId,
          message: `Task with ID ${taskId} has been successfully deleted.`
        };
        
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(jsonResponse, null, 2),
            } as TextContent,
          ],
        };
      } else {
        const jsonResponse = {
          success: false,
          task_id: taskId,
          error: `Failed to delete task with ID ${taskId}.`
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
    } catch (error) {
      console.error('Error deleting task:', error);
      const jsonResponse = {
        success: false,
        task_id: taskId,
        error: "Failed to delete task from database."
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
import { Tool, TextContent } from "@modelcontextprotocol/sdk/types.js";
import { TaskData, TaskStage } from "../types/task.js";
import { SchemaProperties, ExecutionChainItem } from "../types/property.js";
import DatabaseService from "../database.js";
import { handleCreate } from "./create-handler.js";
import { handleUpdate } from "./update-handler.js";

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
              description: "Optional parent task ID to create hierarchical relationships (subtasks under a parent task)"
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
              description: "Optional parent ID for hierarchical relationships"
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
    return handleCreate(
      {
        templateId: 1,
        typeName: "Task",
        responseIdField: "task_id",
        loadSchema: this.loadDynamicSchemaProperties,
      },
      toolArgs,
      this.sharedDbService,
      this.clientId,
      this.createExecutionChain,
      this.validateDependencies,
      this.projectTools
    );
  }

  private async handleUpdateTask(toolArgs?: Record<string, any>) {
    return handleUpdate(
      {
        templateId: 1,
        typeName: "Task",
        idField: "task_id",
        loadSchema: this.loadDynamicSchemaProperties,
        validateTemplateId: true, // Prevent cross-type updates (e.g., using task_id on an epic)
        postUpdate: async (taskId: number, updatedTask: any, dbService: DatabaseService, clientId: string) => {
          // Check if task is completed based on checkboxes in Items section
          if (updatedTask.Items && this.isTaskCompleted(updatedTask.Items)) {
            try {
              await dbService.updateObject(taskId, { stage: 'review', template_id: 1 }, clientId);
              updatedTask.stage = 'review';
              return updatedTask;
            } catch (error) {
              console.error('Error auto-transitioning task to review:', error);
            }
          }
          return null;
        },
      },
      toolArgs,
      this.sharedDbService,
      this.clientId,
      this.createExecutionChain
    );
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


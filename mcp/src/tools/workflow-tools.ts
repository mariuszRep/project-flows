import { Tool, TextContent } from "@modelcontextprotocol/sdk/types.js";
import DatabaseService from "../database.js";

export class WorkflowTools {
  constructor(
    private sharedDbService: DatabaseService,
    private clientId: string,
    private taskTools: any,
    private projectTools: any
  ) {}

  getToolDefinitions(): Tool[] {
    return [
      {
        name: "execute_task",
        description: "Load task and project context, then provide guided execution with real-time progress tracking through checkbox updates. This tool orchestrates task execution by loading all necessary context and providing clear guidance for planning and implementation.",
        inputSchema: {
          type: "object",
          properties: {
            task_id: {
              type: "number",
              description: "The numeric ID of the task to execute"
            }
          },
          required: ["task_id"],
        },
      } as Tool,
    ];
  }

  canHandle(toolName: string): boolean {
    return ["execute_task"].includes(toolName);
  }

  async handle(name: string, toolArgs?: Record<string, any>) {
    switch (name) {
      case "execute_task":
        return await this.handleExecuteTask(toolArgs);
      default:
        throw new Error(`Unknown workflow tool: ${name}`);
    }
  }

  private async handleExecuteTask(toolArgs?: Record<string, any>) {
    const taskId = toolArgs?.task_id;
    
    // Validate task ID
    if (!taskId || typeof taskId !== 'number' || taskId < 1) {
      return {
        content: [
          {
            type: "text",
            text: "Error: Valid numeric task_id is required for execution.",
          } as TextContent,
        ],
      };
    }

    // Step 1: Load task context using get_task tool
    const taskResponse = await this.taskTools.handle('get_task', { task_id: taskId });
    const taskContextText = taskResponse.content[0].text;
    
    let taskContext;
    try {
      taskContext = JSON.parse(taskContextText);
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error: Failed to parse task context: ${error}`,
          } as TextContent,
        ],
      };
    }

    // Step 2: Load project context using get_project tool if task has parent_id
    let projectContext = null;
    if (taskContext.parent_id) {
      try {
        const projectResponse = await this.projectTools.handle('get_project', { project_id: taskContext.parent_id });
        const projectContextText = projectResponse.content[0].text;
        projectContext = JSON.parse(projectContextText);
      } catch (error) {
        console.error('Error loading project context:', error);
        // Continue without project context
      }
    }

    // Step 3: Update task status to 'doing' using update_task tool
    try {
      await this.taskTools.handle('update_task', { task_id: taskId, stage: 'doing' });
      console.log(`Task ${taskId} status updated to 'doing'`);
    } catch (error) {
      console.error('Error updating task status:', error);
      return {
        content: [
          {
            type: "text",
            text: "Error: Failed to update task status to 'doing'.",
          } as TextContent,
        ],
      };
    }

    // Step 4: Generate execution context
    const executionContext = this.generateExecutionContext(taskContext, projectContext);

    return {
      content: [
        {
          type: "text",
          text: executionContext,
        } as TextContent,
      ],
    };
  }

  private generateExecutionContext(task: any, projectContext: any): string {
    const context = {
      task_id: task.id,
      status: "Task updated to 'doing' - ready for execution",
      task_context: task,
      project_context: projectContext,
      execution_instructions: [
        "1. Analyze the loaded task and project context",
        "2. Plan your implementation approach based on the requirements",
        "3. Execute the plan step by step", 
        "4. CRITICAL: Update Items section checkboxes as you complete each step",
        "5. Use update_task tool to save progress in real-time",
        "6. Update task status to 'review' when implementation is complete"
      ],
      progress_tracking_requirements: {
        mandatory: "You MUST update Items section checkboxes as work progresses",
        format: "Change [ ] to [x] immediately after completing each step",
        tool: "Use update_task tool to save checkbox progress", 
        purpose: "Provides visibility for multi-agent coordination and handoffs"
      },
      ready: "All context loaded. Begin planning and implementation now."
    };

    return JSON.stringify(context, null, 2);
  }
}

export function createWorkflowTools(
  sharedDbService: DatabaseService,
  clientId: string,
  taskTools: any,
  projectTools: any
): WorkflowTools {
  return new WorkflowTools(sharedDbService, clientId, taskTools, projectTools);
}
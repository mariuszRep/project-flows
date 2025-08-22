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

    // Step 4: Generate execution context with branch creation guidance
    // Orders steps as: plan → branch creation (task-{task_id}) → implement → checkboxes → save → review
    const executionContext = this.generateExecutionContext(taskContext, projectContext);

    // Step 5: Update task status to 'review' upon successful execution context generation
    try {
      await this.taskTools.handle('update_task', { task_id: taskId, stage: 'review' });
      console.log(`Task ${taskId} status updated to 'review' upon successful execute_task completion`);
    } catch (error) {
      console.error('Error updating task status to review:', error);
      // Don't fail the entire operation - log the error but continue
      // The execution context is still valid even if stage update fails
    }

    return {
      content: [
        {
          type: "text",
          text: executionContext,
        } as TextContent,
      ],
    };
  }

  /**
   * Generate execution context with structured workflow guidance
   * Orders execution steps as: plan → branch creation (task-{task_id}) → implement → checkboxes → save → review
   * Provides branch creation guidance without server-side shell execution for safety
   */
  private generateExecutionContext(task: any, projectContext: any): string {
    const branchName = this.generateBranchName(task.id);
    const currentBranchInfo = this.checkCurrentBranchInfo();
    
    const context = {
      task_id: task.id,
      status: currentBranchInfo.requiresBranch ? "Branch creation required" : "Task updated to 'doing' - ready for execution",
      current_branch: currentBranchInfo.currentBranch,
      suggested_branch_name: branchName,
      task_title: task.blocks?.Title || `Task ${task.id}`,
      warning: currentBranchInfo.requiresBranch ? `You are currently on '${currentBranchInfo.currentBranch}' branch. Working directly on this branch may commit changes to main/master.` : undefined,
      instructions: currentBranchInfo.requiresBranch ? [
        "1. **IMPORTANT**: Create a new Git branch before executing this task",
        `2. Run the following command to create and switch to a new branch:`,
        `   git checkout -b ${branchName}`,
        "3. Alternative: Modify the branch name if needed (follow Git naming conventions)",
        "4. Once the branch is created successfully, re-run execute_task to continue",
        "5. All task work will be isolated in the new branch for safe development"
      ] : [
        "1. Analyze the loaded task and project context",
        "2. Plan your implementation approach based on the requirements", 
        "3. Execute the plan step by step",
        "4. CRITICAL: Update Items section checkboxes as you complete each step",
        "5. Use update_task tool to save progress in real-time",
        "6. Update task status to 'review' when implementation is complete"
      ],
      branch_naming_guidelines: [
        "- Branch names follow the format: task-{task_id}",
        "- Simple, consistent naming for easy identification",
        `- Example: ${branchName}, task-42, etc.`
      ],
      execution_instructions: !currentBranchInfo.requiresBranch ? [
        "1. Analyze the loaded task and project context",
        "2. Plan your implementation approach based on the requirements",
        "3. Create/switch to feature branch (format: task-{task_id}) if not already done",
        "4. Execute the plan step by step", 
        "5. CRITICAL: Update Items section checkboxes as you complete each step",
        "6. Use update_task tool to save progress in real-time",
        "7. Update task status to 'review' when implementation is complete"
      ] : undefined,
      task_context: task,
      project_context: projectContext,
      progress_tracking_requirements: !currentBranchInfo.requiresBranch ? {
        mandatory: "You MUST update Items section checkboxes as work progresses",
        format: "Change [ ] to [x] immediately after completing each step",
        tool: "Use update_task tool to save checkbox progress", 
        purpose: "Provides visibility for multi-agent coordination and handoffs"
      } : undefined,
      next_steps: currentBranchInfo.requiresBranch ? "After creating the branch, execute this task again to proceed with implementation" : "All context loaded. Begin planning and implementation now.",
      ready: currentBranchInfo.requiresBranch ? undefined : "All context loaded. Begin planning and implementation now."
    };

    return JSON.stringify(context, null, 2);
  }

  /**
   * Generate a branch name for the given task ID following the format: task-{task_id}
   * Note: This method does not execute any shell commands - it's a pure helper for guidance
   */
  private generateBranchName(taskId: number): string {
    return `task-${taskId}`;
  }

  /**
   * Check current branch information to determine if branch creation is needed
   * Note: This method does not execute shell commands - it provides guidance-only context
   * In a real implementation, this would check git status, but for MCP server safety,
   * we assume users are on main/master unless proven otherwise
   */
  private checkCurrentBranchInfo(): { currentBranch: string; requiresBranch: boolean } {
    // For safety in MCP server context, assume user is on main branch and needs to create feature branch
    // This is guidance-only - no actual git commands are executed
    const assumedCurrentBranch = "main";
    const mainBranches = ["main", "master", "develop", "dev"];
    
    return {
      currentBranch: assumedCurrentBranch,
      requiresBranch: mainBranches.includes(assumedCurrentBranch)
    };
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
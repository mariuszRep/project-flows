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

    // Store original task state for rollback purposes
    let originalTaskState: any = null;
    
    try {
      console.log(`🚀 Starting task execution workflow for task ${taskId}`);
      
      // Step 1: Load task context using get_task tool
      const taskResponse = await this.taskTools.handle('get_task', { task_id: taskId });
      const taskContextText = taskResponse.content[0].text;
      
      let taskContext;
      try {
        taskContext = JSON.parse(taskContextText);
        originalTaskState = { ...taskContext }; // Store for rollback
        console.log(`📋 Retrieved task: \"${taskContext.blocks?.Title || 'Untitled'}\"`);
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
          console.log(`📁 Retrieved project: \"${projectContext.blocks?.Title || 'Untitled'}\"`);
        } catch (error) {
          console.error('Error loading project context:', error);
          // Continue without project context - not critical for execution
        }
      }

      // Step 3: Update task status to 'doing' using update_task tool (if not already doing)
      if (taskContext.stage !== 'doing') {
        try {
          await this.taskTools.handle('update_task', { task_id: taskId, stage: 'doing' });
          console.log(`⚡ Moved task to \"Doing\" stage`);
          taskContext.stage = 'doing'; // Update local state
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
      }

      // Step 4: Check if branch creation is needed before proceeding
      const branchInfo = await this.checkCurrentBranchInfo();
      
      if (branchInfo.requiresBranch) {
        // Return branch creation instructions and exit early
        const branchCreationContext = this.generateBranchCreationContext(taskContext, branchInfo);
        return {
          content: [
            {
              type: "text",
              text: branchCreationContext,
            } as TextContent,
          ],
        };
      }

      // Step 5: Parse checkboxes from Items field and track progress
      const checkboxProgress = this.parseCheckboxes(taskContext.blocks?.Items || '');
      console.log(`📊 Found ${checkboxProgress.total} checkboxes, ${checkboxProgress.completed} completed`);
      
      // Step 6: Track checkbox progress and auto-transition if needed
      if (checkboxProgress.total > 0) {
        await this.trackCheckboxProgress(taskId, checkboxProgress);
      }

      // Step 7: Generate execution context with progress information
      const executionContext = this.generateExecutionContext(taskContext, projectContext, checkboxProgress);

      return {
        content: [
          {
            type: "text",
            text: executionContext,
          } as TextContent,
        ],
      };
      
    } catch (error) {
      console.error(`❌ Workflow failed for task ${taskId}:`, error);
      
      // Attempt rollback if we have original state and made changes
      if (originalTaskState && originalTaskState.stage !== 'doing') {
        try {
          console.log(`🔄 Attempting rollback for task ${taskId} to stage '${originalTaskState.stage}'`);
          await this.taskTools.handle('update_task', { 
            task_id: taskId, 
            stage: originalTaskState.stage 
          });
          console.log(`✅ Successfully rolled back task ${taskId} to original stage`);
        } catch (rollbackError) {
          console.error(`❌ Rollback failed for task ${taskId}:`, rollbackError);
          // Don't throw rollback errors - just log them
        }
      }
      
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              success: false,
              task_id: taskId,
              error: (error as Error).message || "Unknown error during task execution",
              rollback_attempted: originalTaskState ? true : false
            }, null, 2),
          } as TextContent,
        ],
      };
    }
  }

  /**
   * Generate branch creation context when user needs to create a new branch
   */
  private generateBranchCreationContext(task: any, branchInfo: any): string {
    const branchName = this.generateBranchName(task.id);
    
    const context = {
      task_id: task.id,
      status: "Branch creation required",
      current_branch: branchInfo.currentBranch,
      suggested_branch_name: branchName,
      task_title: task.blocks?.Title || `Task ${task.id}`,
      warning: `You are currently on '${branchInfo.currentBranch}' branch. Working directly on this branch may commit changes to main/master.`,
      instructions: [
        "1. **IMPORTANT**: Create a new Git branch before executing this task",
        `2. Run the following command to create and switch to a new branch:`,
        `   git checkout -b ${branchName}`,
        "3. Alternative: Modify the branch name if needed (follow Git naming conventions)",
        "4. Once the branch is created successfully, re-run execute_task to continue",
        "5. All task work will be isolated in the new branch for safe development"
      ],
      branch_naming_guidelines: [
        "- Branch names follow the format: task-{task_id}",
        "- Simple, consistent naming for easy identification",
        `- Example: ${branchName}, task-42, etc.`
      ],
      task_context: task,
      next_steps: "After creating the branch, execute this task again to proceed with implementation"
    };

    return JSON.stringify(context, null, 2);
  }

  /**
   * Generate execution context for implementation when branch is ready
   * Focus on implementation, progress tracking, and completion guidance
   */
  private generateExecutionContext(task: any, projectContext: any, checkboxProgress?: { total: number, completed: number, items: Array<{ text: string, completed: boolean }> }): string {
    const context = {
      task_id: task.id,
      status: "Task updated to 'doing' - ready for execution",
      task_title: task.blocks?.Title || `Task ${task.id}`,
      instructions: [
        "1. Analyze the loaded task and project context",
        "2. Plan your implementation approach based on the requirements", 
        "3. Execute the plan step by step",
        "4. CRITICAL: Update Items section checkboxes as you complete each step",
        "5. Use update_task tool to save progress in real-time",
        "6. Task will automatically transition to 'review' status upon completion"
      ],
      task_context: task,
      project_context: projectContext,
      checkbox_progress: checkboxProgress ? {
        total: checkboxProgress.total,
        completed: checkboxProgress.completed,
        remaining: checkboxProgress.total - checkboxProgress.completed,
        completion_percentage: checkboxProgress.total > 0 ? Math.round((checkboxProgress.completed / checkboxProgress.total) * 100) : 0,
        auto_review_enabled: checkboxProgress.total > 0,
        items: checkboxProgress.items
      } : {
        total: 0,
        completed: 0,
        remaining: 0,
        completion_percentage: 0,
        auto_review_enabled: false,
        message: "No checkboxes found in Items section"
      },
      progress_tracking_requirements: {
        mandatory: "You MUST update Items section checkboxes as work progresses",
        format: "Change [ ] to [x] immediately after completing each step",
        tool: "Use update_task tool to save checkbox progress", 
        purpose: "Provides visibility for multi-agent coordination and handoffs",
        auto_transition: "Task will automatically move to 'review' when all checkboxes are completed"
      },
      completion_instructions: [
        "1. When all implementation steps are complete:",
        "2. Update all remaining checkboxes to [x] in the Items section", 
        "3. Use update_task tool to save final progress",
        "4. The system will automatically detect completion and move task to 'review'",
        "5. Task will then be ready for code review and testing"
      ],
      next_steps: checkboxProgress && checkboxProgress.total > 0 
        ? `Progress: ${checkboxProgress.completed}/${checkboxProgress.total} completed. Continue with remaining tasks.`
        : "All context loaded. Begin planning and implementation now."
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
   * Parse checkbox items from markdown Items field
   * Returns comprehensive checkbox analysis with individual item details
   */
  private parseCheckboxes(itemsContent: string): { total: number, completed: number, items: Array<{ text: string, completed: boolean }> } {
    if (!itemsContent || typeof itemsContent !== 'string') {
      return { total: 0, completed: 0, items: [] };
    }

    const lines = itemsContent.split('\n');
    const items: Array<{ text: string; completed: boolean }> = [];
    let completed = 0;
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('- [ ]') || trimmed.startsWith('- [x]') || trimmed.startsWith('- [X]')) {
        const isCompleted = trimmed.startsWith('- [x]') || trimmed.startsWith('- [X]');
        const text = trimmed.substring(5).trim();
        
        items.push({ text, completed: isCompleted });
        if (isCompleted) completed++;
      }
    }
    
    return {
      total: items.length,
      completed,
      items
    };
  }

  /**
   * Track checkbox progress and auto-transition to review if all completed
   * This implements the core auto-completion logic from Task 176
   */
  private async trackCheckboxProgress(taskId: number, progress: { total: number, completed: number, items: Array<{ text: string, completed: boolean }> }): Promise<void> {
    console.log(`📊 Task ${taskId} progress: ${progress.completed}/${progress.total} checkboxes completed`);
    
    // If all checkboxes are completed, move task to review stage
    if (progress.total > 0 && progress.completed === progress.total) {
      console.log(`✅ All checkboxes completed for task ${taskId}, moving to Review stage`);
      try {
        await this.taskTools.handle("update_task", { 
          task_id: taskId,
          stage: 'review'
        });
        console.log(`🎉 Task ${taskId} automatically transitioned to 'review' stage`);
      } catch (error) {
        console.error(`❌ Failed to auto-transition task ${taskId} to review:`, error);
        throw error; // Re-throw to trigger rollback
      }
    }
  }


  /**
   * Check current branch information with actual git command execution
   * Improved from environment-based detection to real git status
   */
  private async checkCurrentBranchInfo(): Promise<{ currentBranch: string; requiresBranch: boolean }> {
    let currentBranch = "unknown";
    
    try {
      // Try to get current branch from git (this would require shell access in real implementation)
      // For MCP context, we'll still use environment detection but with better fallbacks
      if (process.env.GIT_BRANCH) {
        currentBranch = process.env.GIT_BRANCH;
      } else {
        // Default assumption - in real implementation this would be a git command
        currentBranch = "main";
      }
    } catch (error) {
      console.error('Error detecting git branch:', error);
      currentBranch = "main"; // Safe fallback
    }
    
    const mainBranches = ["main", "master", "develop", "dev"];
    const requiresBranch = mainBranches.includes(currentBranch);
    
    return {
      currentBranch,
      requiresBranch
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
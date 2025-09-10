import { Tool, TextContent } from "@modelcontextprotocol/sdk/types.js";
import DatabaseService from "../database.js";

export class WorkflowTools {
  constructor(
    private sharedDbService: DatabaseService,
    private clientId: string,
    private taskTools: any,
    private projectTools: any,
    private propertyTools?: any
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
      {
        name: "initiate_project",
        description: "Analyze a project and automatically generate appropriate tasks based on project context and complexity. Dynamically determines task structure without hardcoded properties.",
        inputSchema: {
          type: "object",
          properties: {
            project_id: {
              type: "number",
              description: "The numeric ID of the project to analyze and generate tasks for"
            },
            analysis_depth: {
              type: "string",
              description: "Analysis depth for task generation: 'basic', 'standard', or 'comprehensive'",
              enum: ["basic", "standard", "comprehensive"]
            },
            max_tasks: {
              type: "number",
              description: "Optional maximum number of tasks to create (overrides automatic determination)"
            }
          },
          required: ["project_id"],
        },
      } as Tool,
    ];
  }

  canHandle(toolName: string): boolean {
    return ["execute_task", "initiate_project"].includes(toolName);
  }

  async handle(name: string, toolArgs?: Record<string, any>) {
    switch (name) {
      case "execute_task":
        return await this.handleExecuteTask(toolArgs);
      case "initiate_project":
        return await this.handleInitiateProject(toolArgs);
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
      
      // Step 1: Load task context using get_object tool
      const taskResponse = await this.taskTools.handle('get_object', { object_id: taskId });
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

      // Step 2: Load project context using get_object tool if task has parent_id
      let projectContext = null;
      if (taskContext.parent_id) {
        try {
          const projectResponse = await this.projectTools.handle('get_object', { object_id: taskContext.parent_id });
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
          console.log(`⚡ Moved task to "Doing" stage`);
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
        "5. Use update_object tool to save progress in real-time",
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
        tool: "Use update_object tool to save checkbox progress", 
        purpose: "Provides visibility for multi-agent coordination and handoffs",
        auto_transition: "Task will automatically move to 'review' when all checkboxes are completed"
      },
      completion_instructions: [
        "1. When all implementation steps are complete:",
        "2. Update all remaining checkboxes to [x] in the Items section", 
        "3. Use update_object tool to save final progress",
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
   * Handle initiate_project tool - analyze project and generate tasks
   */
  private async handleInitiateProject(toolArgs?: Record<string, any>) {
    const projectId = toolArgs?.project_id;
    const analysisDepth = toolArgs?.analysis_depth || 'standard';
    const maxTasks = toolArgs?.max_tasks;
    
    // Validate project ID
    if (!projectId || typeof projectId !== 'number' || projectId < 1) {
      return this.createErrorResponse("Valid numeric project_id is required for analysis.");
    }
    
    try {
      console.log(`🔍 Starting project initiation for project ${projectId}`);
      
      // Step 1: Load project using get_object tool
      const projectResponse = await this.projectTools.handle('get_object', { object_id: projectId });
      if (!projectResponse || !projectResponse.content || !projectResponse.content[0]?.text) {
        return this.createErrorResponse(`Project with ID ${projectId} not found.`);
      }
      
      const projectContext = JSON.parse(projectResponse.content[0].text);
      
      // Step 2: Load project property schema using list_properties
      const propertiesResponse = await this.propertyTools.handle('list_properties', { template_id: 2 }); // Project template ID
      if (!propertiesResponse || !propertiesResponse.content || !propertiesResponse.content[0]?.text) {
        return this.createErrorResponse("Failed to load project property schema.");
      }
      
      const projectProperties = JSON.parse(propertiesResponse.content[0].text);
      
      // Step 3: Load task property schema using list_properties
      const taskPropertiesResponse = await this.propertyTools.handle('list_properties', { template_id: 1 }); // Task template ID
      if (!taskPropertiesResponse || !taskPropertiesResponse.content || !taskPropertiesResponse.content[0]?.text) {
        return this.createErrorResponse("Failed to load task property schema.");
      }
      
      const taskProperties = JSON.parse(taskPropertiesResponse.content[0].text);
      
      // Step 4: Generate analysis prompt based on dynamic properties
      const analysisPrompt = this.generateAnalysisPrompt(
        projectContext,
        projectProperties,
        taskProperties,
        analysisDepth
      );
      
      // Step 5: Return analysis context for the calling agent to process
      const analysisContext = {
        project_id: projectId,
        project_context: projectContext,
        project_properties: projectProperties,
        task_properties: taskProperties,
        analysis_depth: analysisDepth,
        max_tasks: maxTasks,
        analysis_prompt: analysisPrompt,
        instructions: [
          "Analyze this project in full detail and create appropriate tasks so that the project can be completed successfully.",
          "Use the provided project context and available properties to determine task structure.",
          `Create tasks using the create_task tool with parent_id: ${projectId}`,
          "Consider the analysis depth and max_tasks parameters for scope."
        ],
        available_task_properties: taskProperties.map((prop: any) => prop.key),
        next_steps: "Analyze the project and create tasks using create_task tool for each required task."
      };
      
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(analysisContext, null, 2),
          } as TextContent,
        ],
      };
    } catch (error) {
      console.error(`❌ Project initiation failed for project ${projectId}:`, error);
      return this.createErrorResponse((error as Error).message || "Unknown error during project initiation");
    }
  }

  /**
   * Helper method to generate analysis prompt dynamically based on project properties
   */
  private generateAnalysisPrompt(
    projectContext: any,
    projectProperties: any[],
    taskProperties: any[],
    analysisDepth: string
  ): string {
    // Extract property keys from schema
    const projectPropertyKeys = projectProperties.map(prop => prop.key);
    const taskPropertyKeys = taskProperties.map(prop => prop.key);
    
    // Build dynamic project context object with only available properties
    const dynamicProjectContext: Record<string, any> = {};
    projectPropertyKeys.forEach(key => {
      if (projectContext.blocks && projectContext.blocks[key] !== undefined) {
        dynamicProjectContext[key] = projectContext.blocks[key];
      }
    });
    
    // Group task properties by type for better analysis
    const taskPropertyDetails = taskProperties.map(prop => ({
      key: prop.key,
      type: prop.type,
      description: prop.description,
      required: prop.fixed || false
    }));

    // Categorize task properties for better analysis
    const contentProperties = taskPropertyDetails.filter(p => 
      ['text', 'markdown', 'string'].includes(p.type.toLowerCase()));
    const structuralProperties = taskPropertyDetails.filter(p => 
      ['list', 'array', 'object'].includes(p.type.toLowerCase()));
    const metadataProperties = taskPropertyDetails.filter(p => 
      !contentProperties.some(cp => cp.key === p.key) && 
      !structuralProperties.some(sp => sp.key === p.key));
    
    // Build prompt with dynamic properties and detailed task property information
    return `
Analyze the following project and determine appropriate tasks to create:

Project Context:
${JSON.stringify(dynamicProjectContext, null, 2)}

Analysis Depth: ${analysisDepth}

Available Task Properties:
${JSON.stringify(taskPropertyKeys, null, 2)}

Task Property Details:
${JSON.stringify(taskPropertyDetails, null, 2)}

Content Properties (for task descriptions, notes, etc.):
${JSON.stringify(contentProperties.map(p => p.key), null, 2)}

Structural Properties (for checklists, structured data):
${JSON.stringify(structuralProperties.map(p => p.key), null, 2)}

Metadata Properties:
${JSON.stringify(metadataProperties.map(p => p.key), null, 2)}

Please provide a structured analysis with the following:
1. Overall project complexity assessment
2. Recommended task breakdown structure
3. For each task, provide:
   - Title
   - Description
   - Items (checklist)
   ${taskPropertyKeys.filter(key => key !== 'Title' && key !== 'Description' && key !== 'Items')
     .map(key => `   - ${key}`).join('\n')}
4. Recommended task relationships (parent-child)
5. Suggested task count based on project complexity

Important: For each task, ensure you populate all required properties and follow the property types.
`;
  }

  /**
   * Helper method to send analysis prompt to the agent
   * The agent using this tool will perform the analysis and return structured tasks
   */
  private async sendToAgent(prompt: string): Promise<any> {
    console.log(`🤖 Requesting analysis from calling agent for project initiation`);
    
    // The calling agent (Claude) should analyze the project and return structured tasks
    // This method should trigger the agent to perform analysis and return tasks in the expected format
    
    // Return the analysis prompt for the agent to process
    // The agent will need to analyze and return a structured response with tasks
    throw new Error(`AGENT_ANALYSIS_REQUIRED: ${prompt}`);
  }

  /**
   * Helper method to parse agent's analysis result
   */
  private parseAnalysisResult(analysisResult: any): any[] {
    // In a real implementation, this would parse the agent's response
    // into a structured format for task creation
    
    return analysisResult.tasks || [];
  }

  /**
   * Helper method to determine appropriate task count based on project complexity
   */
  private determineTaskCount(
    projectContext: any,
    taskStructure: any[],
    analysisDepth: string
  ): number {
    // Log project context usage for debugging
    console.log(`Determining task count for project: ${projectContext.blocks?.Title || 'Untitled'}`);
    
    // This would be determined by the agent's analysis
    // For now, use a simple mapping based on analysis depth
    const depthMultiplier: Record<string, number> = {
      'basic': 1,
      'standard': 1.5,
      'comprehensive': 2.5
    };
    
    const baseCount = taskStructure.length || 5;
    const multiplier = depthMultiplier[analysisDepth] || 1;
    return Math.ceil(baseCount * multiplier);
  }

  /**
   * Helper method to create tasks from analysis using create_task
   */
  private async createTasksFromAnalysis(
    taskStructure: any[],
    projectId: number,
    taskCount: number,
    taskProperties: any[]
  ): Promise<any[]> {
    const createdTasks = [];
    const validTaskPropertyKeys = taskProperties.map(prop => prop.key);
    
    // Limit to specified task count
    const tasksToCreate = taskStructure.slice(0, taskCount);
    
    for (const taskTemplate of tasksToCreate) {
      // Filter task properties to only include valid ones from schema
      const taskData: Record<string, any> = {
        parent_id: projectId,
        stage: 'backlog'
      };
      
      // Only include properties that exist in the schema
      Object.keys(taskTemplate).forEach(key => {
        if (validTaskPropertyKeys.includes(key)) {
          taskData[key] = taskTemplate[key];
        }
      });
      
      // Create task using create_task tool
      try {
        const taskData_with_template: Record<string, any> = { ...taskData, template_id: 1 };
        const taskResponse = await this.taskTools.handle('create_task', taskData_with_template);
        if (taskResponse && taskResponse.content && taskResponse.content[0]?.text) {
          const createdTask = JSON.parse(taskResponse.content[0].text);
          createdTasks.push(createdTask);
        }
      } catch (error) {
        console.error(`Failed to create task:`, error);
        // Continue with other tasks even if one fails
      }
    }
    
    return createdTasks;
  }

  /**
   * Helper method to create error response
   */
  private createErrorResponse(message: string) {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({ error: message }, null, 2),
        } as TextContent,
      ],
    };
  }

  /**
   * Check current branch information with actual git command execution
   * Improved from environment-based detection to real git status
   */
  private async checkCurrentBranchInfo(): Promise<{ currentBranch: string; requiresBranch: boolean }> {
    let currentBranch = "unknown";
    
    try {
      // Execute git command to get current branch
      const { execSync } = await import('child_process');
      currentBranch = execSync('git rev-parse --abbrev-ref HEAD').toString().trim();
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
  projectTools: any,
  propertyTools?: any
): WorkflowTools {
  return new WorkflowTools(sharedDbService, clientId, taskTools, projectTools, propertyTools);
}
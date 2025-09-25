import { Tool, TextContent } from "@modelcontextprotocol/sdk/types.js";
import DatabaseService from "../database.js";

export class WorkflowTools {
  constructor(
    private sharedDbService: DatabaseService,
    private clientId: string,
    private taskTools: any,
    private projectTools: any,
    private objectTools: any,
    private propertyTools?: any,
    private epicTools?: any
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
        name: "initiate_object",
        description: "Fetch an object by ID using get_object and return its context for further processing.",
        inputSchema: {
          type: "object",
          properties: {
            object_id: {
              type: "number",
              description: "The numeric ID of the object to load"
            }
          },
          required: ["object_id"],
        },
      } as Tool,
    ];
  }

  canHandle(toolName: string): boolean {
    return ["execute_task", "initiate_object"].includes(toolName);
  }

  async handle(name: string, toolArgs?: Record<string, any>) {
    switch (name) {
      case "execute_task":
        return await this.handleExecuteTask(toolArgs);
      case "initiate_object":
        return await this.handleInitiateObject(toolArgs);
      default:
        throw new Error(`Unknown workflow tool: ${name}`);
    }
  }

  /**
   * Handle initiate_object tool - minimal wrapper over get_object
   */
  private async handleInitiateObject(toolArgs?: Record<string, any>) {
    const objectId = toolArgs?.object_id;

    if (!objectId || typeof objectId !== 'number' || objectId < 1) {
      return {
        content: [
          {
            type: "text",
            text: "Error: Valid numeric object_id is required.",
          } as TextContent,
        ],
      };
    }

    try {
      const objectResponse = await this.objectTools.handle('get_object', { object_id: objectId });
      if (!objectResponse || !objectResponse.content || !objectResponse.content[0]?.text) {
        return {
          content: [
            {
              type: "text",
              text: `Error: Object with ID ${objectId} not found.`,
            } as TextContent,
          ],
        };
      }

      const objectContext = JSON.parse(objectResponse.content[0].text);
      const minimalObject: Record<string, any> = {};
      for (const key of ["id", "template_id", "type", "blocks"]) {
        if (objectContext[key] !== undefined) minimalObject[key] = objectContext[key];
      }

      // Build format from list_properties for mapped template (if available)
      // Mapping rules:
      // - if object.template_id = 1 -> use 1
      // - if object.template_id = 2 -> use 3
      // - if object.template_id = 3 -> use 1
      let formatValue: any = [];
      let nextLevelType = "task"; // What type should be created next

      try {
        if (this.propertyTools && minimalObject.template_id) {
          let targetTemplateId = minimalObject.template_id;

          // Set next level type based on current template_id
          if (minimalObject.template_id === 1) {
            nextLevelType = "task";
            targetTemplateId = 1;
          } else if (minimalObject.template_id === 2) {
            nextLevelType = "epic";
            targetTemplateId = 3;
          } else if (minimalObject.template_id === 3) {
            nextLevelType = "task";
            targetTemplateId = 1;
          }

          const propsResp = await this.propertyTools.handle('list_properties', { template_id: targetTemplateId });
          const propsText = propsResp?.content?.[0]?.text;
          if (propsText) {
            const props = JSON.parse(propsText);
            const simplified = Array.isArray(props)
              ? props.map((p: any) => ({ key: p.key, description: p.description }))
              : props;
            formatValue = simplified;
          }
        }
      } catch (e) {
        formatValue = [];
      }

      const analaze = `
      ### Analisys
      ROLE: You are a senior software engineer with extensive experience in software development, project management.
      `

      const payload = {
        context: minimalObject,
        format: formatValue,
        instructions: [
          `ROLE: You are an Expert Planner for multilayer hierarchy (Project → Epics → Tasks → Subtasks or Todos) AI Workloads.`,
          `CONTEXT: This is a ${minimalObject.type} requirement - \n ${minimalObject.blocks}`,
          `CONTEXT: This ${minimalObject.type} sits within hierarchy (Project → Epics → Tasks(AI Agent Request) → Subtasks/Todos(AI Agent Action)`,
          `CONTEXT: All Objects (Project → Epics → Tasks) are created by AI agents (Claude Code, Codex CLI, Gemini CLI, ...) for AI Agents`,
          `CONTEXT: Only Tasks are executed by AI Agents (Claude Code, Codex CLI, Gemini CLI, ...) where they add extra Subtasks or Todos when planning the execution, Make sure to size the ${nextLevelType}s with that in mind.`,
          `INSTRUCTIONS: Analyze and understand this ${minimalObject.type} and all its requirements DEEPLY: \n ${minimalObject.blocks}, PLAN WELL BEFORE ACTING, 90% of success is in the planning phase.`,
          `INSTRUCTIONS: Breakdown this ${minimalObject.type} into ${nextLevelType}s - create ${nextLevelType} objects with this stgructure, always include all properties: \n${formatValue}`,
          `INSTRUCTIONS: Adhere to a development hierarchy, follow logic and dependencies, when breaking down., the ${nextLevelType}s must be in logical order of execution`,
          `INSTRUCTIONS: Each breakdown ${nextLevelType} must be self-contained so it can be worked on in isolation, in parallel with other phases.`,
          `INTRTUCTIONS: When brakingdown Project into Epics, the first Epic shoud be Prototype/POC/Demo(Project Scaffold, Frontend Core) → MVP(Frontend + Backend + Storage + API's) → Epics to cover ENTIRE PROJECT SCOPE (all features and release raedy).`,
          `CRITICAL INSTRUCTIONS: Make sure each breakdown ${nextLevelType} follows format, and always include all properties: \n ${formatValue}`,
          `INSTRUCTIONS: Make sure to size ${nextLevelType}s (as biggest possible) accoringly to hireachy structure, as only Tasks can be executed by AI agents (Claude Code, Codex CLI, Gemini CLI,...), AI Agents will add extra Planning and subtasks/todos, so do not create too small ${nextLevelType}s, make sure it fits well in the hierarchy`,
          `INSTRUCTIONS: Ensure no scope creep, and each ${nextLevelType} in the response strictly adheres to the provided ${minimalObject.type}, nothing more, nothing less.`,
          `OUTPUT, CRITICAL!: Provide the breakdown ${nextLevelType}s strictly in the provided format: \n ${formatValue}`,
          `OUTPUT, CRITICAL!: Make sure to expose all breakdown ${nextLevelType}s strictly in the provided format: \n ${formatValue} to the user in the response before next steps`,
          `NEXT STEPS: Ask user to Confirm if you should create new ${nextLevelType}s as per the breakdown you provided, if not, skip to the next step`,
          `NEXT STEPS: When confirmed, use create_${nextLevelType} tool to create the new ${nextLevelType}s as per the breakdown you provided`,
        ]
      };

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(payload, null, 2),
          } as TextContent,
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              success: false,
              object_id: objectId,
              error: (error as Error).message || 'Unknown error while loading object'
            }, null, 2),
          } as TextContent,
        ],
      };
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
      const taskResponse = await this.objectTools.handle('get_object', { object_id: taskId });
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
          const projectResponse = await this.objectTools.handle('get_object', { object_id: taskContext.parent_id });
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
  objectTools: any,
  propertyTools?: any,
  epicTools?: any
): WorkflowTools {
  return new WorkflowTools(sharedDbService, clientId, taskTools, projectTools, objectTools, propertyTools, epicTools);
}

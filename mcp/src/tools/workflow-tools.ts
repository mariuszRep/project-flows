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
        name: "analyze_object",
        description: "Act as a senior software engineer. Your task is to analyze the provided content and logically break it down into a minimal number of high-level, broad, and executable phases, adhering to a development hierarchy. The final output must be a single JSON object containing this breakdown, with the list items describing a general group of tasks rather than granular details. Ensure the response strictly adheres to the provided content without adding any external information.",
        inputSchema: {
          type: "object",
          properties: {
            content: {
              type: "string",
              description: "Content to analyze for breakdown"
            },
            breakdown: {
              type: "string",
              description: "Your analysis of the content as JSON: { \"list\": [\"1. Name — Description\", \"2. Name — Description\"], \"reasoning\": \"Why this breakdown makes sense\" }"
            }
          },
          required: ["content", "breakdown"],
        },
      } as Tool,
      {
        name: "initiate_project",
        description: "Analyze a project and automatically generate appropriate epics based on project context and complexity. Dynamically determines epic structure without hardcoded properties.",
        inputSchema: {
          type: "object",
          properties: {
            project_id: {
              type: "number",
              description: "The numeric ID of the project to analyze and generate epics for"
            },
            analysis_depth: {
              type: "string",
              description: "Analysis depth for epic generation: 'basic', 'standard', or 'comprehensive'",
              enum: ["basic", "standard", "comprehensive"]
            },
            max_epics: {
              type: "number",
              description: "Optional maximum number of epics to create (overrides automatic determination)"
            }
          },
          required: ["project_id"],
        },
      } as Tool,
      {
        name: "initiate_epic",
        description: "Analyze an epic and automatically generate appropriate tasks based on epic context and complexity. Creates logical, functional tasks that serve as implementation steps for the epic. Optimized for AI agent applications like Claude Code, Codex CLI, and Gemini CLI.",
        inputSchema: {
          type: "object",
          properties: {
            epic_id: {
              type: "number",
              description: "The numeric ID of the epic to analyze and generate tasks for"
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
          required: ["epic_id"],
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
    return ["execute_task", "analyze_object", "initiate_project", "initiate_epic", "initiate_object"].includes(toolName);
  }

  async handle(name: string, toolArgs?: Record<string, any>) {
    switch (name) {
      case "execute_task":
        return await this.handleExecuteTask(toolArgs);
      case "analyze_object":
        return await this.handleAnalyzeObject(toolArgs);
      case "initiate_object":
        return await this.handleInitiateObject(toolArgs);
      case "initiate_project":
        return await this.handleInitiateProject(toolArgs);
      case "initiate_epic":
        return await this.handleInitiateEpic(toolArgs);
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
      try {
        if (this.propertyTools && minimalObject.template_id) {
          let targetTemplateId = minimalObject.template_id;
          if (minimalObject.template_id === 2) targetTemplateId = 3;
          else if (minimalObject.template_id === 3) targetTemplateId = 1;
          else if (minimalObject.template_id === 1) targetTemplateId = 1;

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

      const payload = {
        context: minimalObject,
        format: formatValue,
        instructions: [
          `Your task is to analyze all ${minimalObject.blocks} with in context`,
          "logically break it down into a minimal number of high-level, broad, and executable phases.",
          `Adhere to a development hierarchy, make sure each phases follows format: \n ${formatValue}`,
          "The list items should describe a general group of tasks rather than granular details.",
          "Ensure the response strictly adheres to the provided content without adding any external information (no scope creep)",
          "Make sure to expose all phases as single JSON to the user before next step",
          "For each phase, use create_epic tool to create an epic, make sure you populate all properties."
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

  private async handleAnalyzeObject(toolArgs?: Record<string, any>) {
    const content = toolArgs?.content;
    const breakdown = toolArgs?.breakdown;

    if (!content || typeof content !== 'string') {
      return {
        content: [
          {
            type: "text",
            text: "Error: Valid content is required for analysis.",
          } as TextContent,
        ],
      };
    }

    if (!breakdown || typeof breakdown !== 'string') {
      return {
        content: [
          {
            type: "text",
            text: "Error: Valid breakdown is required.",
          } as TextContent,
        ],
      };
    }

    // Parse and validate the breakdown JSON
    let parsedBreakdown;
    try {
      parsedBreakdown = JSON.parse(breakdown);
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              success: false,
              error: "Invalid JSON format in breakdown parameter"
            }, null, 2),
          } as TextContent,
        ],
      };
    }

    // Validate required fields
    if (!parsedBreakdown.list || !Array.isArray(parsedBreakdown.list) || !parsedBreakdown.reasoning) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              success: false,
              error: "Breakdown must contain 'list' array and 'reasoning' string"
            }, null, 2),
          } as TextContent,
        ],
      };
    }

    // Return the structured analysis result like create_task returns the created task
    const result = {
      success: true,
      content_analyzed: content,
      breakdown: {
        list: parsedBreakdown.list,
        reasoning: parsedBreakdown.reasoning
      },
      analysis_timestamp: new Date().toISOString()
    };

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2),
        } as TextContent,
      ],
    };
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
   * Handle initiate_project tool - analyze project and generate epics
   */
  private async handleInitiateProject(toolArgs?: Record<string, any>) {
    const projectId = toolArgs?.project_id;
    const analysisDepth = toolArgs?.analysis_depth || 'standard';
    const maxEpics = toolArgs?.max_epics;
    
    // Validate project ID
    if (!projectId || typeof projectId !== 'number' || projectId < 1) {
      return this.createErrorResponse("Valid numeric project_id is required for analysis.");
    }

    // Validate that epic tools are available
    if (!this.epicTools) {
      return this.createErrorResponse("Epic tools are required for project initiation but not available.");
    }
    
    try {
      console.log(`🔍 Starting project initiation for project ${projectId}`);
      
      // Step 1: Load project using get_object tool
      const projectResponse = await this.objectTools.handle('get_object', { object_id: projectId });
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
      
      // Step 3: Load epic property schema using list_properties
      const epicPropertiesResponse = await this.propertyTools.handle('list_properties', { template_id: 3 }); // Epic template ID
      if (!epicPropertiesResponse || !epicPropertiesResponse.content || !epicPropertiesResponse.content[0]?.text) {
        return this.createErrorResponse("Failed to load epic property schema.");
      }

      const epicProperties = JSON.parse(epicPropertiesResponse.content[0].text);
      
      // Step 4: Generate epic-focused analysis prompt based on dynamic properties
      const analysisPrompt = this.generateEpicAnalysisPromptForProject(
        projectContext,
        projectProperties,
        epicProperties,
        analysisDepth
      );
      
      // Step 5: Return analysis context for the calling agent to process
      const analysisContext = {
        project_id: projectId,
        project_context: projectContext,
        project_properties: projectProperties,
        epic_properties: epicProperties,
        analysis_depth: analysisDepth,
        max_epics: maxEpics,
        analysis_prompt: analysisPrompt,
        instructions: [
          "Analyze this project in full detail and create appropriate epics so that the project can be completed successfully.",
          "Use the provided project context and available properties to determine epic structure.",
          "Each epic should represent a logical, functional component that can be implemented and tested independently.",
          `Create epics using the create_epic tool with parent_id: ${projectId}`,
          "Consider the analysis depth and max_epics parameters for scope.",
          "Focus on identifying functional boundaries that make sense for epic-level groupings."
        ],
        available_epic_properties: epicProperties.map((prop: any) => prop.key),
        next_steps: "Analyze the project and create epics using create_epic tool for each required epic."
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
   * Handle initiate_epic tool - analyze epic and generate tasks with EPIC-centered approach
   */
  private async handleInitiateEpic(toolArgs?: Record<string, any>) {
    const epicId = toolArgs?.epic_id;
    const analysisDepth = toolArgs?.analysis_depth || 'standard';
    const maxTasks = toolArgs?.max_tasks;

    // Validate epic ID
    if (!epicId || typeof epicId !== 'number' || epicId < 1) {
      return this.createErrorResponse("Valid numeric epic_id is required for analysis.");
    }

    try {
      console.log(`🔍 Starting EPIC-centered initiation for epic ${epicId}`);

      // Step 1: Load epic using get_object tool
      const epicResponse = await this.objectTools.handle('get_object', { object_id: epicId });
      if (!epicResponse || !epicResponse.content || !epicResponse.content[0]?.text) {
        return this.createErrorResponse(`Epic with ID ${epicId} not found.`);
      }

      const epicContext = JSON.parse(epicResponse.content[0].text);

      // Step 2: Load parent project context using epic's parent_id for additional context
      let projectContext = null;
      if (epicContext.parent_id) {
        try {
          const projectResponse = await this.objectTools.handle('get_object', { object_id: epicContext.parent_id });
          if (projectResponse && projectResponse.content && projectResponse.content[0]?.text) {
            projectContext = JSON.parse(projectResponse.content[0].text);
            console.log(`📁 Retrieved parent project: "${projectContext.blocks?.Title || 'Untitled'}"`);
          }
        } catch (error) {
          console.error('Error loading parent project context:', error);
          // Continue without project context - not critical for epic initiation
        }
      }

      // Step 3: Load epic property schema using list_properties
      const epicPropertiesResponse = await this.propertyTools.handle('list_properties', { template_id: 3 }); // Epic template ID
      if (!epicPropertiesResponse || !epicPropertiesResponse.content || !epicPropertiesResponse.content[0]?.text) {
        return this.createErrorResponse("Failed to load epic property schema.");
      }

      const epicProperties = JSON.parse(epicPropertiesResponse.content[0].text);

      // Step 4: Load project property schema using list_properties for context
      let projectProperties = [];
      try {
        const projectPropertiesResponse = await this.propertyTools.handle('list_properties', { template_id: 2 }); // Project template ID
        if (projectPropertiesResponse && projectPropertiesResponse.content && projectPropertiesResponse.content[0]?.text) {
          projectProperties = JSON.parse(projectPropertiesResponse.content[0].text);
        }
      } catch (error) {
        console.error('Error loading project property schema:', error);
        // Continue without project properties - not critical
      }

      // Step 5: Load task property schema using list_properties
      const taskPropertiesResponse = await this.propertyTools.handle('list_properties', { template_id: 1 }); // Task template ID
      if (!taskPropertiesResponse || !taskPropertiesResponse.content || !taskPropertiesResponse.content[0]?.text) {
        return this.createErrorResponse("Failed to load task property schema.");
      }

      const taskProperties = JSON.parse(taskPropertiesResponse.content[0].text);

      // Step 6: Generate EPIC-centered analysis prompt with task sizing guidelines
      const analysisPrompt = this.generateEpicAnalysisPrompt(
        epicContext,
        projectContext,
        epicProperties,
        projectProperties,
        taskProperties,
        analysisDepth
      );

      // Step 7: Return EPIC-centered analysis context for the calling agent to process
      const analysisContext = {
        epic_id: epicId,
        epic_context: epicContext,
        project_context: projectContext,
        epic_properties: epicProperties,
        project_properties: projectProperties,
        task_properties: taskProperties,
        analysis_depth: analysisDepth,
        max_tasks: maxTasks,
        analysis_prompt: analysisPrompt,
        instructions: [
          "Analyze this epic in full detail and create appropriately sized tasks for implementation.",
          "Use the EPIC context as the primary focus, with project context as supporting information.",
          "Create tasks optimized for AI agent applications (Claude Code, Codex CLI, Gemini CLI).",
          `Create tasks using the create_task tool with parent_id: ${epicId}`,
          "Follow task sizing guidelines to ensure optimal completion in single AI agent application sessions.",
          "STRICTLY adhere to epic and project scope - create only tasks directly required for epic completion.",
          "Do NOT add tasks for general improvements or features not explicitly mentioned in the epic.",
          "Consider the analysis depth and max_tasks parameters for scope."
        ],
        available_task_properties: taskProperties.map((prop: any) => prop.key),
        task_sizing_guidelines: {
          session_optimization: "Tasks should be sized for completion in single AI agent application session",
          complexity_balance: "Not too small (avoid session switching) nor too large (avoid overwhelming)",
          ai_agent_focus: "Optimized for Claude Code, Codex CLI, and Gemini CLI applications",
          acceptance_criteria: "Each task should have clear, measurable acceptance criteria",
          scope_adherence: "Tasks must strictly adhere to epic and project scope with no out-of-scope additions"
        },
        next_steps: "Analyze the epic and create optimally-sized tasks using create_task tool for each required task."
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
      console.error(`❌ Epic initiation failed for epic ${epicId}:`, error);
      return this.createErrorResponse((error as Error).message || "Unknown error during epic initiation");
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
   * Helper method to generate EPIC-centered analysis prompt with task sizing guidelines
   */
  private generateEpicAnalysisPrompt(
    epicContext: any,
    projectContext: any,
    epicProperties: any[],
    projectProperties: any[],
    taskProperties: any[],
    analysisDepth: string
  ): string {
    // Extract property keys from schemas
    const epicPropertyKeys = epicProperties.map(prop => prop.key);
    const projectPropertyKeys = projectProperties.map(prop => prop.key);
    const taskPropertyKeys = taskProperties.map(prop => prop.key);

    // Build dynamic epic context object with only available properties
    const dynamicEpicContext: Record<string, any> = {};
    epicPropertyKeys.forEach(key => {
      if (epicContext.blocks && epicContext.blocks[key] !== undefined) {
        dynamicEpicContext[key] = epicContext.blocks[key];
      }
    });

    // Build dynamic project context object with only available properties (if project exists)
    const dynamicProjectContext: Record<string, any> = {};
    if (projectContext && projectContext.blocks) {
      projectPropertyKeys.forEach(key => {
        if (projectContext.blocks[key] !== undefined) {
          dynamicProjectContext[key] = projectContext.blocks[key];
        }
      });
    }

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

    // Build EPIC-centered prompt with task sizing optimization guidelines
    return `
Analyze the following EPIC and determine appropriately sized tasks optimized for AI agent applications:

=== PRIMARY EPIC CONTEXT ===
${JSON.stringify(dynamicEpicContext, null, 2)}

=== SUPPORTING PROJECT CONTEXT ===
${projectContext ? JSON.stringify(dynamicProjectContext, null, 2) : 'No parent project context available'}

=== ANALYSIS PARAMETERS ===
Analysis Depth: ${analysisDepth}

=== TASK SIZING GUIDELINES FOR AI AGENT APPLICATIONS ===

**Session Optimization:**
- Tasks should be completable in a single Claude Code, Codex CLI, and Gemini CLI session
- Avoid micro-tasks that require constant context switching between sessions
- Avoid mega-tasks that exceed Claude Code, Codex CLI, and Gemini CLI application attention span or context limits

**Complexity Balance:**
- OPTIMAL: Tasks that include 3-8 implementation steps or checkboxes
- TOO SMALL: Single-line code changes, trivial file moves, simple config updates
- TOO LARGE: Complete system implementations, multi-file refactors affecting >10 files

**AI Agent Application Focus:**
- Optimized for Claude Code, Codex CLI, and Gemini CLI workflows
- Each task should have clear entry and exit criteria
- Tasks should be self-contained with minimal external dependencies
- Include specific file paths, function names, and implementation details

**Acceptance Criteria:**
- Each task must have measurable, testable completion criteria
- Include verification steps that can be automated or easily checked
- Specify expected outputs, file changes, or behavior modifications

**STRICT SCOPE ADHERENCE:**
- Tasks MUST strictly adhere to the epic and project scope - no additions beyond defined objectives
- Only create tasks that directly contribute to the epic's stated goals and deliverables
- Do NOT add tasks for general improvements, refactoring, or features not explicitly mentioned in the epic
- Focus exclusively on what is required to complete the epic as specified in both epic and project context
- Validate each task against the epic's description and analysis to ensure relevance and necessity

=== AVAILABLE TASK PROPERTIES ===
${JSON.stringify(taskPropertyKeys, null, 2)}

=== TASK PROPERTY DETAILS ===
${JSON.stringify(taskPropertyDetails, null, 2)}

Content Properties (for descriptions, documentation):
${JSON.stringify(contentProperties.map(p => p.key), null, 2)}

Structural Properties (for checklists, implementation steps):
${JSON.stringify(structuralProperties.map(p => p.key), null, 2)}

Metadata Properties (for categorization, tracking):
${JSON.stringify(metadataProperties.map(p => p.key), null, 2)}

=== ANALYSIS REQUIREMENTS ===

Please provide a structured EPIC-centered analysis with the following:

1. **Epic Scope Assessment**
   - Overall epic complexity and implementation scope
   - Key technical challenges and risks
   - Dependencies on external systems or components

2. **Optimal Task Breakdown Strategy**
   - Recommended task structure optimized for AI agent application completion
   - Task sizing rationale based on complexity and AI agent application capabilities
   - Implementation sequence and dependencies

3. **Individual Task Specifications**
   For each task, provide:
   - Title (clear, actionable, specific)
   - Description (context, requirements, constraints)
   - Items (3-8 specific implementation steps/checkboxes)
   ${taskPropertyKeys.filter(key => key !== 'Title' && key !== 'Description' && key !== 'Items')
     .map(key => `   - ${key} (as appropriate)`).join('\n')}

4. **Task Relationship Mapping**
   - Parent-child relationships and dependencies
   - Recommended execution order for optimal workflow
   - Parallel execution opportunities

5. **AI Agent Application Optimization Metrics**
   - Estimated completion time per task (target: 30-60 minutes)
   - Complexity score (1-10, target: 4-7 for optimal AI agent application performance)
   - Self-containment rating (minimal external dependencies)
   - Scope adherence rating (strict alignment with epic and project objectives)

6. **Quality Assurance Guidelines**
   - Verification steps for each task
   - Testing requirements and acceptance criteria
   - Success metrics and completion indicators

**CRITICAL REQUIREMENTS:**
- All tasks MUST have parent_id set to the epic ID (${epicContext.id})
- Follow task sizing guidelines to ensure optimal AI agent application completion
- Include specific acceptance criteria that can be verified programmatically
- Ensure each task is self-contained but contributes to the epic's overall goals
- Balance task granularity: not too small (micro-management) nor too large (overwhelming)

Important: Focus on the EPIC as the primary context, using project context as supporting information only. Ensure all tasks are strictly scoped to the epic's objectives and do not extend beyond the defined scope.
`;
  }

  /**
   * Helper method to generate PROJECT-centered epic analysis prompt for initiate_project workflow
   */
  private generateEpicAnalysisPromptForProject(
    projectContext: any,
    projectProperties: any[],
    epicProperties: any[],
    analysisDepth: string
  ): string {
    // Extract property keys from schemas
    const projectPropertyKeys = projectProperties.map(prop => prop.key);
    const epicPropertyKeys = epicProperties.map(prop => prop.key);

    // Build dynamic project context object with only available properties
    const dynamicProjectContext: Record<string, any> = {};
    projectPropertyKeys.forEach(key => {
      if (projectContext.blocks && projectContext.blocks[key] !== undefined) {
        dynamicProjectContext[key] = projectContext.blocks[key];
      }
    });

    // Group epic properties by type for better analysis
    const epicPropertyDetails = epicProperties.map(prop => ({
      key: prop.key,
      type: prop.type,
      description: prop.description,
      required: prop.fixed || false
    }));

    // Categorize epic properties for better analysis
    const contentProperties = epicPropertyDetails.filter(p =>
      ['text', 'markdown', 'string'].includes(p.type.toLowerCase()));
    const structuralProperties = epicPropertyDetails.filter(p =>
      ['list', 'array', 'object'].includes(p.type.toLowerCase()));
    const metadataProperties = epicPropertyDetails.filter(p =>
      !contentProperties.some(cp => cp.key === p.key) &&
      !structuralProperties.some(sp => sp.key === p.key));

    // Build PROJECT-centered epic analysis prompt
    return `
Analyze the following PROJECT and determine appropriate EPICS to create for successful project completion:

=== PROJECT CONTEXT ===
${JSON.stringify(dynamicProjectContext, null, 2)}

=== ANALYSIS PARAMETERS ===
Analysis Depth: ${analysisDepth}

=== EPIC CREATION GUIDELINES FOR PROJECT INITIATION ===

**Epic Definition:**
- Epics are high-level functional groupings that represent major project components
- Each epic should be large enough to warrant separate development streams but small enough to be manageable
- Epics should represent logical business or technical boundaries within the project

**Epic Sizing Guidelines:**
- OPTIMAL: Epics that represent 2-4 weeks of development work when broken down into tasks
- TOO SMALL: Features that could be single tasks or minor components
- TOO LARGE: Entire systems or components that span multiple business domains

**Project-to-Epic Decomposition:**
- Analyze the project's scope, objectives, and technical requirements
- Identify major functional areas, technical components, or user-facing features
- Group related functionality into logical epics
- Consider dependencies between epics for proper sequencing

**Epic Independence:**
- Each epic should be implementable and testable as a cohesive unit
- Minimize cross-epic dependencies where possible
- Each epic should deliver tangible user or system value when completed

=== AVAILABLE EPIC PROPERTIES ===
${JSON.stringify(epicPropertyKeys, null, 2)}

=== EPIC PROPERTY DETAILS ===
${JSON.stringify(epicPropertyDetails, null, 2)}

Content Properties (for epic descriptions, objectives):
${JSON.stringify(contentProperties.map(p => p.key), null, 2)}

Structural Properties (for epic breakdown, analysis):
${JSON.stringify(structuralProperties.map(p => p.key), null, 2)}

Metadata Properties (for epic classification, tracking):
${JSON.stringify(metadataProperties.map(p => p.key), null, 2)}

=== ANALYSIS REQUIREMENTS ===

Please provide a structured PROJECT-centered analysis with the following:

1. **Project Scope Assessment**
   - Overall project complexity and technical scope
   - Key functional areas and technical components
   - Major user-facing features and system capabilities

2. **Epic Decomposition Strategy**
   - Recommended epic structure based on project analysis
   - Epic sizing rationale focusing on logical functional boundaries
   - Epic sequencing and dependency considerations

3. **Individual Epic Specifications**
   For each epic, provide:
   - Title (clear, functional, specific to the epic's scope)
   - Description (epic context, objectives, boundaries)
   - Analysis (epic breakdown, key components, implementation approach)
   ${epicPropertyKeys.filter(key => key !== 'Title' && key !== 'Description' && key !== 'Analysis')
     .map(key => `   - ${key} (as appropriate)`).join('\n')}

4. **Epic Relationship Mapping**
   - Dependencies between epics
   - Recommended development sequence
   - Integration points and shared components

5. **Project Completion Strategy**
   - How epics collectively address project objectives
   - Success criteria for each epic
   - Project-level integration and testing approach

**CRITICAL REQUIREMENTS:**
- All epics MUST have parent_id set to the project ID (${projectContext.id})
- Focus on functional decomposition rather than technical implementation details
- Each epic should represent a meaningful project milestone
- Epics should be sized appropriately for team-based development
- Ensure complete project coverage - all project objectives should be addressed by epics

Important: Focus on the PROJECT as the primary context. Create epics that represent major functional areas or technical components that collectively deliver the project's objectives.
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

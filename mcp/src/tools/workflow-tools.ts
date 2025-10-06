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
        description: "Load task and project context, then provide guided execution with explicit approval gates. This tool orchestrates task execution by loading all necessary context (task, epic, project, rules) and providing clear guidance for planning and implementation through a 10-step workflow.",
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

      // Step 2: Move task to 'doing' if not already
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

      // Step 3: Enforce branch validation
      const branchInfo = await this.checkCurrentBranchInfo(taskId);

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

      // Step 4: Load hierarchical context (epic + project)
      const hierarchicalContext = await this.loadHierarchicalContext(taskContext);
      console.log(`📁 Loaded hierarchical context: Epic=${hierarchicalContext.epic?.id || 'none'}, Project=${hierarchicalContext.project?.id || 'none'}`);

      // Step 5: Load project rules (template_id: 4)
      let projectRules: any[] = [];
      if (hierarchicalContext.project) {
        projectRules = await this.loadProjectRules(hierarchicalContext.project.id);
        console.log(`📋 Loaded ${projectRules.length} project rules`);
      }

      // Step 6-10: Generate execution context with analysis, planning, and execution instructions
      const executionContext = this.generateExecutionContext(
        taskContext,
        hierarchicalContext.project,
        hierarchicalContext.epic,
        projectRules
      );

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
   * Load hierarchical context by traversing parent chain (task → epic → project)
   */
  private async loadHierarchicalContext(taskContext: any): Promise<{ epic: any | null; project: any | null }> {
    let epic: any | null = null;
    let project: any | null = null;

    // If task has no parent, return empty context
    if (!taskContext.parent_id) {
      return { epic, project };
    }

    try {
      // Load immediate parent
      const parentResponse = await this.objectTools.handle('get_object', { object_id: taskContext.parent_id });
      const parentText = parentResponse.content[0].text;
      const parent = JSON.parse(parentText);

      // Determine parent type and traverse upward
      if (parent.template_id === 2) {
        // Parent is a project
        project = parent;
      } else if (parent.template_id === 3) {
        // Parent is an epic
        epic = parent;

        // Load epic's parent (should be a project)
        if (epic.parent_id) {
          try {
            const projectResponse = await this.objectTools.handle('get_object', { object_id: epic.parent_id });
            const projectText = projectResponse.content[0].text;
            project = JSON.parse(projectText);
          } catch (error) {
            console.error('Error loading project from epic parent:', error);
          }
        }
      } else if (parent.template_id === 1) {
        // Parent is a task (subtask scenario)
        // Load task's parent recursively to find epic/project
        const grandparentContext = await this.loadHierarchicalContext(parent);
        epic = grandparentContext.epic;
        project = grandparentContext.project;
      }
    } catch (error) {
      console.error('Error loading hierarchical context:', error);
    }

    return { epic, project };
  }

  /**
   * Load project rules by querying objects with template_id: 4 and parent_id: projectId
   */
  private async loadProjectRules(projectId: number): Promise<any[]> {
    try {
      const rulesResponse = await this.objectTools.handle('list_objects', {
        parent_id: projectId,
        template_id: 4
      });

      const rulesText = rulesResponse.content[0].text;
      const rulesData = JSON.parse(rulesText);

      return rulesData.objects || [];
    } catch (error) {
      console.error('Error loading project rules:', error);
      return [];
    }
  }

  /**
   * Generate branch action context when user needs to create/switch branch
   */
  private generateBranchCreationContext(task: any, branchInfo: {
    currentBranch: string;
    expectedBranch: string;
    branchExists: boolean;
    suggestion: 'create' | 'switch' | 'continue';
  }): string {
    const { currentBranch, expectedBranch, branchExists, suggestion } = branchInfo;

    // Build options based on branch state
    const options = [];

    if (branchExists) {
      // Option 1: Switch to existing branch
      options.push({
        action: "switch",
        command: `git checkout ${expectedBranch}`,
        description: `Switch to existing branch '${expectedBranch}'`,
        recommended: suggestion === 'switch'
      });
    } else {
      // Option 1: Create new branch
      options.push({
        action: "create",
        command: `git checkout -b ${expectedBranch}`,
        description: `Create and switch to new branch '${expectedBranch}'`,
        recommended: suggestion === 'create'
      });
    }

    // Option 2: Continue on current branch (always available as override)
    options.push({
      action: "continue",
      command: null,
      description: `Continue working on current branch '${currentBranch}'`,
      recommended: false,
      warning: "This may mix task work with other changes on this branch"
    });

    const context = {
      task_id: task.id,
      status: "Branch action required",
      current_branch: currentBranch,
      expected_branch: expectedBranch,
      branch_exists: branchExists,
      task_title: task.blocks?.Title || `Task ${task.id}`,

      options,

      recommended_action: suggestion === 'switch'
        ? `Switch to existing branch '${expectedBranch}'`
        : `Create new branch '${expectedBranch}'`,

      instructions: [
        `**Current Situation**: You are on branch '${currentBranch}'`,
        `**Expected Branch**: task-${task.id}`,
        `**Branch Status**: ${branchExists ? 'Already exists' : 'Does not exist'}`,
        "",
        "**Choose one of the following options:**",
        "",
        branchExists
          ? `1. **Switch to existing branch** (Recommended):`
          : `1. **Create new branch** (Recommended):`,
        branchExists
          ? `   git checkout ${expectedBranch}`
          : `   git checkout -b ${expectedBranch}`,
        "",
        `2. **Continue on current branch** '${currentBranch}':`,
        `   Re-run execute_task to proceed without changing branches`,
        `   ⚠️ Warning: Task work may mix with other changes`,
        "",
        "After taking action, re-run execute_task to continue with implementation"
      ],

      branch_naming_guidelines: [
        "- Branch names follow the format: task-{task_id}",
        "- Simple, consistent naming for easy identification",
        `- Example: ${expectedBranch}`
      ],

      task_context: task,
      next_steps: branchExists
        ? `Switch to branch '${expectedBranch}' or continue on current branch, then re-run execute_task`
        : `Create branch '${expectedBranch}' or continue on current branch, then re-run execute_task`
    };

    return JSON.stringify(context, null, 2);
  }

  /**
   * Generate execution context for implementation when branch is ready
   * Includes hierarchical context, project rules, and execution workflow instructions
   */
  private generateExecutionContext(task: any, projectContext: any, epicContext: any, projectRules: any[]): string {
    const context = {
      task_id: task.id,
      status: "Ready for execution",
      task_title: task.blocks?.Title || `Task ${task.id}`,
      workflow_steps: [
        "Step 6: Analyze task requirements with full context (task, epic, project, rules)",
        "Step 7: Plan implementation approach - present plan for user approval",
        "Step 8: Request explicit permission to execute",
        "Step 9: Execute implementation after approval",
        "Step 10: After completion, task will be moved to 'review' stage"
      ],
      task_context: task,
      epic_context: epicContext || null,
      project_context: projectContext || null,
      project_rules: projectRules.map(rule => ({
        id: rule.id,
        title: rule.title,
        description: rule.description
      })),
      analysis_instructions: [
        "1. Review the task requirements in task_context (includes all task properties/blocks)",
        "2. Consider epic context (if available) for broader feature scope and epic-level properties",
        "3. Apply project context (includes all project properties/blocks - structure, guidelines, stack, etc.)",
        "4. Follow all project_rules during implementation",
        "5. Present a detailed implementation plan for user approval",
        "6. Wait for explicit approval before proceeding with execution"
      ],
      execution_instructions: [
        "1. After user approves the plan, request permission to execute",
        "2. Implement changes according to approved plan",
        "3. Follow project guidelines and best practices",
        "4. Test implementation to ensure quality",
        "5. REQUIRED: When all work is complete, you MUST call update_task tool with task_id and stage='review' to transition this task to review stage"
      ],
      completion_requirements: [
        "- All task requirements must be fulfilled",
        "- Code must follow project guidelines and rules",
        "- Implementation must be tested and verified",
        "- CRITICAL: Task stage MUST be updated to 'review' by calling: update_task with parameters {task_id: " + task.id + ", stage: 'review'}"
      ],
      next_steps: "Analyze context and present implementation plan for approval",
      reminder: "IMPORTANT: At the end of implementation, you must call update_task to move this task to 'review' stage, just as it was automatically moved to 'doing' at the start."
    };

    return JSON.stringify(context, null, 2);
  }


  /**
   * Check if a git branch exists locally
   */
  private async checkBranchExists(branchName: string): Promise<boolean> {
    try {
      const { execSync } = await import('child_process');
      const output = execSync(`git branch --list ${branchName}`).toString().trim();
      return output.length > 0;
    } catch (error) {
      console.error('Error checking branch existence:', error);
      return false;
    }
  }

  /**
   * Check current branch information with actual git command execution
   * Validates that current branch matches expected task branch format: task-{taskId}
   */
  private async checkCurrentBranchInfo(taskId: number): Promise<{
    currentBranch: string;
    expectedBranch: string;
    branchExists: boolean;
    requiresBranch: boolean;
    suggestion: 'create' | 'switch' | 'continue';
  }> {
    let currentBranch = "unknown";

    try {
      // Execute git command to get current branch
      const { execSync } = await import('child_process');
      currentBranch = execSync('git rev-parse --abbrev-ref HEAD').toString().trim();
    } catch (error) {
      console.error('Error detecting git branch:', error);
      currentBranch = "main"; // Safe fallback
    }

    const expectedBranch = `task-${taskId}`;
    const branchExists = await this.checkBranchExists(expectedBranch);

    // Determine if branch action is required and what action to suggest
    let requiresBranch = false;
    let suggestion: 'create' | 'switch' | 'continue' = 'continue';

    if (currentBranch === expectedBranch) {
      // Already on correct branch - continue
      requiresBranch = false;
      suggestion = 'continue';
    } else if (branchExists) {
      // Expected branch exists but not on it - suggest switch
      requiresBranch = true;
      suggestion = 'switch';
    } else {
      // Expected branch doesn't exist - suggest create
      requiresBranch = true;
      suggestion = 'create';
    }

    return {
      currentBranch,
      expectedBranch,
      branchExists,
      requiresBranch,
      suggestion
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

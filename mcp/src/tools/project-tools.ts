import { Tool, TextContent } from "@modelcontextprotocol/sdk/types.js";
import { TaskData } from "../types/task.js";
import { SchemaProperties, ExecutionChainItem } from "../types/property.js";
import DatabaseService from "../database.js";
import { stateEvents, StateChangeEvent } from "../events/state-events.js";

export class ProjectTools {
  constructor(
    private sharedDbService: DatabaseService,
    private clientId: string,
    private loadDynamicSchemaProperties: () => Promise<SchemaProperties>,
    private createExecutionChain: (properties: SchemaProperties) => ExecutionChainItem[],
    private validateDependencies: (properties: SchemaProperties, args: Record<string, any>, isUpdateContext?: boolean) => boolean
  ) {}

  getToolDefinitions(allProperties: Record<string, any>): Tool[] {
    return [
      {
        name: "create_project",
        description: "Create a detailed project plan with markdown formatting, make sure you populate 'Title' and 'Description' and later all the rest of the properties. Use parent_id to create hierarchical projects (e.g., subprojects under a project).",
        inputSchema: {
          type: "object",
          properties: {
            parent_id: {
              type: "number",
              description: "Optional parent project ID to create hierarchical relationships (subprojects under parent projects)"
            },
            ...allProperties
          },
          required: ["Title", "Description"],
        },
      } as Tool,
      {
        name: "update_project",
        description: "Update an existing project plan by project ID. Provide the project_id and any subset of fields to update. All fields except project_id are optional. To change a project's stage, include the 'stage' parameter with one of these values: 'draft', 'backlog', 'doing', 'review', or 'completed'.",
        inputSchema: {
          type: "object",
          properties: {
            project_id: {
              type: "number",
              description: "The numeric ID of the project to update"
            },
            parent_id: {
              type: "number",
              description: "Optional parent project ID for hierarchical relationships"
            },
            ...allProperties
          },
          required: ["project_id"],
        },
      } as Tool,
      {
        name: "list_projects",
        description: "List all projects",
        inputSchema: {
          type: "object",
          properties: {},
          required: [],
        },
      } as Tool,
      {
        name: "get_project",
        description: "Retrieve a project by its numeric ID",
        inputSchema: {
          type: "object",
          properties: {
            project_id: {
              type: "number",
              description: "The numeric ID of the project to retrieve"
            }
          },
          required: ["project_id"],
        },
      } as Tool,
      {
        name: "delete_project",
        description: "Delete a project by its numeric ID. This permanently removes the project but preserves associated tasks (sets their project_id to NULL).",
        inputSchema: {
          type: "object",
          properties: {
            project_id: {
              type: "number",
              description: "The numeric ID of the project to delete"
            }
          },
          required: ["project_id"],
        },
      } as Tool,
      {
        name: "select_project",
        description: "Select a project to set as the global default context for all MCP tools and UI sessions. Use null to deselect.",
        inputSchema: {
          type: "object",
          properties: {
            project_id: {
              type: ["number", "null"],
              description: "The numeric ID of the project to select, or null to deselect"
            }
          },
          required: ["project_id"],
        },
      } as Tool,
      {
        name: "get_selected_project",
        description: "Get the currently selected global project ID. Returns null if no project is selected.",
        inputSchema: {
          type: "object",
          properties: {},
          required: [],
        },
      } as Tool,
    ];
  }

  canHandle(toolName: string): boolean {
    return ["create_project", "update_project", "list_projects", "get_project", "delete_project", "select_project", "get_selected_project"].includes(toolName);
  }

  async handle(name: string, toolArgs?: Record<string, any>) {
    switch (name) {
      case "create_project":
        return await this.handleCreateProject(toolArgs);
      case "update_project":
        return await this.handleUpdateProject(toolArgs);
      case "list_projects":
        return await this.handleListProjects(toolArgs);
      case "get_project":
        return await this.handleGetProject(toolArgs);
      case "delete_project":
        return await this.handleDeleteProject(toolArgs);
      case "select_project":
        return await this.handleSelectProject(toolArgs);
      case "get_selected_project":
        return await this.handleGetSelectedProject();
      default:
        throw new Error(`Unknown project tool: ${name}`);
    }
  }

  private async handleCreateProject(toolArgs?: Record<string, any>) {
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

    // Handle parent_id for hierarchical projects
    if (toolArgs?.parent_id !== undefined) {
      taskData.parent_id = toolArgs.parent_id;
      console.log(`Creating project with parent_id ${toolArgs.parent_id}`);
    } else {
      // If no parent_id is provided, use the selected project from global state
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

    // Set template_id to 2 for projects (create_project always creates projects, not tasks)
    taskData.template_id = 2;

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
      console.error('Error creating project:', error);
      return {
        content: [
          {
            type: "text",
            text: "Error: Failed to create project in database.",
          } as TextContent,
        ],
      };
    }

    // Create the markdown formatted project plan
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
  
    const templateId = taskData.template_id || 2;
    const typeDisplay = templateId === 2 ? 'Project' : 'Task';
  
    let markdownContent = `# ${typeDisplay}
**${typeDisplay} ID:** ${taskId}

**Title:** ${title}

**Project ID:** ${projectId || 'None'}

**Project Name:** ${projectInfo}

## Description

${description}
`;

    // Process properties in execution order
    for (const { prop_name } of executionChain) {
      const value = toolArgs?.[prop_name] || "";
      if (value && prop_name !== 'Title' && prop_name !== 'Description') {
        markdownContent += `\n## ${prop_name}\n\n${value}\n`;
      }
    }

    return {
      content: [
        {
          type: "text",
          text: markdownContent,
        } as TextContent,
      ],
    };
  }

  private async handleUpdateProject(toolArgs?: Record<string, any>) {
    // Handle updating an existing project by ID
    const projectId = toolArgs?.project_id;
    
    // Validate project ID
    if (!projectId || typeof projectId !== 'number' || projectId < 1) {
      return {
        content: [
          {
            type: "text",
            text: "Error: Valid numeric project_id is required for update.",
          } as TextContent,
        ],
      };
    }

    // Check if project exists (in tasks table with template_id = 2)
    const existingProject = await this.sharedDbService.getTask(projectId);
    if (!existingProject || existingProject.template_id !== 2) {
      return {
        content: [
          {
            type: "text",
            text: `Error: Project with ID ${projectId} not found.`,
          } as TextContent,
        ],
      };
    }

    const dynamicProperties = await this.loadDynamicSchemaProperties();

    // Filter out project_id from validation since it's not a content field
    const contentArgs = { ...toolArgs };
    delete contentArgs.project_id;

    // For updates, we don't validate dependencies since we're only updating partial fields
    // The original project creation would have validated dependencies already

    // Prepare update data - all non-stage properties go to blocks
    const updateData: Partial<TaskData> = {};
    
    // Handle stage, parent_id, and template_id explicitly as they're columns in tasks table
    if (toolArgs?.stage !== undefined) {
      // Validate stage value
      const validStages = ['draft', 'backlog', 'doing', 'review', 'completed'];
      if (validStages.includes(String(toolArgs.stage))) {
        updateData.stage = String(toolArgs.stage) as any;
      }
    }
    
    if (toolArgs?.parent_id !== undefined) {
      updateData.parent_id = toolArgs.parent_id;
    }
    
    // Always ensure template_id stays 2 for projects (don't allow changing it)
    updateData.template_id = 2;

    // Create execution chain to order fields when building markdown
    const executionChain = this.createExecutionChain(dynamicProperties);

    // Add all properties (including Title, Description) to update data
    for (const { prop_name } of executionChain) {
      const value = toolArgs?.[prop_name];
      if (value !== undefined) {
        updateData[prop_name] = value;
      }
    }
    
    // Also add any properties not in the execution chain (except project_id, stage, parent_id, and template_id)
    for (const [key, value] of Object.entries(toolArgs || {})) {
      if (key !== 'project_id' && key !== 'stage' && key !== 'parent_id' && key !== 'template_id' && value !== undefined && !updateData.hasOwnProperty(key)) {
        updateData[key] = value;
      }
    }

    // Update project in database (using updateTask since projects are stored in tasks table)
    try {
      await this.sharedDbService.updateTask(projectId, updateData, this.clientId);
    } catch (error) {
      console.error('Error updating project:', error);
      return {
        content: [
          {
            type: "text",
            text: "Error: Failed to update project in database.",
          } as TextContent,
        ],
      };
    }

    let markdownContent = `# Project Update
**Project ID:** ${projectId}

`;

    // Include provided core fields first
    if (toolArgs?.Title) {
      markdownContent += `**Title (updated):** ${toolArgs.Title}\n\n`;
    }
    if (toolArgs?.Description) {
      markdownContent += `## Description (updated)\n\n${toolArgs.Description}\n`;
    }

    // Append any dynamic property updates in order
    for (const { prop_name } of executionChain) {
      const value = toolArgs?.[prop_name];
      if (value && prop_name !== 'Title' && prop_name !== 'Description') {
        markdownContent += `\n## ${prop_name} (updated)\n\n${value}\n`;
      }
    }

    // If no content fields were supplied, inform user
    const hasContentUpdates = Object.keys(contentArgs).length > 0;
    if (!hasContentUpdates) {
      markdownContent += "No fields supplied for update.";
    }

    return {
      content: [
        {
          type: "text",
          text: markdownContent,
        } as TextContent,
      ],
    };
  }

  private async handleListProjects(_toolArgs?: Record<string, any>) {
    try {
      const projects = await this.sharedDbService.listProjects();
      
      if (projects.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: "No projects found.",
            } as TextContent,
          ],
        };
      }

      // Build markdown table
      let markdownContent = `| ID | Name | Description | Color |\n| --- | --- | --- | --- |`;
      
      for (const project of projects) {
        const cleanName = String(project.name || '').replace(/\n|\r/g, ' ');
        const cleanDescription = String(project.description || '').replace(/\n|\r/g, ' ');
        const color = project.color || '#3b82f6';
        markdownContent += `\n| ${project.id} | ${cleanName} | ${cleanDescription} | ${color} |`;
      }

      return {
        content: [
          {
            type: "text",
            text: markdownContent,
          } as TextContent,
        ],
      };
    } catch (error) {
      console.error('Error listing projects:', error);
      return {
        content: [
          {
            type: "text",
            text: "Error: Failed to retrieve projects list.",
          } as TextContent,
        ],
      };
    }
  }

  private async handleGetProject(toolArgs?: Record<string, any>) {
    const projectId = toolArgs?.project_id;
    
    if (!projectId || typeof projectId !== 'number' || projectId < 1) {
      return {
        content: [
          {
            type: "text",
            text: "Error: Valid numeric project_id is required for retrieval.",
          } as TextContent,
        ],
      };
    }

    try {
      const project = await this.sharedDbService.getProject(projectId);
      
      if (!project) {
        return {
          content: [
            {
              type: "text",
              text: `Error: Project with ID ${projectId} not found.`,
            } as TextContent,
          ],
        };
      }

      const markdownContent = `# Project
**Project ID:** ${project.id}

**Name:** ${project.name}

**Description:** ${project.description || 'No description'}

**Color:** ${project.color}

**Created:** ${project.created_at.toISOString().split('T')[0]} by ${project.created_by}

**Updated:** ${project.updated_at.toISOString().split('T')[0]} by ${project.updated_by}
`;

      return {
        content: [
          {
            type: "text",
            text: markdownContent,
          } as TextContent,
        ],
      };
    } catch (error) {
      console.error('Error getting project:', error);
      return {
        content: [
          {
            type: "text",
            text: "Error: Failed to retrieve project from database.",
          } as TextContent,
        ],
      };
    }
  }

  private async handleDeleteProject(toolArgs?: Record<string, any>) {
    const projectId = toolArgs?.project_id;
    
    if (!projectId || typeof projectId !== 'number' || projectId < 1) {
      return {
        content: [
          {
            type: "text",
            text: "Error: Valid numeric project_id is required for deletion.",
          } as TextContent,
        ],
      };
    }

    // Check if project exists before attempting deletion
    const existingProject = await this.sharedDbService.getProject(projectId);
    if (!existingProject) {
      return {
        content: [
          {
            type: "text",
            text: `Error: Project with ID ${projectId} not found.`,
          } as TextContent,
        ],
      };
    }

    try {
      const deleted = await this.sharedDbService.deleteProject(projectId);
      if (deleted) {
        return {
          content: [
            {
              type: "text",
              text: `Project "${existingProject.name}" with ID ${projectId} has been successfully deleted.`,
            } as TextContent,
          ],
        };
      } else {
        return {
          content: [
            {
              type: "text",
              text: `Error: Failed to delete project with ID ${projectId}.`,
            } as TextContent,
          ],
        };
      }
    } catch (error) {
      console.error('Error deleting project:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete project from database.';
      return {
        content: [
          {
            type: "text",
            text: `Error: ${errorMessage}`,
          } as TextContent,
        ],
      };
    }
  }

  private async handleSelectProject(toolArgs?: Record<string, any>) {
    const projectId = toolArgs?.project_id;
    
    // Validate input: must be null or a positive number
    if (projectId !== null && (typeof projectId !== 'number' || projectId < 1)) {
      return {
        content: [
          {
            type: "text",
            text: "Error: project_id must be null or a positive number.",
          } as TextContent,
        ],
      };
    }

    // If project_id is provided (not null), verify the project exists
    if (projectId !== null) {
      const existingProject = await this.sharedDbService.getProject(projectId);
      if (!existingProject) {
        return {
          content: [
            {
              type: "text",
              text: `Error: Project with ID ${projectId} not found.`,
            } as TextContent,
          ],
        };
      }
    }

    try {
      // Set the global selected project state
      const success = await this.sharedDbService.setGlobalState('selected_project_id', projectId, this.clientId);
      
      if (success) {
        // Broadcast state change to all connected clients
        const stateChangeEvent: StateChangeEvent = {
          type: 'state_change',
          key: 'selected_project_id',
          value: projectId,
          timestamp: new Date().toISOString(),
          source_client: this.clientId
        };
        stateEvents.broadcastStateChange(stateChangeEvent);

        const message = projectId === null 
          ? "Project selection cleared. No project is currently selected."
          : `Project with ID ${projectId} has been selected as the global default project.`;
        
        return {
          content: [
            {
              type: "text",
              text: message,
            } as TextContent,
          ],
        };
      } else {
        return {
          content: [
            {
              type: "text",
              text: "Error: Failed to update project selection in database.",
            } as TextContent,
          ],
        };
      }
    } catch (error) {
      console.error('Error selecting project:', error);
      return {
        content: [
          {
            type: "text",
            text: "Error: Failed to select project.",
          } as TextContent,
        ],
      };
    }
  }

  private async handleGetSelectedProject() {
    try {
      // Get the global selected project state
      const selectedProjectId = await this.sharedDbService.getGlobalState('selected_project_id');
      
      return {
        content: [
          {
            type: "text",
            text: selectedProjectId === null 
              ? "No project is currently selected."
              : `Currently selected project ID: ${selectedProjectId}`,
          } as TextContent,
        ],
      };
    } catch (error) {
      console.error('Error getting selected project:', error);
      return {
        content: [
          {
            type: "text",
            text: "Error: Failed to retrieve selected project state.",
          } as TextContent,
        ],
      };
    }
  }
}

export function createProjectTools(
  sharedDbService: DatabaseService,
  clientId: string,
  loadDynamicSchemaProperties: () => Promise<SchemaProperties>,
  createExecutionChain: (properties: SchemaProperties) => ExecutionChainItem[],
  validateDependencies: (properties: SchemaProperties, args: Record<string, any>, isUpdateContext?: boolean) => boolean
): ProjectTools {
  return new ProjectTools(
    sharedDbService,
    clientId,
    loadDynamicSchemaProperties,
    createExecutionChain,
    validateDependencies
  );
}
import { Tool, TextContent } from "@modelcontextprotocol/sdk/types.js";
import DatabaseService from "../database.js";
import { stateEvents, StateChangeEvent } from "../events/state-events.js";

interface ProjectData {
  id: number;
  name: string;
  description?: string;
  color: string;
  created_at: Date;
  updated_at: Date;
  created_by: string;
  updated_by: string;
}

export class ProjectTools {
  constructor(
    private sharedDbService: DatabaseService,
    private clientId: string
  ) {}

  getToolDefinitions(): Tool[] {
    return [
      {
        name: "create_project",
        description: "Create a new project for organizing tasks",
        inputSchema: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "Project name"
            },
            description: {
              type: "string",
              description: "Optional project description"
            },
            color: {
              type: "string",
              description: "Project color (hex code, defaults to #3b82f6)"
            }
          },
          required: ["name"],
        },
      } as Tool,
      {
        name: "update_project",
        description: "Update an existing project by project ID. All fields except project_id are optional.",
        inputSchema: {
          type: "object",
          properties: {
            project_id: {
              type: "number",
              description: "The numeric ID of the project to update"
            },
            name: {
              type: "string",
              description: "Project name"
            },
            description: {
              type: "string",
              description: "Project description"
            },
            color: {
              type: "string",
              description: "Project color (hex code)"
            }
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
    const name = toolArgs?.name;
    
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return {
        content: [
          {
            type: "text",
            text: "Error: Project name is required and must be a non-empty string.",
          } as TextContent,
        ],
      };
    }

    const projectData = {
      name: name.trim(),
      description: toolArgs?.description || undefined,
      color: toolArgs?.color || '#3b82f6'
    };

    // Validate color format if provided
    if (projectData.color && !/^#[0-9A-Fa-f]{6}$/.test(projectData.color)) {
      return {
        content: [
          {
            type: "text",
            text: "Error: Color must be a valid hex code (e.g., #3b82f6).",
          } as TextContent,
        ],
      };
    }

    try {
      const projectId = await this.sharedDbService.createProject(projectData, this.clientId);
      
      return {
        content: [
          {
            type: "text",
            text: `Project "${projectData.name}" created successfully with ID ${projectId}.`,
          } as TextContent,
        ],
      };
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
  }

  private async handleUpdateProject(toolArgs?: Record<string, any>) {
    const projectId = toolArgs?.project_id;
    
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

    // Check if project exists
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

    const updates: any = {};
    
    if (toolArgs?.name !== undefined) {
      if (typeof toolArgs.name !== 'string' || toolArgs.name.trim().length === 0) {
        return {
          content: [
            {
              type: "text",
              text: "Error: Project name must be a non-empty string.",
            } as TextContent,
          ],
        };
      }
      updates.name = toolArgs.name.trim();
    }
    
    if (toolArgs?.description !== undefined) {
      updates.description = toolArgs.description;
    }
    
    if (toolArgs?.color !== undefined) {
      if (!/^#[0-9A-Fa-f]{6}$/.test(toolArgs.color)) {
        return {
          content: [
            {
              type: "text",
              text: "Error: Color must be a valid hex code (e.g., #3b82f6).",
            } as TextContent,
          ],
        };
      }
      updates.color = toolArgs.color;
    }

    if (Object.keys(updates).length === 0) {
      return {
        content: [
          {
            type: "text",
            text: "Error: No valid fields provided for update.",
          } as TextContent,
        ],
      };
    }

    try {
      await this.sharedDbService.updateProject(projectId, updates, this.clientId);
      
      return {
        content: [
          {
            type: "text",
            text: `Project with ID ${projectId} updated successfully.`,
          } as TextContent,
        ],
      };
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
  }

  private async handleListProjects(toolArgs?: Record<string, any>) {
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
  clientId: string
): ProjectTools {
  return new ProjectTools(sharedDbService, clientId);
}
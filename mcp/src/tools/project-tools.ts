import { Tool, TextContent } from "@modelcontextprotocol/sdk/types.js";
import { TaskData } from "../types/task.js";
import { SchemaProperties, ExecutionChainItem } from "../types/property.js";
import DatabaseService from "../database.js";
import { stateEvents, StateChangeEvent } from "../events/state-events.js";
import { handleCreate } from "./create-handler.js";
import { handleUpdate } from "./update-handler.js";

export class ProjectTools {
  constructor(
    private sharedDbService: DatabaseService,
    private clientId: string,
    private loadProjectSchemaProperties: () => Promise<SchemaProperties>,
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
    return ["create_project", "update_project", "select_project", "get_selected_project"].includes(toolName);
  }

  async handle(name: string, toolArgs?: Record<string, any>) {
    switch (name) {
      case "create_project":
        return await this.handleCreateProject(toolArgs);
      case "update_project":
        return await this.handleUpdateProject(toolArgs);
      case "select_project":
        return await this.handleSelectProject(toolArgs);
      case "get_selected_project":
        return await this.handleGetSelectedProject();
      default:
        throw new Error(`Unknown project tool: ${name}`);
    }
  }

  private async handleCreateProject(toolArgs?: Record<string, any>) {
    return handleCreate(
      {
        templateId: 2,
        typeName: "Project",
        responseIdField: "project_id",
        loadSchema: this.loadProjectSchemaProperties,
      },
      toolArgs,
      this.sharedDbService,
      this.clientId,
      this.createExecutionChain,
      this.validateDependencies
    );
  }

  private async handleUpdateProject(toolArgs?: Record<string, any>) {
    return handleUpdate(
      {
        templateId: 2,
        typeName: "Project",
        idField: "project_id",
        loadSchema: this.loadProjectSchemaProperties,
      },
      toolArgs,
      this.sharedDbService,
      this.clientId,
      this.createExecutionChain
    );
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


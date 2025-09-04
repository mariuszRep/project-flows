import { Tool, TextContent } from "@modelcontextprotocol/sdk/types.js";
import { EpicData, EpicStage } from "../types/epic.js";
import { SchemaProperties, ExecutionChainItem } from "../types/property.js";
import DatabaseService from "../database.js";

export class EpicTools {
  constructor(
    private sharedDbService: DatabaseService,
    private clientId: string,
    private loadDynamicSchemaProperties: () => Promise<SchemaProperties>,
    private createExecutionChain: (properties: SchemaProperties) => ExecutionChainItem[],
    private validateDependencies: (properties: SchemaProperties, args: Record<string, any>, isUpdateContext?: boolean) => boolean,
    private projectTools?: any
  ) {}

  getToolDefinitions(allProperties: Record<string, any>): Tool[] {
    return [
      {
        name: "create_epic",
        description: "Create a new epic with specified template_id. For epics, use template_id=3 and parent must be a project.",
        inputSchema: {
          type: "object",
          properties: {
            parent_id: {
              type: "number",
              description: "Optional parent project ID for hierarchical relationships"
            },
            ...allProperties
          },
          required: ["Title", "Description"],
        },
      } as Tool,
      {
        name: "update_epic",
        description: "Update an existing epic by epic ID. Provide the epic_id and any subset of fields to update. All fields except epic_id are optional.",
        inputSchema: {
          type: "object",
          properties: {
            epic_id: {
              type: "number",
              description: "The numeric ID of the epic to update"
            },
            parent_id: {
              type: "number",
              description: "Optional parent project ID for hierarchical relationships"
            },
            ...allProperties
          },
          required: ["epic_id"],
        },
      } as Tool,
    ];
  }

  canHandle(toolName: string): boolean {
    return ["create_epic", "update_epic"].includes(toolName);
  }

  async handle(name: string, toolArgs?: Record<string, any>) {
    switch (name) {
      case "create_epic":
        return await this.handleCreateEpic(toolArgs);
      case "update_epic":
        return await this.handleUpdateEpic(toolArgs);
      default:
        throw new Error(`Unknown epic tool: ${name}`);
    }
  }

  private async handleCreateEpic(toolArgs?: Record<string, any>) {
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

    // Prepare epic data - all properties go into blocks now
    const epicData: Omit<EpicData, 'id'> = {};

    // Handle parent_id for hierarchical epics (epics must have projects as parents)
    if (toolArgs?.parent_id !== undefined) {
      // Validate that parent is a project (template_id=2)
      try {
        const parentProject = await this.sharedDbService.getTask(toolArgs.parent_id);
        if (!parentProject || parentProject.template_id !== 2) {
          return {
            content: [
              {
                type: "text",
                text: "Error: Epics must have a project as parent (template_id=2).",
              } as TextContent,
            ],
          };
        }
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: "Error: Parent project not found or invalid.",
            } as TextContent,
          ],
        };
      }
      epicData.parent_id = toolArgs.parent_id;
      console.log(`Creating epic with parent project ID ${toolArgs.parent_id}`);
    } else {
      // If no parent_id is provided, use the selected project from global state
      if (this.projectTools) {
        try {
          // Get the selected project ID from global state
          const selectedProjectId = await this.sharedDbService.getGlobalState('selected_project_id');
          if (selectedProjectId !== null) {
            // Validate that selected project exists and is a project
            const parentProject = await this.sharedDbService.getTask(selectedProjectId);
            if (parentProject && parentProject.template_id === 2) {
              epicData.parent_id = selectedProjectId;
              console.log(`Using selected project ID ${selectedProjectId} as parent_id`);
            }
          }
        } catch (error) {
          console.error('Error getting selected project:', error);
        }
      }
    }

    // Set template_id to 3 for epics (create_epic always creates epics)
    epicData.template_id = 3;

    // Add all properties (including Title and Description) to epic data
    for (const { prop_name } of executionChain) {
      const value = toolArgs?.[prop_name] || "";
      if (value) {
        epicData[prop_name] = value;
      }
    }
    
    // Also add any properties not in the execution chain (exclude parent_id as it's already handled)
    for (const [key, value] of Object.entries(toolArgs || {})) {
      if (value && key !== 'parent_id' && !epicData[key]) {
        epicData[key] = value;
      }
    }

    // Store epic in database
    let epicId: number;
    try {
      epicId = await this.sharedDbService.createTask(epicData, this.clientId);
    } catch (error) {
      console.error('Error creating epic:', error);
      return {
        content: [
          {
            type: "text",
            text: "Error: Failed to create epic in database.",
          } as TextContent,
        ],
      };
    }

    // Create JSON response with epic data
    const title = toolArgs?.Title || "";
    const description = toolArgs?.Description || "";
  
    // Get project/parent information if epic has parent_id
    let projectInfo = 'None';
    let projectId = epicData.parent_id;
  
    if (projectId) {
      try {
        const parentProject = await this.sharedDbService.getTask(projectId);
        projectInfo = parentProject ? `${parentProject.Title || 'Untitled'}` : 'Unknown';
      } catch (error) {
        console.error('Error loading parent project:', error);
        projectInfo = 'Unknown';
      }
    }
  
    const templateId = epicData.template_id || 3;
    const typeDisplay = 'Epic';
  
    // Build JSON response with structured data
    const jsonResponse = {
      success: true,
      epic_id: epicId,
      type: typeDisplay.toLowerCase(),
      title: title,
      description: description,
      project_id: projectId,
      project_name: projectInfo,
      template_id: templateId,
      stage: epicData.stage || 'draft',
      // Add all dynamic properties
      ...Object.fromEntries(
        executionChain
          .filter(({ prop_name }) => 
            toolArgs?.[prop_name] && 
            prop_name !== 'Title' && 
            prop_name !== 'Description'
          )
          .map(({ prop_name }) => [prop_name, toolArgs?.[prop_name]])
      )
    };

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(jsonResponse, null, 2),
        } as TextContent,
      ],
    };
  }

  private async handleUpdateEpic(toolArgs?: Record<string, any>) {
    // Handle updating an existing epic by ID
    const epicId = toolArgs?.epic_id;
    
    // Validate epic ID
    if (!epicId || typeof epicId !== 'number' || epicId < 1) {
      return {
        content: [
          {
            type: "text",
            text: "Error: Valid numeric epic_id is required for update.",
          } as TextContent,
        ],
      };
    }

    // Check if epic exists and is actually an epic (template_id=3)
    const existingEpic = await this.sharedDbService.getTask(epicId);
    if (!existingEpic || existingEpic.template_id !== 3) {
      return {
        content: [
          {
            type: "text",
            text: `Error: Epic with ID ${epicId} not found.`,
          } as TextContent,
        ],
      };
    }

    const dynamicProperties = await this.loadDynamicSchemaProperties();

    // Filter out epic_id from validation since it's not a content field
    const contentArgs = { ...toolArgs };
    delete contentArgs.epic_id;

    // Prepare update data - all non-stage properties go to blocks
    const updateData: Partial<EpicData> = {};
    
    // Handle stage, parent_id, and template_id explicitly as they're columns in tasks table
    if (toolArgs?.stage !== undefined) {
      // Validate stage value
      const validStages = ['draft', 'backlog', 'doing', 'review', 'completed'];
      if (validStages.includes(String(toolArgs.stage))) {
        updateData.stage = String(toolArgs.stage) as EpicStage;
      }
    }
    
    if (toolArgs?.parent_id !== undefined) {
      // Validate that parent is a project (template_id=2) if provided
      if (toolArgs.parent_id !== null) {
        try {
          const parentProject = await this.sharedDbService.getTask(toolArgs.parent_id);
          if (!parentProject || parentProject.template_id !== 2) {
            return {
              content: [
                {
                  type: "text",
                  text: "Error: Epics must have a project as parent (template_id=2).",
                } as TextContent,
              ],
            };
          }
        } catch (error) {
          return {
            content: [
              {
                type: "text",
                text: "Error: Parent project not found or invalid.",
              } as TextContent,
            ],
          };
        }
      }
      updateData.parent_id = toolArgs.parent_id;
    }
    
    // Set template_id to 3 for epics (consistent with create_epic)
    updateData.template_id = 3;

    // Create execution chain to order fields when building markdown
    const executionChain = this.createExecutionChain(dynamicProperties);

    // Add all properties (including Title, Description) to update data
    for (const { prop_name } of executionChain) {
      const value = toolArgs?.[prop_name];
      if (value !== undefined) {
        updateData[prop_name] = value;
      }
    }
    
    // Also add any properties not in the execution chain (except epic_id, stage, parent_id, and template_id)
    for (const [key, value] of Object.entries(toolArgs || {})) {
      if (key !== 'epic_id' && key !== 'stage' && key !== 'parent_id' && key !== 'template_id' && value !== undefined && !updateData.hasOwnProperty(key)) {
        updateData[key] = value;
      }
    }

    // Update epic in database
    try {
      const updateResult = await this.sharedDbService.updateTask(epicId, updateData, this.clientId);
      if (!updateResult) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ success: false, message: "No updates were applied." }, null, 2),
            } as TextContent,
          ],
        };
      }
    } catch (error) {
      console.error('Error updating epic:', error);
      return {
        content: [
          {
            type: "text",
            text: "Error: Failed to update epic in database.",
          } as TextContent,
        ],
      };
    }

    // After successful update, return the updated epic details in JSON format
    const updatedEpic = await this.sharedDbService.getTask(epicId);
    if (!updatedEpic) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ success: false, message: "Epic not found after update." }, null, 2),
          } as TextContent,
        ],
      };
    }

    // Build blocks object dynamically from epic properties
    const blocks: Record<string, string> = {};
    const systemFields = ['id', 'stage', 'template_id', 'parent_id', 'created_at', 'updated_at', 'created_by', 'updated_by'];
    for (const [key, value] of Object.entries(updatedEpic)) {
      if (!systemFields.includes(key) && value) {
        blocks[key] = String(value);
      }
    }

    const jsonResponse = {
      success: true,
      id: updatedEpic.id,
      stage: updatedEpic.stage || 'draft',
      template_id: 3,
      parent_id: updatedEpic.parent_id,
      blocks: blocks
    };

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(jsonResponse, null, 2),
        } as TextContent,
      ],
    };
  }

}

export function createEpicTools(
  sharedDbService: DatabaseService,
  clientId: string,
  loadDynamicSchemaProperties: () => Promise<SchemaProperties>,
  createExecutionChain: (properties: SchemaProperties) => ExecutionChainItem[],
  validateDependencies: (properties: SchemaProperties, args: Record<string, any>, isUpdateContext?: boolean) => boolean,
  projectTools?: any
): EpicTools {
  return new EpicTools(
    sharedDbService,
    clientId,
    loadDynamicSchemaProperties,
    createExecutionChain,
    validateDependencies,
    projectTools
  );
}
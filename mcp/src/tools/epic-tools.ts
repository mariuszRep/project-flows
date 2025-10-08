import { Tool, TextContent } from "@modelcontextprotocol/sdk/types.js";
import { EpicData, EpicStage } from "../types/epic.js";
import { SchemaProperties, ExecutionChainItem } from "../types/property.js";
import DatabaseService from "../database.js";
import { handleCreate } from "./create-handler.js";

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
    return handleCreate(
      {
        templateId: 3,
        typeName: "Epic",
        responseIdField: "epic_id",
        loadSchema: this.loadDynamicSchemaProperties,
        validateParent: async (parentId: number, dbService: DatabaseService) => {
          // Validate that parent is a project (template_id=2)
          const parentProject = await dbService.getTask(parentId);
          if (!parentProject || parentProject.template_id !== 2) {
            throw new Error("Error: Epics must have a project as parent (template_id=2).");
          }
        },
      },
      toolArgs,
      this.sharedDbService,
      this.clientId,
      this.createExecutionChain,
      this.validateDependencies,
      this.projectTools
    );
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
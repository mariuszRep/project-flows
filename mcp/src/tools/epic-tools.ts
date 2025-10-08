import { Tool, TextContent } from "@modelcontextprotocol/sdk/types.js";
import { EpicData, EpicStage } from "../types/epic.js";
import { SchemaProperties, ExecutionChainItem } from "../types/property.js";
import DatabaseService from "../database.js";
import { handleCreate } from "./create-handler.js";
import { handleUpdate } from "./update-handler.js";

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
    return handleUpdate(
      {
        templateId: 3,
        typeName: "Epic",
        idField: "epic_id",
        loadSchema: this.loadDynamicSchemaProperties,
        validateTemplateId: true,
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
      this.createExecutionChain
    );
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
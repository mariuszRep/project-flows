import { Tool, TextContent } from "@modelcontextprotocol/sdk/types.js";
import { TaskStage } from "../types/task.js";
import DatabaseService from "../database.js";
import { SchemaProperties, ExecutionChainItem } from "../types/property.js";
import { handleCreate, CreateConfig } from "./create-handler.js";

export class ObjectTools {
  constructor(
    private sharedDbService: DatabaseService,
    private clientId: string,
    private createExecutionChain: (properties: SchemaProperties) => ExecutionChainItem[],
    private validateDependencies: (properties: SchemaProperties, args: Record<string, any>, isUpdateContext?: boolean) => boolean,
    private loadDynamicSchemaProperties: () => Promise<SchemaProperties>,
    private loadProjectSchemaProperties: () => Promise<SchemaProperties>,
    private loadEpicSchemaProperties: () => Promise<SchemaProperties>,
    private loadRuleSchemaProperties: () => Promise<SchemaProperties>,
    private projectTools?: any
  ) {}

  getToolDefinitions(): Tool[] {
    return [
      {
        name: "create_object",
        description: "Create any object type (task, project, epic, rule) by specifying template_id. Accepts template_id and all dynamic properties for that template type. This is a generic base tool that works with all object templates.",
        inputSchema: {
          type: "object",
          properties: {
            template_id: {
              type: "number",
              description: "Required template ID (1=Task, 2=Project, 3=Epic, 4=Rule). Determines the object type to create."
            },
            Title: {
              type: "string",
              description: "Object title (usually required by template schema)"
            },
            Description: {
              type: "string",
              description: "Object description (usually required by template schema)"
            },
            Analysis: {
              type: "string",
              description: "Optional analysis field (available for some templates)"
            },
            stage: {
              type: "string",
              description: "Optional workflow stage",
              enum: ["draft", "backlog", "doing", "review", "completed"]
            },
            related: {
              type: "array",
              description: "Optional parent relationship array. Example: [{\"id\": 42, \"object\": \"project\"}]",
              items: {
                type: "object",
                properties: {
                  id: { type: "number", description: "Parent object ID" },
                  object: { type: "string", description: "Parent object type: 'task', 'project', 'epic', or 'rule'" }
                },
                required: ["id", "object"]
              }
            }
          },
          required: ["template_id"],
        },
      } as Tool,
      {
        name: "get_object",
        description: "Retrieve an object by its numeric ID. Returns the complete object data.",
        inputSchema: {
          type: "object",
          properties: {
            object_id: {
              type: "number",
              description: "The numeric ID of the object to retrieve"
            }
          },
          required: ["object_id"],
        },
      } as Tool,
      {
        name: "delete_object",
        description: "Delete an object by its numeric ID. This permanently removes the object and all its associated data.",
        inputSchema: {
          type: "object",
          properties: {
            object_id: {
              type: "number",
              description: "The numeric ID of the object to delete"
            }
          },
          required: ["object_id"],
        },
      } as Tool,
      {
        name: "list_objects",
        description: "List all objects with their ID, Title, Summary, Stage, Type, and Parent. Shows hierarchical relationships. Optionally filter by stage, type, or project.",
        inputSchema: {
          type: "object",
          properties: {
            template_id: {
              type: "number",
              description: "Optional template ID to filter objects"
            },
            parent_id: {
              type: "number",
              description: "Optional parent ID to filter child objects"
            },
            stage: {
              type: "string",
              description: "Optional stage filter: 'draft', 'backlog', 'doing', 'review', or 'completed'"
            }
          }
        },
      } as Tool,
    ];
  }

  canHandle(toolName: string): boolean {
    return ["create_object", "get_object", "delete_object", "list_objects"].includes(toolName);
  }

  async handle(name: string, toolArgs?: Record<string, any>) {
    switch (name) {
      case "create_object":
        return await this.handleCreateObject(toolArgs);
      case "get_object":
        return await this.handleGetObject(toolArgs);
      case "delete_object":
        return await this.handleDeleteObject(toolArgs);
      case "list_objects":
        return await this.handleListObjects(toolArgs);
      default:
        throw new Error(`Unknown object tool: ${name}`);
    }
  }

  /**
   * Handle create_object tool - generic object creation for any template type
   */
  private async handleCreateObject(toolArgs?: Record<string, any>) {
    const templateId = toolArgs?.template_id;

    // Validate template_id parameter
    if (!templateId || typeof templateId !== 'number' || templateId < 1) {
      return {
        content: [
          {
            type: "text",
            text: "Error: Valid numeric template_id is required (1=Task, 2=Project, 3=Epic, 4=Rule).",
          } as TextContent,
        ],
      };
    }

    // Verify template exists and is an object template (not workflow)
    try {
      const templates = await this.sharedDbService.getTemplates();
      const template = templates.find(t => t.id === templateId);

      if (!template) {
        return {
          content: [
            {
              type: "text",
              text: `Error: Template with ID ${templateId} not found.`,
            } as TextContent,
          ],
        };
      }

      // Check if template type is 'object' (not 'workflow')
      // Note: templates table now has 'type' column from migration 001
      if ((template as any).type && (template as any).type !== 'object') {
        return {
          content: [
            {
              type: "text",
              text: `Error: Template ${templateId} is a '${(template as any).type}' template. Use create_object only with object templates (type='object').`,
            } as TextContent,
          ],
        };
      }
    } catch (error) {
      console.error('Error validating template:', error);
      return {
        content: [
          {
            type: "text",
            text: `Error: Failed to validate template ${templateId}.`,
          } as TextContent,
        ],
      };
    }

    // Map template_id to appropriate configuration
    let config: CreateConfig;

    switch (templateId) {
      case 1:
        config = {
          templateId: 1,
          typeName: "Task",
          responseIdField: "task_id",
          loadSchema: this.loadDynamicSchemaProperties,
        };
        break;

      case 2:
        config = {
          templateId: 2,
          typeName: "Project",
          responseIdField: "project_id",
          loadSchema: this.loadProjectSchemaProperties,
        };
        break;

      case 3:
        config = {
          templateId: 3,
          typeName: "Epic",
          responseIdField: "epic_id",
          loadSchema: this.loadEpicSchemaProperties,
        };
        break;

      case 4:
        config = {
          templateId: 4,
          typeName: "Rule",
          responseIdField: "rule_id",
          loadSchema: this.loadRuleSchemaProperties,
        };
        break;

      default:
        return {
          content: [
            {
              type: "text",
              text: `Error: Unsupported template_id ${templateId}. Supported values: 1 (Task), 2 (Project), 3 (Epic), 4 (Rule).`,
            } as TextContent,
          ],
        };
    }

    // Call the generic handleCreate function
    return handleCreate(
      config,
      toolArgs,
      this.sharedDbService,
      this.clientId,
      this.createExecutionChain,
      this.validateDependencies,
      this.projectTools
    );
  }

  private async handleGetObject(toolArgs?: Record<string, any>) {
    const objectId = toolArgs?.object_id;
    
    // Validate parameters
    if (!objectId || typeof objectId !== 'number' || objectId < 1) {
      return {
        content: [
          {
            type: "text",
            text: "Error: Valid numeric object_id is required for retrieval.",
          } as TextContent,
        ],
      };
    }

    // Get object from database
    const object = await this.sharedDbService.getObject(objectId);
    if (!object) {
      return {
        content: [
          {
            type: "text",
            text: `Error: Object with ID ${objectId} not found.`,
          } as TextContent,
        ],
      };
    }

    // Get parent object name if exists
    let parentName = null;
    let parentType = null;
    if (object.parent_id) {
      try {
        const parentObject = await this.sharedDbService.getObject(object.parent_id);
        if (parentObject) {
          parentName = parentObject.Title || 'Untitled';
          parentType = parentObject.template_id === 1 ? 'task' :
                       parentObject.template_id === 2 ? 'project' :
                       parentObject.template_id === 3 ? 'epic' :
                       parentObject.template_id === 4 ? 'rule' : 'unknown';
        }
      } catch (error) {
        parentName = 'Unknown';
        parentType = 'unknown';
      }
    }
    
    // Build blocks object from object properties
    const blocks: Record<string, string> = {};
    const systemFields = ['id', 'stage', 'template_id', 'parent_id', 'parent_name', 'created_at', 'updated_at', 'created_by', 'updated_by'];
    
    for (const [key, value] of Object.entries(object)) {
      if (!systemFields.includes(key) && value) {
        blocks[key] = String(value);
      }
    }
    
    const typeDisplay = object.template_id === 1 ? 'task' :
                        object.template_id === 2 ? 'project' :
                        object.template_id === 3 ? 'epic' :
                        object.template_id === 4 ? 'rule' : 'unknown';
    
    const jsonData = {
      id: object.id,
      stage: object.stage || 'draft',
      template_id: object.template_id,
      parent_id: object.parent_id,
      parent_type: parentType,
      parent_name: parentName,
      type: typeDisplay,
      related: object.related || [],
      dependencies: object.dependencies || [],
      blocks: blocks
    };
    
    return {
      content: [
        {
          type: "text", 
          text: JSON.stringify(jsonData, null, 2),
        } as TextContent,
      ],
    };
  }

  private async handleDeleteObject(toolArgs?: Record<string, any>) {
    const objectId = toolArgs?.object_id;
    
    // Validate parameters
    if (!objectId || typeof objectId !== 'number' || objectId < 1) {
      return {
        content: [
          {
            type: "text",
            text: "Error: Valid numeric object_id is required for deletion.",
          } as TextContent,
        ],
      };
    }

    // Check if object exists
    const existingObject = await this.sharedDbService.getObject(objectId);
    if (!existingObject) {
      return {
        content: [
          {
            type: "text",
            text: `Error: Object with ID ${objectId} not found.`,
          } as TextContent,
        ],
      };
    }

    // Delete object from database
    try {
      const deleted = await this.sharedDbService.deleteObject(objectId);
      if (deleted) {
        const typeDisplay = existingObject.template_id === 1 ? 'Task' :
                            existingObject.template_id === 2 ? 'Project' :
                            existingObject.template_id === 3 ? 'Epic' :
                            existingObject.template_id === 4 ? 'Rule' : 'Unknown';
        const jsonResponse = {
          success: true,
          object_id: objectId,
          message: `${typeDisplay} with ID ${objectId} has been successfully deleted.`
        };
        
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(jsonResponse, null, 2),
            } as TextContent,
          ],
        };
      } else {
        const jsonResponse = {
          success: false,
          object_id: objectId,
          error: `Failed to delete object with ID ${objectId}.`
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
    } catch (error) {
      console.error('Error deleting object:', error);
      const jsonResponse = {
        success: false,
        object_id: objectId,
        error: "Failed to delete object from database."
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

  private async handleListObjects(toolArgs?: Record<string, any>) {
    const templateId = toolArgs?.template_id as number | undefined;
    const parentId = toolArgs?.parent_id as number | undefined;
    const stage = toolArgs?.stage as TaskStage | undefined;

    try {
      const objects = await this.sharedDbService.listObjects(stage, parentId, templateId);

      const formattedObjects = objects.map(object => {
        const typeDisplay = object.template_id === 1 ? 'Task' :
                            object.template_id === 2 ? 'Project' :
                            object.template_id === 3 ? 'Epic' :
                            object.template_id === 4 ? 'Rule' : 'Unknown';
        return {
          id: object.id,
          title: object.Title || 'Untitled',
          description: object.Description || '',
          stage: object.stage || 'draft',
          type: typeDisplay,
          template_id: object.template_id,
          parent_id: object.parent_id,
          related: object.related || [],
          dependencies: object.dependencies || [],
          created_at: object.created_at,
          updated_at: object.updated_at,
        };
      });

      const jsonResponse = {
        count: formattedObjects.length,
        objects: formattedObjects,
      };

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(jsonResponse, null, 2),
          } as TextContent,
        ],
      };
    } catch (error) {
      console.error('Error listing objects:', error);
      return {
        content: [
          {
            type: "text",
            text: "Error: Failed to list objects from database.",
          } as TextContent,
        ],
      };
    }
  }
}

export function createObjectTools(
  sharedDbService: DatabaseService,
  clientId: string,
  createExecutionChain: (properties: SchemaProperties) => ExecutionChainItem[],
  validateDependencies: (properties: SchemaProperties, args: Record<string, any>, isUpdateContext?: boolean) => boolean,
  loadDynamicSchemaProperties: () => Promise<SchemaProperties>,
  loadProjectSchemaProperties: () => Promise<SchemaProperties>,
  loadEpicSchemaProperties: () => Promise<SchemaProperties>,
  loadRuleSchemaProperties: () => Promise<SchemaProperties>,
  projectTools?: any
): ObjectTools {
  return new ObjectTools(
    sharedDbService,
    clientId,
    createExecutionChain,
    validateDependencies,
    loadDynamicSchemaProperties,
    loadProjectSchemaProperties,
    loadEpicSchemaProperties,
    loadRuleSchemaProperties,
    projectTools
  );
}
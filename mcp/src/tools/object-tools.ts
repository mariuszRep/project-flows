import { Tool, TextContent } from "@modelcontextprotocol/sdk/types.js";
import { TaskStage } from "../types/task.js";
import DatabaseService from "../database.js";

export class ObjectTools {
  constructor(
    private sharedDbService: DatabaseService
  ) {}

  getToolDefinitions(): Tool[] {
    return [
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
    return ["get_object", "delete_object", "list_objects"].includes(toolName);
  }

  async handle(name: string, toolArgs?: Record<string, any>) {
    switch (name) {
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
  sharedDbService: DatabaseService
): ObjectTools {
  return new ObjectTools(
    sharedDbService
  );
}
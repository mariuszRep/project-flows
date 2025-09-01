import { Tool, TextContent } from "@modelcontextprotocol/sdk/types.js";
import { TaskData, TaskStage } from "../types/task.js";
import { SchemaProperties, ExecutionChainItem } from "../types/property.js";
import DatabaseService from "../database.js";

export class ObjectTools {
  constructor(
    private sharedDbService: DatabaseService,
    private clientId: string,
    private loadSchemaProperties: (templateId: number) => Promise<SchemaProperties>,
    private createExecutionChain: (properties: SchemaProperties) => ExecutionChainItem[],
    private validateDependencies: (properties: SchemaProperties, args: Record<string, any>, isUpdateContext?: boolean) => boolean
  ) {}

  getToolDefinitions(allProperties: Record<string, any>): Tool[] {
    return [
      {
        name: "create_object",
        description: "Create a new object (epic, task, project, etc.) with specified template_id. For epics, use template_id=3 and parent must be a project.",
        inputSchema: {
          type: "object",
          properties: {
            template_id: {
              type: "number",
              description: "Template ID: 1=Task, 2=Project, 3=Epic"
            },
            parent_id: {
              type: "number",
              description: "Optional parent object ID for hierarchical relationships"
            },
            ...allProperties
          },
          required: ["template_id"],
        },
      } as Tool,
      {
        name: "update_object",
        description: "Update an existing object by object ID and template_id. Provide object_id, template_id and any subset of fields to update.",
        inputSchema: {
          type: "object",
          properties: {
            object_id: {
              type: "number",
              description: "The numeric ID of the object to update"
            },
            template_id: {
              type: "number",
              description: "Template ID: 1=Task, 2=Project, 3=Epic"
            },
            parent_id: {
              type: "number",
              description: "Optional parent object ID for hierarchical relationships"
            },
            ...allProperties
          },
          required: ["object_id", "template_id"],
        },
      } as Tool,
      {
        name: "get_object",
        description: "Retrieve an object by its numeric ID and template_id. Returns the complete object data.",
        inputSchema: {
          type: "object",
          properties: {
            object_id: {
              type: "number",
              description: "The numeric ID of the object to retrieve"
            },
            template_id: {
              type: "number",
              description: "Template ID: 1=Task, 2=Project, 3=Epic"
            }
          },
          required: ["object_id", "template_id"],
        },
      } as Tool,
      {
        name: "delete_object",
        description: "Delete an object by its numeric ID and template_id. This permanently removes the object and all its associated data.",
        inputSchema: {
          type: "object",
          properties: {
            object_id: {
              type: "number",
              description: "The numeric ID of the object to delete"
            },
            template_id: {
              type: "number",
              description: "Template ID: 1=Task, 2=Project, 3=Epic"
            }
          },
          required: ["object_id", "template_id"],
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
    return ["create_object", "update_object", "get_object", "delete_object", "list_objects"].includes(toolName);
  }

  async handle(name: string, toolArgs?: Record<string, any>) {
    switch (name) {
      case "create_object":
        return await this.handleCreateObject(toolArgs);
      case "update_object":
        return await this.handleUpdateObject(toolArgs);
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

  private async handleCreateObject(toolArgs?: Record<string, any>) {
    const templateId = toolArgs?.template_id;
    
    // Validate template_id
    if (!templateId || typeof templateId !== 'number' || ![1, 2, 3].includes(templateId)) {
      return {
        content: [
          {
            type: "text",
            text: "Error: Valid template_id is required (1=Task, 2=Project, 3=Epic).",
          } as TextContent,
        ],
      };
    }

    // For epics (template_id=3), parent must be a project (template_id=2)
    if (templateId === 3 && toolArgs?.parent_id) {
      try {
        const parentObject = await this.sharedDbService.getTask(toolArgs.parent_id);
        if (!parentObject || parentObject.template_id !== 2) {
          return {
            content: [
              {
                type: "text",
                text: "Error: Epic parent must be a project (template_id=2).",
              } as TextContent,
            ],
          };
        }
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: "Error: Failed to validate parent object.",
            } as TextContent,
          ],
        };
      }
    }

    // Load schema properties based on template_id
    let dynamicProperties: SchemaProperties;
    try {
      if (templateId === 3) {
        dynamicProperties = await this.loadSchemaProperties(templateId);
      } else {
        // For other template_ids, we might need different schema loading
        // For now, use epic schema as fallback
        dynamicProperties = await this.loadSchemaProperties(templateId);
      }
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: "Error: Failed to load schema properties.",
          } as TextContent,
        ],
      };
    }

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

    // Prepare object data
    const objectData: Omit<TaskData, 'id'> = {
      template_id: templateId
    };

    // Handle parent_id
    if (toolArgs?.parent_id !== undefined) {
      objectData.parent_id = toolArgs.parent_id;
    }

    // Add all properties to object data
    for (const { prop_name } of executionChain) {
      const value = toolArgs?.[prop_name] || "";
      if (value) {
        objectData[prop_name] = value;
      }
    }
    
    // Add any properties not in the execution chain
    for (const [key, value] of Object.entries(toolArgs || {})) {
      if (value && key !== 'parent_id' && key !== 'template_id' && !objectData[key]) {
        objectData[key] = value;
      }
    }

    // Store object in database
    let objectId: number;
    try {
      objectId = await this.sharedDbService.createTask(objectData, this.clientId);
    } catch (error) {
      console.error('Error creating object:', error);
      return {
        content: [
          {
            type: "text",
            text: "Error: Failed to create object in database.",
          } as TextContent,
        ],
      };
    }

    // Create JSON response
    const title = toolArgs?.Title || "";
    const summary = toolArgs?.Summary || toolArgs?.Description || "";
    
    const typeDisplay = templateId === 1 ? 'Task' : templateId === 2 ? 'Project' : 'Epic';
    
    const jsonResponse = {
      success: true,
      object_id: objectId,
      template_id: templateId,
      type: typeDisplay.toLowerCase(),
      title: title,
      summary: summary,
      parent_id: objectData.parent_id,
      stage: objectData.stage || 'draft',
      ...Object.fromEntries(
        executionChain
          .filter(({ prop_name }) => 
            toolArgs?.[prop_name] && 
            prop_name !== 'Title' && 
            prop_name !== 'Summary' &&
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

  private async handleUpdateObject(toolArgs?: Record<string, any>) {
    const objectId = toolArgs?.object_id;
    const templateId = toolArgs?.template_id;
    
    // Validate object ID and template_id
    if (!objectId || typeof objectId !== 'number' || objectId < 1) {
      return {
        content: [
          {
            type: "text",
            text: "Error: Valid numeric object_id is required for update.",
          } as TextContent,
        ],
      };
    }

    if (!templateId || typeof templateId !== 'number' || ![1, 2, 3].includes(templateId)) {
      return {
        content: [
          {
            type: "text",
            text: "Error: Valid template_id is required (1=Task, 2=Project, 3=Epic).",
          } as TextContent,
        ],
      };
    }

    // Check if object exists and has correct template_id
    const existingObject = await this.sharedDbService.getTask(objectId);
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

    if (existingObject.template_id !== templateId) {
      return {
        content: [
          {
            type: "text",
            text: `Error: Object template_id mismatch. Expected ${templateId}, found ${existingObject.template_id}.`,
          } as TextContent,
        ],
      };
    }

    // Load schema properties
    let dynamicProperties: SchemaProperties;
    try {
      if (templateId === 3) {
        dynamicProperties = await this.loadSchemaProperties(templateId);
      } else {
        dynamicProperties = await this.loadSchemaProperties(templateId); // fallback
      }
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: "Error: Failed to load schema properties.",
          } as TextContent,
        ],
      };
    }

    // Prepare update data
    const updateData: Partial<TaskData> = {};
    
    // Handle stage, parent_id explicitly
    if (toolArgs?.stage !== undefined) {
      const validStages = ['draft', 'backlog', 'doing', 'review', 'completed'];
      if (validStages.includes(String(toolArgs.stage))) {
        updateData.stage = String(toolArgs.stage) as TaskStage;
      }
    }
    
    if (toolArgs?.parent_id !== undefined) {
      // For epics, validate parent is a project
      if (templateId === 3 && toolArgs.parent_id) {
        try {
          const parentObject = await this.sharedDbService.getTask(toolArgs.parent_id);
          if (!parentObject || parentObject.template_id !== 2) {
            return {
              content: [
                {
                  type: "text",
                  text: "Error: Epic parent must be a project (template_id=2).",
                } as TextContent,
              ],
            };
          }
        } catch (error) {
          return {
            content: [
              {
                type: "text",
                text: "Error: Failed to validate parent object.",
              } as TextContent,
            ],
          };
        }
      }
      updateData.parent_id = toolArgs.parent_id;
    }

    // Create execution chain
    const executionChain = this.createExecutionChain(dynamicProperties);

    // Add all properties to update data
    for (const { prop_name } of executionChain) {
      const value = toolArgs?.[prop_name];
      if (value !== undefined) {
        updateData[prop_name] = value;
      }
    }
    
    // Add any properties not in execution chain
    for (const [key, value] of Object.entries(toolArgs || {})) {
      if (key !== 'object_id' && key !== 'template_id' && key !== 'stage' && key !== 'parent_id' && value !== undefined && !updateData.hasOwnProperty(key)) {
        updateData[key] = value;
      }
    }

    // Update object in database
    try {
      await this.sharedDbService.updateTask(objectId, updateData, this.clientId);
    } catch (error) {
      console.error('Error updating object:', error);
      return {
        content: [
          {
            type: "text",
            text: "Error: Failed to update object in database.",
          } as TextContent,
        ],
      };
    }

    const jsonResponse = {
      success: true,
      object_id: objectId,
      template_id: templateId,
      message: `Object ${objectId} updated successfully`,
      updated_fields: Object.keys(updateData).filter(key => key !== 'template_id')
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

  private async handleGetObject(toolArgs?: Record<string, any>) {
    const objectId = toolArgs?.object_id;
    const templateId = toolArgs?.template_id;
    
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

    if (!templateId || typeof templateId !== 'number' || ![1, 2, 3].includes(templateId)) {
      return {
        content: [
          {
            type: "text",
            text: "Error: Valid template_id is required (1=Task, 2=Project, 3=Epic).",
          } as TextContent,
        ],
      };
    }

    // Get object from database
    const object = await this.sharedDbService.getTask(objectId);
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

    // Validate template_id matches
    if (object.template_id !== templateId) {
      return {
        content: [
          {
            type: "text",
            text: `Error: Object template_id mismatch. Expected ${templateId}, found ${object.template_id}.`,
          } as TextContent,
        ],
      };
    }

    // Get parent object name if exists
    let parentName = null;
    let parentType = null;
    if (object.parent_id) {
      try {
        const parentObject = await this.sharedDbService.getTask(object.parent_id);
        if (parentObject) {
          parentName = parentObject.Title || 'Untitled';
          parentType = parentObject.template_id === 1 ? 'task' : 
                       parentObject.template_id === 2 ? 'project' : 'epic';
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
    
    const typeDisplay = templateId === 1 ? 'task' : templateId === 2 ? 'project' : 'epic';
    
    const jsonData = {
      id: object.id,
      stage: object.stage || 'draft',
      template_id: templateId,
      parent_id: object.parent_id,
      parent_type: parentType,
      parent_name: parentName,
      type: typeDisplay,
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
    const templateId = toolArgs?.template_id;
    
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

    if (!templateId || typeof templateId !== 'number' || ![1, 2, 3].includes(templateId)) {
      return {
        content: [
          {
            type: "text",
            text: "Error: Valid template_id is required (1=Task, 2=Project, 3=Epic).",
          } as TextContent,
        ],
      };
    }

    // Check if object exists and validate template_id
    const existingObject = await this.sharedDbService.getTask(objectId);
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

    if (existingObject.template_id !== templateId) {
      return {
        content: [
          {
            type: "text",
            text: `Error: Object template_id mismatch. Expected ${templateId}, found ${existingObject.template_id}.`,
          } as TextContent,
        ],
      };
    }

    // Delete object from database
    try {
      const deleted = await this.sharedDbService.deleteTask(objectId);
      if (deleted) {
        const typeDisplay = templateId === 1 ? 'Task' : templateId === 2 ? 'Project' : 'Epic';
        const jsonResponse = {
          success: true,
          object_id: objectId,
          template_id: templateId,
          type: typeDisplay.toLowerCase(),
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
          template_id: templateId,
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
        template_id: templateId,
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
      const objects = await this.sharedDbService.listTasks(stage, parentId, templateId);
      
      const formattedObjects = objects.map(object => {
        const typeDisplay = object.template_id === 1 ? 'Task' : object.template_id === 2 ? 'Project' : 'Epic';
        return {
          id: object.id,
          title: object.Title || 'Untitled',
          description: object.Description || '',
          stage: object.stage || 'draft',
          type: typeDisplay,
          template_id: object.template_id,
          parent_id: object.parent_id,
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
  loadSchemaProperties: (templateId: number) => Promise<SchemaProperties>,
  createExecutionChain: (properties: SchemaProperties) => ExecutionChainItem[],
  validateDependencies: (properties: SchemaProperties, args: Record<string, any>, isUpdateContext?: boolean) => boolean
): ObjectTools {
  return new ObjectTools(
    sharedDbService,
    clientId,
    loadSchemaProperties,
    createExecutionChain,
    validateDependencies
  );
}
import { Tool, TextContent } from "@modelcontextprotocol/sdk/types.js";
import DatabaseService from "../database.js";

export class PropertyTools {
  constructor(
    private sharedDbService: DatabaseService,
    private clientId: string
  ) {}

  getToolDefinitions(): Tool[] {
    return [
      {
        name: "list_templates",
        description: "List all available templates from the templates table.",
        inputSchema: {
          type: "object",
          properties: {},
          required: [],
        },
      } as Tool,
      {
        name: "get_template_properties",
        description: "Get properties for a specific template by template ID.",
        inputSchema: {
          type: "object",
          properties: {
            template_id: {
              type: "number",
              description: "The numeric ID of the template"
            }
          },
          required: ["template_id"],
        },
      } as Tool,
      {
        name: "create_property",
        description: "Create a new property for a specific template by template ID.",
        inputSchema: {
          type: "object",
          properties: {
            template_id: {
              type: "number",
              description: "The numeric ID of the template"
            },
            key: {
              type: "string",
              description: "The property key/name (must be unique within template)"
            },
            type: {
              type: "string",
              description: "The property type (e.g., 'text', 'list', 'number', 'boolean')"
            },
            description: {
              type: "string",
              description: "Description of what this property is for"
            },
            dependencies: {
              type: "array",
              items: { type: "string" },
              description: "Optional array of property keys this property depends on"
            },
            execution_order: {
              type: "number",
              description: "Optional execution order (defaults to 0)"
            },
            fixed: {
              type: "boolean",
              description: "Optional flag indicating if property is fixed/immutable (defaults to false)"
            }
          },
          required: ["template_id", "key", "type", "description"],
        },
      } as Tool,
      {
        name: "update_property",
        description: "Update an existing property by property ID. All fields except property_id are optional.",
        inputSchema: {
          type: "object",
          properties: {
            property_id: {
              type: "number",
              description: "The numeric ID of the property to update"
            },
            key: {
              type: "string",
              description: "The property key/name"
            },
            type: {
              type: "string",
              description: "The property type"
            },
            description: {
              type: "string",
              description: "Description of the property"
            },
            dependencies: {
              type: "array",
              items: { type: "string" },
              description: "Array of property keys this property depends on"
            },
            execution_order: {
              type: "number",
              description: "Execution order"
            },
            fixed: {
              type: "boolean",
              description: "Flag indicating if property is fixed/immutable"
            }
          },
          required: ["property_id"],
        },
      } as Tool,
      {
        name: "delete_property",
        description: "Delete a property by property ID.",
        inputSchema: {
          type: "object",
          properties: {
            property_id: {
              type: "number",
              description: "The numeric ID of the property to delete"
            }
          },
          required: ["property_id"],
        },
      } as Tool,
      {
        name: "list_properties",
        description: "List all properties, optionally filtered by template ID.",
        inputSchema: {
          type: "object",
          properties: {
            template_id: {
              type: "number",
              description: "Optional template ID to filter properties"
            }
          },
          required: [],
        },
      } as Tool,
    ];
  }

  canHandle(toolName: string): boolean {
    return [
      "list_templates",
      "get_template_properties", 
      "create_property",
      "update_property",
      "delete_property",
      "list_properties"
    ].includes(toolName);
  }

  async handle(name: string, toolArgs?: Record<string, any>) {
    switch (name) {
      case "list_templates":
        return await this.handleListTemplates();
      case "get_template_properties":
        return await this.handleGetTemplateProperties(toolArgs);
      case "create_property":
        return await this.handleCreateProperty(toolArgs);
      case "update_property":
        return await this.handleUpdateProperty(toolArgs);
      case "delete_property":
        return await this.handleDeleteProperty(toolArgs);
      case "list_properties":
        return await this.handleListProperties(toolArgs);
      default:
        throw new Error(`Unknown property tool: ${name}`);
    }
  }

  private async handleListTemplates() {
    try {
      const templates = await this.sharedDbService.getTemplates();
      
      if (templates.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: "No templates found.",
            } as TextContent,
          ],
        };
      }

      // Build JSON response with template data
      const templateData = templates.map(template => ({
        id: template.id,
        name: template.name,
        description: template.description,
        created_at: template.created_at,
        updated_at: template.updated_at,
        created_by: template.created_by,
        updated_by: template.updated_by,
      }));

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(templateData, null, 2),
          } as TextContent,
        ],
      };
    } catch (error) {
      console.error('Error listing templates:', error);
      return {
        content: [
          {
            type: "text",
            text: "Error: Failed to retrieve templates list.",
          } as TextContent,
        ],
      };
    }
  }

  private async handleGetTemplateProperties(toolArgs?: Record<string, any>) {
    const templateId = toolArgs?.template_id;
    
    // Validate template ID
    if (!templateId || typeof templateId !== 'number' || templateId < 1) {
      return {
        content: [
          {
            type: "text",
            text: "Error: Valid numeric template_id is required.",
          } as TextContent,
        ],
      };
    }

    try {
      const properties = await this.sharedDbService.getTemplateProperties(templateId);
      
      if (Object.keys(properties).length === 0) {
        return {
          content: [
            {
              type: "text",
              text: `No properties found for template ID ${templateId}.`,
            } as TextContent,
          ],
        };
      }

      // Return JSON response with properties data
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(properties, null, 2),
          } as TextContent,
        ],
      };
    } catch (error) {
      console.error('Error fetching template properties:', error);
      return {
        content: [
          {
            type: "text",
            text: "Error: Failed to retrieve template properties.",
          } as TextContent,
        ],
      };
    }
  }

  private async handleCreateProperty(toolArgs?: Record<string, any>) {
    const templateId = toolArgs?.template_id;
    const key = toolArgs?.key;
    const type = toolArgs?.type;
    const description = toolArgs?.description;
    const dependencies = (toolArgs?.dependencies as string[]) || [];
    const execution_order = (toolArgs?.execution_order as number) || 0;
    const fixed = (toolArgs?.fixed as boolean) || false;
    
    // Validate required parameters
    if (!templateId || typeof templateId !== 'number' || templateId < 1) {
      return {
        content: [
          {
            type: "text",
            text: "Error: Valid numeric template_id is required.",
          } as TextContent,
        ],
      };
    }
    
    if (!key || typeof key !== 'string' || !key.trim()) {
      return {
        content: [
          {
            type: "text",
            text: "Error: Property key is required and must be a non-empty string.",
          } as TextContent,
        ],
      };
    }
    
    if (!type || typeof type !== 'string' || !type.trim()) {
      return {
        content: [
          {
            type: "text",
            text: "Error: Property type is required and must be a non-empty string.",
          } as TextContent,
        ],
      };
    }
    
    if (!description || typeof description !== 'string' || !description.trim()) {
      return {
        content: [
          {
            type: "text",
            text: "Error: Property description is required and must be a non-empty string.",
          } as TextContent,
        ],
      };
    }

    try {
      console.log('Creating property with params:', {
        templateId,
        key: key.trim(),
        type: type.trim(),
        description: description.trim(),
        dependencies,
        execution_order,
        fixed,
        clientId: this.clientId
      });

      const propertyId = await this.sharedDbService.createProperty(templateId, {
        key: key.trim(),
        type: type.trim(),
        description: description.trim(),
        dependencies,
        execution_order,
        fixed
      }, this.clientId);

      console.log('Property created successfully with ID:', propertyId);

      return {
        content: [
          {
            type: "text",
            text: `Property created successfully with ID: ${propertyId}`,
          } as TextContent,
        ],
      };
    } catch (error) {
      console.error('Error creating property - Full error details:', error);
      const errorMessage = error instanceof Error ? error.message : "Failed to create property";
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

  private async handleUpdateProperty(toolArgs?: Record<string, any>) {
    const propertyId = toolArgs?.property_id;
    
    // Validate property ID
    if (!propertyId || typeof propertyId !== 'number' || propertyId < 1) {
      return {
        content: [
          {
            type: "text",
            text: "Error: Valid numeric property_id is required.",
          } as TextContent,
        ],
      };
    }

    // Build updates object with only provided fields
    const updates: any = {};
    if (toolArgs?.key !== undefined) updates.key = String(toolArgs.key).trim();
    if (toolArgs?.type !== undefined) updates.type = String(toolArgs.type).trim();
    if (toolArgs?.description !== undefined) updates.description = String(toolArgs.description).trim();
    if (toolArgs?.dependencies !== undefined) updates.dependencies = toolArgs.dependencies;
    if (toolArgs?.execution_order !== undefined) updates.execution_order = toolArgs.execution_order;
    if (toolArgs?.fixed !== undefined) updates.fixed = toolArgs.fixed;

    try {
      const success = await this.sharedDbService.updateProperty(propertyId, updates, this.clientId);
      
      if (success) {
        return {
          content: [
            {
              type: "text",
              text: `Property ${propertyId} updated successfully.`,
            } as TextContent,
          ],
        };
      } else {
        return {
          content: [
            {
              type: "text",
              text: `Error: Property with ID ${propertyId} not found or no changes made.`,
            } as TextContent,
          ],
        };
      }
    } catch (error) {
      console.error('Error updating property:', error);
      return {
        content: [
          {
            type: "text",
            text: "Error: Failed to update property.",
          } as TextContent,
        ],
      };
    }
  }

  private async handleDeleteProperty(toolArgs?: Record<string, any>) {
    const propertyId = toolArgs?.property_id;
    
    // Validate property ID
    if (!propertyId || typeof propertyId !== 'number' || propertyId < 1) {
      return {
        content: [
          {
            type: "text",
            text: "Error: Valid numeric property_id is required.",
          } as TextContent,
        ],
      };
    }

    try {
      const success = await this.sharedDbService.deleteProperty(propertyId);
      
      if (success) {
        return {
          content: [
            {
              type: "text",
              text: `Property ${propertyId} deleted successfully.`,
            } as TextContent,
          ],
        };
      } else {
        return {
          content: [
            {
              type: "text",
              text: `Error: Property with ID ${propertyId} not found.`,
            } as TextContent,
          ],
        };
      }
    } catch (error) {
      console.error('Error deleting property:', error);
      const errorMessage = error instanceof Error ? error.message : "Failed to delete property.";
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

  private async handleListProperties(toolArgs?: Record<string, any>) {
    const templateId = toolArgs?.template_id;
    
    // Validate template ID if provided
    if (templateId !== undefined && (typeof templateId !== 'number' || templateId < 1)) {
      return {
        content: [
          {
            type: "text",
            text: "Error: If provided, template_id must be a valid number.",
          } as TextContent,
        ],
      };
    }

    try {
      const properties = await this.sharedDbService.listProperties(templateId);
      
      if (properties.length === 0) {
        const filterMsg = templateId ? ` for template ID ${templateId}` : '';
        return {
          content: [
            {
              type: "text",
              text: `No properties found${filterMsg}.`,
            } as TextContent,
          ],
        };
      }

      // Return JSON response with properties data
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(properties, null, 2),
          } as TextContent,
        ],
      };
    } catch (error) {
      console.error('Error listing properties:', error);
      return {
        content: [
          {
            type: "text",
            text: "Error: Failed to retrieve properties list.",
          } as TextContent,
        ],
      };
    }
  }
}

export function createPropertyTools(
  sharedDbService: DatabaseService,
  clientId: string
): PropertyTools {
  return new PropertyTools(sharedDbService, clientId);
}
/**
 * Template management tools for MCP server
 */

import DatabaseService from "../database.js";
import { z } from "zod";
import { refreshWorkflows } from "../mcp/server-factory.js";

/**
 * Schema entry for template relationships
 */
const SchemaEntrySchema = z.object({
  key: z.string().min(1, "Key must be a non-empty string"),
  label: z.string().min(1, "Label must be a non-empty string"),
  allowed_types: z.array(z.number().int().positive()).min(1, "allowed_types must contain at least one positive integer"),
  cardinality: z.enum(["single", "multiple"], {
    errorMap: () => ({ message: 'Cardinality must be "single" or "multiple"' })
  }),
  required: z.boolean(),
  order: z.number().int().nonnegative("Order must be a non-negative integer")
});

/**
 * Validation schema for update_template_schema tool
 */
const UpdateTemplateSchemaArgsSchema = z.object({
  template_id: z.number().int().positive("template_id must be a positive integer"),
  related_schema: z.array(SchemaEntrySchema).min(0, "related_schema must be an array")
});

export interface TemplateToolsInterface {
  getToolDefinitions(): any[];
  canHandle(toolName: string): boolean;
  handle(toolName: string, args: any): Promise<any>;
}

/**
 * Validation schema for create_template tool
 */
const CreateTemplateArgsSchema = z.object({
  name: z.string().min(1, "Template name must be a non-empty string"),
  description: z.string().min(1, "Template description must be a non-empty string"),
  type: z.enum(["object", "workflow"], {
    errorMap: () => ({ message: 'Type must be "object" or "workflow"' })
  }).optional(),
  metadata: z.record(z.any()).optional(),
  related_schema: z.array(SchemaEntrySchema).optional()
});

/**
 * Validation schema for update_template tool
 */
const UpdateTemplateArgsSchema = z.object({
  template_id: z.number().int().positive("template_id must be a positive integer"),
  name: z.string().min(1, "Template name must be a non-empty string").optional(),
  description: z.string().min(1, "Template description must be a non-empty string").optional(),
  type: z.enum(["object", "workflow"], {
    errorMap: () => ({ message: 'Type must be "object" or "workflow"' })
  }).optional(),
  metadata: z.record(z.any()).optional(),
  related_schema: z.array(SchemaEntrySchema).optional()
});

/**
 * Validation schema for delete_template tool
 */
const DeleteTemplateArgsSchema = z.object({
  template_id: z.number().int().positive("template_id must be a positive integer")
});

/**
 * Validation schema for get_template tool
 */
const GetTemplateArgsSchema = z.object({
  template_id: z.number().int().positive("template_id must be a positive integer")
});

export function createTemplateTools(
  dbService: DatabaseService,
  clientId: string
): TemplateToolsInterface {

  function getToolDefinitions(): any[] {
    return [
      {
        name: "create_template",
        description: `Creates a new template (workflow or object type) in the database. Templates define the structure and behavior of objects or workflows.

For workflow templates:
- Set type to "workflow"
- Provide metadata with: mcp_tool_name (string), input_schema (object), enabled (boolean)
- Use create_property tool to add workflow steps after creating the template

For object templates:
- Set type to "object" (default)
- Define related_schema to specify parent relationship rules

Example workflow template:
{
  "name": "My Custom Workflow",
  "description": "Processes data through multiple steps",
  "type": "workflow",
  "metadata": {
    "mcp_tool_name": "my_custom_workflow",
    "input_schema": { "type": "object", "properties": {}, "required": [] },
    "enabled": false
  }
}`,
        inputSchema: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "Template name (must be unique and descriptive)"
            },
            description: {
              type: "string",
              description: "Template description explaining its purpose"
            },
            type: {
              type: "string",
              enum: ["object", "workflow"],
              description: 'Template type: "object" for data templates, "workflow" for executable workflows (defaults to "object")'
            },
            metadata: {
              type: "object",
              description: "Optional metadata (JSONB). For workflows: {mcp_tool_name, input_schema, enabled}"
            },
            related_schema: {
              type: "array",
              description: "Optional array of parent relationship rules (same format as update_template_schema)",
              items: {
                type: "object",
                properties: {
                  key: { type: "string" },
                  label: { type: "string" },
                  allowed_types: { type: "array", items: { type: "number" } },
                  cardinality: { type: "string", enum: ["single", "multiple"] },
                  required: { type: "boolean" },
                  order: { type: "number" }
                },
                required: ["key", "label", "allowed_types", "cardinality", "required", "order"]
              }
            }
          },
          required: ["name", "description"]
        }
      },
      {
        name: "update_template",
        description: `Updates an existing template's core fields (name, description, type, metadata, or related_schema).

Use this to:
- Rename a template
- Update its description
- Enable/disable a workflow (set metadata.enabled)
- Change workflow tool name (metadata.mcp_tool_name)
- Update workflow input schema (metadata.input_schema)
- Modify parent relationship rules (related_schema)

Note: To update workflow steps, use update_property tool instead.`,
        inputSchema: {
          type: "object",
          properties: {
            template_id: {
              type: "number",
              description: "The numeric ID of the template to update"
            },
            name: {
              type: "string",
              description: "Optional new template name"
            },
            description: {
              type: "string",
              description: "Optional new template description"
            },
            type: {
              type: "string",
              enum: ["object", "workflow"],
              description: 'Optional new template type'
            },
            metadata: {
              type: "object",
              description: "Optional new metadata (completely replaces existing metadata)"
            },
            related_schema: {
              type: "array",
              description: "Optional new related_schema (completely replaces existing schema)",
              items: {
                type: "object",
                properties: {
                  key: { type: "string" },
                  label: { type: "string" },
                  allowed_types: { type: "array", items: { type: "number" } },
                  cardinality: { type: "string", enum: ["single", "multiple"] },
                  required: { type: "boolean" },
                  order: { type: "number" }
                },
                required: ["key", "label", "allowed_types", "cardinality", "required", "order"]
              }
            }
          },
          required: ["template_id"]
        }
      },
      {
        name: "delete_template",
        description: `Deletes a template from the database. This will CASCADE delete all associated properties (workflow steps).

IMPORTANT: This operation will fail if any objects are currently using this template. You must delete those objects first.

Use this to remove:
- Unused workflow templates
- Deprecated object templates
- Test templates

The operation is transactional and will rollback on failure.`,
        inputSchema: {
          type: "object",
          properties: {
            template_id: {
              type: "number",
              description: "The numeric ID of the template to delete"
            }
          },
          required: ["template_id"]
        }
      },
      {
        name: "get_template",
        description: `Retrieves a single template by its ID with all metadata.

Returns complete template information including:
- id, name, description, type
- metadata (for workflows: mcp_tool_name, input_schema, enabled)
- related_schema (parent relationship rules)
- audit fields (created_at, updated_at, created_by, updated_by)

Note: To see template properties/steps, use list_properties tool with the template_id.`,
        inputSchema: {
          type: "object",
          properties: {
            template_id: {
              type: "number",
              description: "The numeric ID of the template to retrieve"
            }
          },
          required: ["template_id"]
        }
      },
      {
        name: "update_template_schema",
        description: `Updates the related_schema JSONB column for a template. The related_schema defines what types of parent relationships are allowed for objects of this template type.

Example schema entry:
{
  "key": "project",
  "label": "Project",
  "allowed_types": [2],
  "cardinality": "single",
  "required": false,
  "order": 1
}

This tool is useful when you need to modify which parent object types (project, epic, task, rule) can be related to a specific template.`,
        inputSchema: {
          type: "object",
          properties: {
            template_id: {
              type: "number",
              description: "The numeric ID of the template to update"
            },
            related_schema: {
              type: "array",
              description: "Array of schema entries defining allowed parent relationships",
              items: {
                type: "object",
                properties: {
                  key: {
                    type: "string",
                    description: 'The relationship key (e.g., "project", "epic")'
                  },
                  label: {
                    type: "string",
                    description: 'Display label for the relationship (e.g., "Project", "Epic")'
                  },
                  allowed_types: {
                    type: "array",
                    description: "Array of template IDs that are allowed as parents (1=Task, 2=Project, 3=Epic, 4=Rule)",
                    items: {
                      type: "number"
                    }
                  },
                  cardinality: {
                    type: "string",
                    enum: ["single", "multiple"],
                    description: 'Whether single or multiple parents are allowed'
                  },
                  required: {
                    type: "boolean",
                    description: "Whether this relationship is required"
                  },
                  order: {
                    type: "number",
                    description: "Display order for the relationship"
                  }
                },
                required: ["key", "label", "allowed_types", "cardinality", "required", "order"]
              }
            }
          },
          required: ["template_id", "related_schema"]
        }
      }
    ];
  }

  function canHandle(toolName: string): boolean {
    return ["create_template", "update_template", "delete_template", "get_template", "update_template_schema"].includes(toolName);
  }

  async function handle(toolName: string, args: any): Promise<any> {
    if (toolName === "create_template") {
      try {
        // Validate input with Zod
        const validatedArgs = CreateTemplateArgsSchema.parse(args);

        // Call database service
        const templateId = await dbService.createTemplate(
          {
            name: validatedArgs.name,
            description: validatedArgs.description,
            type: validatedArgs.type,
            metadata: validatedArgs.metadata,
            related_schema: validatedArgs.related_schema
          },
          clientId
        );

        // Refresh workflows if this is a workflow template
        if (validatedArgs.type === 'workflow') {
          await refreshWorkflows(dbService);
        }

        return {
          content: [
            {
              type: "text",
              text: `Successfully created template with ID ${templateId}. Template name: "${validatedArgs.name}", type: "${validatedArgs.type || 'object'}".`
            }
          ]
        };
      } catch (error: any) {
        console.error('Error in create_template:', error);

        // Handle Zod validation errors
        if (error.name === 'ZodError') {
          const validationErrors = error.errors
            .map((err: any) => `${err.path.join('.')}: ${err.message}`)
            .join(', ');

          return {
            content: [
              {
                type: "text",
                text: `Validation error: ${validationErrors}`
              }
            ],
            isError: true
          };
        }

        return {
          content: [
            {
              type: "text",
              text: `Error creating template: ${error.message || String(error)}`
            }
          ],
          isError: true
        };
      }
    }

    if (toolName === "update_template") {
      try {
        // Validate input with Zod
        const validatedArgs = UpdateTemplateArgsSchema.parse(args);

        // Build updates object
        const updates: any = {};
        if (validatedArgs.name !== undefined) updates.name = validatedArgs.name;
        if (validatedArgs.description !== undefined) updates.description = validatedArgs.description;
        if (validatedArgs.type !== undefined) updates.type = validatedArgs.type;
        if (validatedArgs.metadata !== undefined) updates.metadata = validatedArgs.metadata;
        if (validatedArgs.related_schema !== undefined) updates.related_schema = validatedArgs.related_schema;

        // Call database service
        const success = await dbService.updateTemplate(
          validatedArgs.template_id,
          updates,
          clientId
        );

        if (success) {
          // Refresh workflows if this is a workflow template or if type was changed to workflow
          const template = await dbService.getTemplate(validatedArgs.template_id);
          if (template && template.type === 'workflow') {
            await refreshWorkflows(dbService);
          }

          const updatedFields = Object.keys(updates).join(', ');
          return {
            content: [
              {
                type: "text",
                text: `Successfully updated template ${validatedArgs.template_id}. Updated fields: ${updatedFields}.`
              }
            ]
          };
        } else {
          return {
            content: [
              {
                type: "text",
                text: `Failed to update template. Template ${validatedArgs.template_id} may not exist or no changes were made.`
              }
            ],
            isError: true
          };
        }
      } catch (error: any) {
        console.error('Error in update_template:', error);

        // Handle Zod validation errors
        if (error.name === 'ZodError') {
          const validationErrors = error.errors
            .map((err: any) => `${err.path.join('.')}: ${err.message}`)
            .join(', ');

          return {
            content: [
              {
                type: "text",
                text: `Validation error: ${validationErrors}`
              }
            ],
            isError: true
          };
        }

        return {
          content: [
            {
              type: "text",
              text: `Error updating template: ${error.message || String(error)}`
            }
          ],
          isError: true
        };
      }
    }

    if (toolName === "delete_template") {
      try {
        // Validate input with Zod
        const validatedArgs = DeleteTemplateArgsSchema.parse(args);

        // Get template info before deletion to check if it's a workflow
        const template = await dbService.getTemplate(validatedArgs.template_id);
        const isWorkflow = template && template.type === 'workflow';

        // Call database service
        const success = await dbService.deleteTemplate(
          validatedArgs.template_id,
          clientId
        );

        if (success) {
          // Refresh workflows if we deleted a workflow template
          if (isWorkflow) {
            await refreshWorkflows(dbService);
          }

          return {
            content: [
              {
                type: "text",
                text: `Successfully deleted template ${validatedArgs.template_id} and all associated properties.`
              }
            ]
          };
        } else {
          return {
            content: [
              {
                type: "text",
                text: `Failed to delete template. Template ${validatedArgs.template_id} not found.`
              }
            ],
            isError: true
          };
        }
      } catch (error: any) {
        console.error('Error in delete_template:', error);

        // Handle Zod validation errors
        if (error.name === 'ZodError') {
          const validationErrors = error.errors
            .map((err: any) => `${err.path.join('.')}: ${err.message}`)
            .join(', ');

          return {
            content: [
              {
                type: "text",
                text: `Validation error: ${validationErrors}`
              }
            ],
            isError: true
          };
        }

        return {
          content: [
            {
              type: "text",
              text: `Error deleting template: ${error.message || String(error)}`
            }
          ],
          isError: true
        };
      }
    }

    if (toolName === "get_template") {
      try {
        // Validate input with Zod
        const validatedArgs = GetTemplateArgsSchema.parse(args);

        // Call database service
        const template = await dbService.getTemplate(validatedArgs.template_id);

        if (template) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(template, null, 2)
              }
            ]
          };
        } else {
          return {
            content: [
              {
                type: "text",
                text: `Template with ID ${validatedArgs.template_id} not found.`
              }
            ],
            isError: true
          };
        }
      } catch (error: any) {
        console.error('Error in get_template:', error);

        // Handle Zod validation errors
        if (error.name === 'ZodError') {
          const validationErrors = error.errors
            .map((err: any) => `${err.path.join('.')}: ${err.message}`)
            .join(', ');

          return {
            content: [
              {
                type: "text",
                text: `Validation error: ${validationErrors}`
              }
            ],
            isError: true
          };
        }

        return {
          content: [
            {
              type: "text",
              text: `Error retrieving template: ${error.message || String(error)}`
            }
          ],
          isError: true
        };
      }
    }

    if (toolName === "update_template_schema") {
      try {
        // Validate input with Zod
        const validatedArgs = UpdateTemplateSchemaArgsSchema.parse(args);

        // Call database service
        const success = await dbService.updateTemplateSchema(
          validatedArgs.template_id,
          validatedArgs.related_schema,
          clientId
        );

        if (success) {
          return {
            content: [
              {
                type: "text",
                text: `Successfully updated related_schema for template ${validatedArgs.template_id}. The schema now defines ${validatedArgs.related_schema.length} allowed relationship(s).`
              }
            ]
          };
        } else {
          return {
            content: [
              {
                type: "text",
                text: `Failed to update template schema. Template ${validatedArgs.template_id} may not exist.`
              }
            ],
            isError: true
          };
        }
      } catch (error: any) {
        console.error('Error in update_template_schema:', error);

        // Handle Zod validation errors
        if (error.name === 'ZodError') {
          const validationErrors = error.errors
            .map((err: any) => `${err.path.join('.')}: ${err.message}`)
            .join(', ');

          return {
            content: [
              {
                type: "text",
                text: `Validation error: ${validationErrors}`
              }
            ],
            isError: true
          };
        }

        return {
          content: [
            {
              type: "text",
              text: `Error updating template schema: ${error.message || String(error)}`
            }
          ],
          isError: true
        };
      }
    }

    throw new Error(`Unknown tool: ${toolName}`);
  }

  return {
    getToolDefinitions,
    canHandle,
    handle
  };
}

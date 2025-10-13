/**
 * Template management tools for MCP server
 */

import DatabaseService from "../database.js";
import { z } from "zod";

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

export function createTemplateTools(
  dbService: DatabaseService,
  clientId: string
): TemplateToolsInterface {

  function getToolDefinitions(): any[] {
    return [
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
    return toolName === "update_template_schema";
  }

  async function handle(toolName: string, args: any): Promise<any> {
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

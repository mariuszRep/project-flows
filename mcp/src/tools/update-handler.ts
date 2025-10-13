import { TextContent } from "@modelcontextprotocol/sdk/types.js";
import { TaskData } from "../types/task.js";
import { SchemaProperties, ExecutionChainItem } from "../types/property.js";
import DatabaseService from "../database.js";
import { RelatedEntry } from "./create-handler.js";

/**
 * Configuration for the generic update handler
 *
 * Guidelines for validation flags:
 *
 * - validateTemplateId: Should be TRUE for all entity types to prevent cross-type updates.
 *   Example: Prevents accidentally updating a Task when using an epic_id parameter.
 *   This ensures type safety and prevents data corruption from mismatched tool calls.
 *
 * - validateParent: Use when parent relationships have specific constraints.
 *   Example: Epics must have Project parents (template_id=2), not Task or Rule parents.
 *   Implement custom validation logic to verify parent entity type and constraints.
 *
 * - postUpdate: Use for entity-specific post-processing after successful update.
 *   Example: Auto-transition task to 'review' stage when all checklist items completed.
 *   Runs after database update completes, receives updated entity for inspection.
 */
export interface UpdateConfig {
  templateId: number;
  typeName: string; // e.g., "Task", "Project", "Epic", "Rule"
  idField: string; // e.g., "task_id", "project_id", "epic_id", "rule_id"
  loadSchema: () => Promise<SchemaProperties>;
  validateTemplateId?: boolean; // If true, verify entity template_id matches (recommended: true for all types)
  validateParent?: (parentId: number, dbService: DatabaseService) => Promise<void>;
  postUpdate?: (entityId: number, entity: any, dbService: DatabaseService, clientId: string) => Promise<any>;
}

/**
 * Generic update handler that can be used by all tool classes
 * Eliminates code duplication across TaskTools, ProjectTools, EpicTools, and RuleTools
 */
export async function handleUpdate(
  config: UpdateConfig,
  toolArgs: Record<string, any> | undefined,
  sharedDbService: DatabaseService,
  clientId: string,
  createExecutionChain: (properties: SchemaProperties) => ExecutionChainItem[]
) {
  // Extract and validate entity ID
  const entityId = toolArgs?.[config.idField];

  if (!entityId || typeof entityId !== 'number' || entityId < 1) {
    return {
      content: [
        {
          type: "text",
          text: `Error: Valid numeric ${config.idField} is required for update.`,
        } as TextContent,
      ],
    };
  }

  // Check if entity exists
  const existingEntity = await sharedDbService.getObject(entityId);
  if (!existingEntity) {
    return {
      content: [
        {
          type: "text",
          text: `Error: ${config.typeName} with ID ${entityId} not found.`,
        } as TextContent,
      ],
    };
  }

  // Verify template_id if strict validation is enabled
  if (config.validateTemplateId && existingEntity.template_id !== config.templateId) {
    return {
      content: [
        {
          type: "text",
          text: `Error: Object with ID ${entityId} is not a ${config.typeName.toLowerCase()}.`,
        } as TextContent,
      ],
    };
  }

  // Load dynamic schema properties
  const dynamicProperties = await config.loadSchema();

  // Prepare update data
  const updateData: Partial<TaskData> = {};

  // Handle stage validation and assignment
  if (toolArgs?.stage !== undefined) {
    const validStages = ['draft', 'backlog', 'doing', 'review', 'completed'];
    if (validStages.includes(String(toolArgs.stage))) {
      updateData.stage = String(toolArgs.stage) as any;
    }
  }

  // Reject deprecated parent_id usage
  if (toolArgs?.parent_id !== undefined) {
    return {
      content: [
        {
          type: "text",
          text: "Error: parent_id parameter is no longer supported. Use the 'related' array instead, e.g., related: [{\"id\": 123, \"object\": \"project\"}]. See MIGRATION.md for details.",
        } as TextContent,
      ],
    };
  }

  // Priority: related array parameter if present (otherwise no change)
  if (toolArgs?.related !== undefined) {
    // NEW: Handle related array parameter
    try {
      const inputRelated = toolArgs.related as RelatedEntry[];

      // Note: Multiple related entries are allowed (e.g., task can have both project and epic)
      // The template's related_schema defines cardinality constraints per relationship type

      // Validate each entry
      for (const entry of inputRelated) {
        // Check required fields
        if (typeof entry.id !== 'number' || entry.id < 1) {
          return {
            content: [
              {
                type: "text",
                text: 'Error: Related entry must have a valid numeric id (>= 1).',
              } as TextContent,
            ],
          };
        }

        if (!entry.object || typeof entry.object !== 'string') {
          return {
            content: [
              {
                type: "text",
                text: 'Error: Related entry must have a valid object type string.',
              } as TextContent,
            ],
          };
        }

        // Validate object type
        const validTypes = ['task', 'project', 'epic', 'rule'];
        if (!validTypes.includes(entry.object)) {
          return {
            content: [
              {
                type: "text",
                text: `Error: Invalid object type "${entry.object}". Must be one of: ${validTypes.join(', ')}.`,
              } as TextContent,
            ],
          };
        }

        // Verify parent exists in database
        const parentObject = await sharedDbService.getObject(entry.id);
        if (!parentObject) {
          return {
            content: [
              {
                type: "text",
                text: `Error: Referenced parent object with ID ${entry.id} does not exist.`,
              } as TextContent,
            ],
          };
        }

        // Verify object type matches the parent's actual type
        const parentType = parentObject.template_id === 1 ? 'task' :
                           parentObject.template_id === 2 ? 'project' :
                           parentObject.template_id === 3 ? 'epic' :
                           parentObject.template_id === 4 ? 'rule' : 'unknown';

        if (entry.object !== parentType) {
          return {
            content: [
              {
                type: "text",
                text: `Error: Related entry object type "${entry.object}" does not match parent's actual type "${parentType}".`,
              } as TextContent,
            ],
          };
        }

        // Run custom parent validation if provided
        if (config.validateParent) {
          try {
            await config.validateParent(entry.id, sharedDbService);
          } catch (error) {
            return {
              content: [
                {
                  type: "text",
                  text: error instanceof Error ? error.message : "Error: Parent validation failed.",
                } as TextContent,
              ],
            };
          }
        }
      }

      if (inputRelated.length > 0) {
        updateData.related = inputRelated;
        console.log(`Updating ${config.typeName.toLowerCase()} with related array:`, inputRelated);
      } else {
        // Empty array means clear parent relationship
        updateData.related = [];
      }
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: error instanceof Error ? error.message : "Error: Related array validation failed.",
          } as TextContent,
        ],
      };
    }
  }

  // Set template_id for consistency
  updateData.template_id = config.templateId;

  // Create execution chain to order fields
  const executionChain = createExecutionChain(dynamicProperties);

  // Add all properties from execution chain
  for (const { prop_name } of executionChain) {
    const value = toolArgs?.[prop_name];
    if (value !== undefined) {
      updateData[prop_name] = value;
    }
  }

  // Add any properties not in execution chain (exclude ID field, stage, related, template_id)
  const excludedFields = [config.idField, 'stage', 'related', 'template_id'];
  for (const [key, value] of Object.entries(toolArgs || {})) {
    if (!excludedFields.includes(key) && value !== undefined && !updateData.hasOwnProperty(key)) {
      updateData[key] = value;
    }
  }

  // Update entity in database
  try {
    const updateResult = await sharedDbService.updateObject(entityId, updateData, clientId);
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
    console.error(`Error updating ${config.typeName.toLowerCase()}:`, error);
    return {
      content: [
        {
          type: "text",
          text: `Error: Failed to update ${config.typeName.toLowerCase()} in database.`,
        } as TextContent,
      ],
    };
  }

  // Fetch updated entity
  const fetchedEntity = await sharedDbService.getObject(entityId);
  if (!fetchedEntity) {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({ success: false, message: `${config.typeName} not found after update.` }, null, 2),
        } as TextContent,
      ],
    };
  }

  let updatedEntity = fetchedEntity;

  // Run post-update hook if provided (e.g., task completion check)
  if (config.postUpdate) {
    const updatedResult = await config.postUpdate(entityId, updatedEntity, sharedDbService, clientId);
    if (updatedResult) {
      updatedEntity = updatedResult;
    }
  }

  // Build blocks object dynamically from entity properties
  const blocks: Record<string, string> = {};
  const systemFields = ['id', 'stage', 'template_id', 'parent_id', 'created_at', 'updated_at', 'created_by', 'updated_by'];
  for (const [key, value] of Object.entries(updatedEntity)) {
    if (!systemFields.includes(key) && value) {
      blocks[key] = String(value);
    }
  }

  // Build JSON response
  const jsonResponse = {
    success: true,
    id: updatedEntity.id,
    stage: updatedEntity.stage || 'draft',
    template_id: config.templateId,
    parent_id: updatedEntity.parent_id,
    related: updatedEntity.related || [],
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

import { TextContent } from "@modelcontextprotocol/sdk/types.js";
import { TaskData } from "../types/task.js";
import { SchemaProperties, ExecutionChainItem } from "../types/property.js";
import DatabaseService from "../database.js";

/**
 * Configuration for the generic update handler
 */
export interface UpdateConfig {
  templateId: number;
  typeName: string; // e.g., "Task", "Project", "Epic", "Rule"
  idField: string; // e.g., "task_id", "project_id", "epic_id", "rule_id"
  loadSchema: () => Promise<SchemaProperties>;
  validateTemplateId?: boolean; // If true, verify entity template_id matches
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

  // Handle parent_id with optional validation
  if (toolArgs?.parent_id !== undefined) {
    // Run parent validation if provided and parent_id is not null
    if (config.validateParent && toolArgs.parent_id !== null) {
      try {
        await config.validateParent(toolArgs.parent_id, sharedDbService);
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
    updateData.parent_id = toolArgs.parent_id;
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

  // Add any properties not in execution chain (exclude ID field, stage, parent_id, template_id)
  const excludedFields = [config.idField, 'stage', 'parent_id', 'template_id'];
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

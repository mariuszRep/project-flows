import { TextContent } from "@modelcontextprotocol/sdk/types.js";
import { TaskData } from "../types/task.js";
import { SchemaProperties, ExecutionChainItem } from "../types/property.js";
import DatabaseService from "../database.js";

/**
 * Related entry format for parent relationships
 */
export interface RelatedEntry {
  id: number;
  object: string; // 'task', 'project', 'epic', 'rule'
}

/**
 * Configuration for the generic create handler
 */
export interface CreateConfig {
  templateId: number;
  typeName: string; // e.g., "Task", "Project", "Epic", "Rule"
  responseIdField: string; // e.g., "task_id", "project_id", "epic_id", "rule_id"
  loadSchema: () => Promise<SchemaProperties>;
  validateParent?: (parentId: number, dbService: DatabaseService) => Promise<void>;
}

/**
 * Validates related array for parent relationships.
 * Validates each entry has valid id and object fields.
 * Verifies referenced parent exists in database.
 * Note: Multiple related entries are allowed (e.g., task can have both project and epic).
 * The template's related_schema defines cardinality constraints per relationship type.
 */
async function validateRelatedArray(
  related: RelatedEntry[],
  dbService: DatabaseService
): Promise<void> {
  // Validate each entry
  for (const entry of related) {
    // Check required fields
    if (typeof entry.id !== 'number' || entry.id < 1) {
      throw new Error('Error: Related entry must have a valid numeric id (>= 1).');
    }

    if (!entry.object || typeof entry.object !== 'string') {
      throw new Error('Error: Related entry must have a valid object type string.');
    }

    // Validate object type
    const validTypes = ['task', 'project', 'epic', 'rule'];
    if (!validTypes.includes(entry.object)) {
      throw new Error(`Error: Invalid object type "${entry.object}". Must be one of: ${validTypes.join(', ')}.`);
    }

    // Verify parent exists in database
    const parentObject = await dbService.getObject(entry.id);
    if (!parentObject) {
      throw new Error(`Error: Referenced parent object with ID ${entry.id} does not exist.`);
    }

    // Verify object type matches the parent's actual type
    const parentType = parentObject.template_id === 1 ? 'task' :
                       parentObject.template_id === 2 ? 'project' :
                       parentObject.template_id === 3 ? 'epic' :
                       parentObject.template_id === 4 ? 'rule' : 'unknown';

    if (entry.object !== parentType) {
      throw new Error(`Error: Related entry object type "${entry.object}" does not match parent's actual type "${parentType}".`);
    }
  }
}

/**
 * Generic create handler that can be used by all tool classes
 * Eliminates code duplication across TaskTools, ProjectTools, EpicTools, and RuleTools
 */
export async function handleCreate(
  config: CreateConfig,
  toolArgs: Record<string, any> | undefined,
  sharedDbService: DatabaseService,
  clientId: string,
  createExecutionChain: (properties: SchemaProperties) => ExecutionChainItem[],
  validateDependencies: (properties: SchemaProperties, args: Record<string, any>, isUpdateContext?: boolean) => boolean,
  projectTools?: any
) {
  const dynamicProperties = await config.loadSchema();

  // Validate dependencies
  if (!validateDependencies(dynamicProperties, toolArgs || {}, false)) {
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
  const executionChain = createExecutionChain(dynamicProperties);

  // Prepare task data - all properties go into blocks now
  const taskData: Omit<TaskData, 'id'> = {};

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

  // Handle parent relationships using related array (with optional selected project fallback)
  let relatedArray: RelatedEntry[] | undefined;

  // Priority: related array parameter > selected project (global state)
  if (toolArgs?.related !== undefined) {
    // NEW: Handle related array parameter
    try {
      const inputRelated = toolArgs.related as RelatedEntry[];
      await validateRelatedArray(inputRelated, sharedDbService);
      relatedArray = inputRelated;

      if (inputRelated.length > 0) {
        console.log(`Creating ${config.typeName.toLowerCase()} with related array:`, inputRelated);
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
  } else {
    // If no related array is provided, use the selected project from global state
    if (projectTools) {
      try {
        // Get the selected project ID from global state
        const selectedProjectId = await sharedDbService.getGlobalState('selected_project_id');
        if (selectedProjectId !== null) {
          // For epics, validate the selected project before using it
          let validationPassed = true;
          if (config.validateParent) {
            try {
              await config.validateParent(selectedProjectId, sharedDbService);
            } catch (error) {
              // If validation fails for global project, don't use it
              console.error(`Selected project validation failed for ${config.typeName}:`, error);
              validationPassed = false;
            }
          }

          // Only set parent relationship if validation passed (or wasn't needed)
          if (validationPassed) {
            // Convert to related array format
            relatedArray = [{ id: selectedProjectId, object: 'project' }];
            console.log(`Using selected project ID ${selectedProjectId} for parent relationship`);
          }
        }
      } catch (error) {
        console.error('Error getting selected project:', error);
      }
    }
  }

  // Set related array in task data (single source of truth for parent relationships)
  if (relatedArray) {
    taskData.related = relatedArray;
  }

  // Set template_id for the entity type
  taskData.template_id = config.templateId;

  // Add all properties (including Title and Summary/Description) to task data
  for (const { prop_name } of executionChain) {
    const value = toolArgs?.[prop_name] || "";
    if (value) {
      taskData[prop_name] = value;
    }
  }

  // Also add any properties not in the execution chain (exclude parent_id as it's already handled)
  for (const [key, value] of Object.entries(toolArgs || {})) {
    if (value && key !== 'parent_id' && !taskData[key]) {
      taskData[key] = value;
    }
  }

  // Store object in database
  let entityId: number;
  try {
    entityId = await sharedDbService.createObject(taskData, clientId);
  } catch (error) {
    console.error(`Error creating ${config.typeName.toLowerCase()}:`, error);
    return {
      content: [
        {
          type: "text",
          text: `Error: Failed to create ${config.typeName.toLowerCase()} in database.`,
        } as TextContent,
      ],
    };
  }

  // Create JSON response with entity data
  const title = toolArgs?.Title || "";
  const description = toolArgs?.Description || toolArgs?.Summary || "";

  // Get project/parent information if entity has a related parent
  let projectInfo = 'None';
  const parentEntry = relatedArray && relatedArray.length > 0 ? relatedArray[0] : undefined;
  const parentId = parentEntry?.id ?? null;

  if (parentId) {
    try {
      const parentObject = await sharedDbService.getObject(parentId);
      projectInfo = parentObject ? `${parentObject.Title || 'Untitled'}` : 'Unknown';
    } catch (error) {
      console.error('Error loading parent/project object:', error);
      projectInfo = 'Unknown';
    }
  }

  const templateId = taskData.template_id || config.templateId;
  const typeDisplay = config.typeName;

  // Build JSON response with structured data
  const jsonResponse = {
    success: true,
    [config.responseIdField]: entityId,
    type: typeDisplay.toLowerCase(),
    title: title,
    description: description,
    parent_id: parentId,
    parent_name: projectInfo,
    related: relatedArray || [],
    template_id: templateId,
    stage: taskData.stage || 'draft',
    // Add all dynamic properties
    ...Object.fromEntries(
      executionChain
        .filter(({ prop_name }) =>
          toolArgs?.[prop_name] &&
          prop_name !== 'Title' &&
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

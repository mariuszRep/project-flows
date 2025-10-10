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
 * Validates related array for parent relationships only.
 * Ensures at most one parent entry with valid id and object fields.
 * Verifies referenced parent exists in database.
 */
async function validateRelatedArray(
  related: RelatedEntry[],
  dbService: DatabaseService
): Promise<void> {
  // Validate array length - only one parent allowed
  if (related.length > 1) {
    throw new Error(`Error: Related array can only contain one parent entry. Found ${related.length} entries.`);
  }

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

  // Handle parent relationships - support both parent_id (backward compatibility) and related array
  let relatedArray: RelatedEntry[] | undefined;

  // Priority: related array > parent_id > selected project (global state)
  if (toolArgs?.related !== undefined) {
    // NEW: Handle related array parameter
    try {
      const inputRelated = toolArgs.related as RelatedEntry[];
      await validateRelatedArray(inputRelated, sharedDbService);
      relatedArray = inputRelated;

      // If validation passes, extract parent_id for backward compatibility
      if (inputRelated.length > 0) {
        taskData.parent_id = inputRelated[0].id;
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
  } else if (toolArgs?.parent_id !== undefined) {
    // BACKWARD COMPATIBILITY: Handle parent_id parameter
    const parentId = toolArgs.parent_id;

    // If custom parent validation is provided, run it
    if (config.validateParent) {
      try {
        await config.validateParent(parentId, sharedDbService);
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

    // Convert parent_id to related array format
    const parentObject = await sharedDbService.getObject(parentId);
    if (parentObject) {
      const parentType = parentObject.template_id === 1 ? 'task' :
                         parentObject.template_id === 2 ? 'project' :
                         parentObject.template_id === 3 ? 'epic' :
                         parentObject.template_id === 4 ? 'rule' : 'object';

      relatedArray = [{ id: parentId, object: parentType }];
      taskData.parent_id = parentId;
      console.log(`Creating ${config.typeName.toLowerCase()} with parent_id ${parentId} (converted to related array)`);
    }
  } else {
    // If no parent_id or related is provided, use the selected project from global state
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

          // Only set parent_id if validation passed (or wasn't needed)
          if (validationPassed) {
            // Convert to related array format
            relatedArray = [{ id: selectedProjectId, object: 'project' }];
            taskData.parent_id = selectedProjectId;
            console.log(`Using selected project ID ${selectedProjectId} as parent_id`);
          }
        }
      } catch (error) {
        console.error('Error getting selected project:', error);
      }
    }
  }

  // Set related array in task data (database triggers will maintain sync with parent_id)
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

  // Get project/parent information if entity has parent_id
  let projectInfo = 'None';
  let projectId = taskData.parent_id;

  if (projectId) {
    try {
      const parentObject = await sharedDbService.getObject(projectId);
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
    parent_id: projectId,
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

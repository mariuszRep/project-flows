import { TextContent } from "@modelcontextprotocol/sdk/types.js";
import { TaskData } from "../types/task.js";
import { SchemaProperties, ExecutionChainItem } from "../types/property.js";
import DatabaseService from "../database.js";

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

  // Handle parent_id for hierarchical entities
  if (toolArgs?.parent_id !== undefined) {
    // If custom parent validation is provided, run it
    if (config.validateParent) {
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

    taskData.parent_id = toolArgs.parent_id;
    console.log(`Creating ${config.typeName.toLowerCase()} with parent_id ${toolArgs.parent_id}`);
  } else {
    // If no parent_id is provided, use the selected project from global state
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
            taskData.parent_id = selectedProjectId;
            console.log(`Using selected project ID ${selectedProjectId} as parent_id`);
          }
        }
      } catch (error) {
        console.error('Error getting selected project:', error);
      }
    }
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
    // Use appropriate field names based on entity type
    ...(config.typeName === "Project"
      ? { parent_id: projectId, parent_name: projectInfo }
      : { project_id: projectId, project_name: projectInfo }
    ),
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

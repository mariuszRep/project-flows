/**
 * Get Object Function Handler
 * Retrieves an object from the database by its numeric ID
 *
 * This handler requires DatabaseService context
 */

import DatabaseService from '../../database.js';

export interface FunctionResult {
  success: boolean;
  data?: any;
  error?: string;
}

export interface HandlerContext {
  dbService?: DatabaseService;
}

export default async function get_object(
  params: { object_id: any },
  context?: HandlerContext
): Promise<FunctionResult> {
  console.log('get_object called with params:', JSON.stringify(params));

  if (!context?.dbService) {
    return {
      success: false,
      error: 'DatabaseService not available in handler context'
    };
  }

  // Extract and validate object_id
  let objectId: number;

  if (params.object_id && typeof params.object_id === 'object' && 'value' in params.object_id) {
    objectId = Number(params.object_id.value);
  } else {
    objectId = Number(params.object_id);
  }

  if (isNaN(objectId) || objectId < 1) {
    return {
      success: false,
      error: 'Valid numeric object_id is required (must be >= 1)'
    };
  }

  try {
    // Get object from database
    const object = await context.dbService.getObject(objectId);

    if (!object) {
      return {
        success: false,
        error: `Object with ID ${objectId} not found`
      };
    }

    // Get parent object name if exists
    let parentName = null;
    let parentType = null;
    if (object.parent_id) {
      try {
        const parentObject = await context.dbService.getObject(object.parent_id);
        if (parentObject) {
          parentName = parentObject.Title || 'Untitled';
          parentType = parentObject.template_id === 1 ? 'task' :
                       parentObject.template_id === 2 ? 'project' :
                       parentObject.template_id === 3 ? 'epic' :
                       parentObject.template_id === 4 ? 'rule' : 'unknown';
        }
      } catch (error) {
        console.warn('Error fetching parent object:', error);
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

    return {
      success: true,
      data: {
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
      }
    };
  } catch (error: any) {
    console.error('Error retrieving object:', error);
    return {
      success: false,
      error: `Failed to retrieve object: ${error.message || 'Unknown error'}`
    };
  }
}

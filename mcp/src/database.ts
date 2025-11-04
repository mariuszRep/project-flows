/**
 * Database service layer for PostgreSQL integration
 */

import pg from 'pg';
import { ToolContext } from './types/property.js';

const { Pool } = pg;

interface SchemaProperty {
  type: string;
  description: string;
  dependencies?: string[];
  execution_order?: number;
  created_by?: string;
  updated_by?: string;
  created_at?: Date;
  updated_at?: Date;
  id?: number;
  template_id?: number;
  fixed?: boolean;
}

type TaskStage = 'draft' | 'backlog' | 'doing' | 'review' | 'completed';

/**
 * Relationship entry in the related array (simplified format for parent-only)
 */
interface RelatedEntry {
  id: number;        // ID of the related object
  object: string;    // Type of object: 'task', 'project', 'epic', 'rule'
}

interface ObjectData {
  id: number;
  parent_id?: number;
  stage?: TaskStage;
  template_id?: number;
  parent_type?: string;
  parent_name?: string;
  related?: RelatedEntry[];      // Parent relationships only (simplified format)
  dependencies?: any[];          // Out of scope - not managed yet
  [key: string]: any;
}

/**
 * @deprecated Use ObjectData instead. TaskData is kept for backwards compatibility.
 */
type TaskData = ObjectData;

// Removed unused BlockData interface

class DatabaseService {
  private pool: pg.Pool;

  constructor() {
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL || 'postgresql://mcp_user:mcp_password@localhost:5432/mcp_tasks',
    });
  }

  async initialize() {
    try {
      // Test connection
      await this.pool.query('SELECT NOW()');
      console.log('Database connection established');
    } catch (error) {
      console.error('Database initialization failed:', error);
      throw error;
    }
  }


  async getSchemaProperties(templateId?: number): Promise<Record<string, SchemaProperty>>;
  async getSchemaProperties(templateId: number | undefined, context: ToolContext): Promise<Record<string, SchemaProperty>>;
  async getSchemaProperties(templateId?: number, context?: ToolContext): Promise<Record<string, SchemaProperty>> {
    try {
      let query = 'SELECT key, type, description, dependencies, execution_order, created_by, updated_by, created_at, updated_at, id, template_id, fixed FROM template_properties';
      const params: any[] = [];
      
      if (templateId !== undefined) {
        query += ' WHERE template_id = $1';
        params.push(templateId);
      }
      
      query += ' ORDER BY key';
      
      const result = await this.pool.query(query, params);
      
      const properties: Record<string, SchemaProperty> = {};
      for (const row of result.rows) {
        properties[row.key] = {
          type: row.type,
          description: row.description,
          dependencies: row.dependencies,
          execution_order: row.execution_order,
          created_by: row.created_by,
          updated_by: row.updated_by,
          created_at: row.created_at,
          updated_at: row.updated_at,
          id: row.id,
          template_id: row.template_id,
          fixed: row.fixed
        };
      }
      
      // Apply context-aware filtering if context is provided
      if (context) {
        return this.applyContextFilters(properties, context);
      }
      
      return properties;
    } catch (error) {
      console.error('Error fetching schema properties:', error);
      // Return empty object on error to allow service to continue
      return {};
    }
  }

  private applyContextFilters(properties: Record<string, SchemaProperty>, context: ToolContext): Record<string, SchemaProperty> {
    const filteredProperties: Record<string, SchemaProperty> = {};
    
    for (const [key, property] of Object.entries(properties)) {
      let shouldInclude = true;
      
      // Project-specific filtering
      if (context.projectId && property.description) {
        // For now, include all properties, but this can be enhanced
        // to filter based on project-specific requirements
        shouldInclude = true;
      }
      
      // Role-based filtering
      if (context.userRole) {
        // Example: Admin users see all properties, regular users see subset
        if (context.userRole === 'admin') {
          shouldInclude = true;
        } else if (context.userRole === 'user') {
          // Regular users might not see certain admin-only properties
          shouldInclude = !property.description?.toLowerCase().includes('admin');
        }
      }
      
      // Parent task context filtering
      if (context.parentTaskId && property.dependencies) {
        // Could filter properties based on parent task context
        shouldInclude = true;
      }
      
      if (shouldInclude) {
        filteredProperties[key] = property;
      }
    }
    
    return filteredProperties;
  }

  // Helper function to flatten complex data to text
  private flattenToText(value: any): string {
    if (value === null || value === undefined) {
      return '';
    }
    
    if (typeof value === 'string') {
      return value;
    }
    
    if (Array.isArray(value)) {
      return value.join(', ');
    }
    
    if (typeof value === 'object') {
      return Object.entries(value)
        .map(([k, v]) => `${k}: ${v}`)
        .join(', ');
    }
    
    return String(value);
  }

  /**
   * Creates a new object (task, project, epic, or rule) in the database.
   * @param objectData - The object data including properties, stage, template_id, and related array
   * @param userId - The user ID creating the object (defaults to 'system')
   * @returns The ID of the newly created object
   */
  async createObject(objectData: Omit<ObjectData, 'id'>, userId: string = 'system'): Promise<number> {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      // Insert object with stage, template_id, and related array
      const objectQuery = `
        INSERT INTO objects (stage, template_id, related, created_by, updated_by)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id
      `;
      const relatedValue = objectData.related ? JSON.stringify(objectData.related) : '[]';
      const objectResult = await client.query(objectQuery, [
        objectData.stage || 'draft',
        objectData.template_id || 1,
        relatedValue,
        userId,
        userId
      ]);
      const objectId = objectResult.rows[0].id;

      // Insert blocks for all properties including Title and Description
      let position = 0;
      for (const [key, value] of Object.entries(objectData)) {
        if (key !== 'stage' && key !== 'parent_id' && key !== 'template_id' && key !== 'related' && key !== 'dependencies' && value) {
          // Look up property_id from key
          const propertyQuery = 'SELECT id FROM template_properties WHERE key = $1 LIMIT 1';
          const propertyResult = await client.query(propertyQuery, [key]);

          if (propertyResult.rows.length > 0) {
            const propertyId = propertyResult.rows[0].id;
            const blockQuery = `
              INSERT INTO object_properties (task_id, property_id, content, position, created_by, updated_by)
              VALUES ($1, $2, $3, $4, $5, $6)
            `;
            await client.query(blockQuery, [objectId, propertyId, this.flattenToText(value), position++, userId, userId]);
          }
        }
      }

      await client.query('COMMIT');
      return objectId;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Updates an existing object (task, project, epic, or rule) in the database.
   * @param objectId - The ID of the object to update
   * @param updates - Partial object data with fields to update (including related array)
   * @param userId - The user ID performing the update (defaults to 'system')
   * @returns True if update was successful, false otherwise
   */
  async updateObject(objectId: number, updates: Partial<ObjectData>, userId: string = 'system'): Promise<boolean> {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      // Update object stage, template_id, and/or related array if provided
      const objectUpdates = [];
      const objectValues = [];
      let paramIndex = 1;

      if (updates.stage !== undefined) {
        objectUpdates.push(`stage = $${paramIndex++}`);
        objectValues.push(updates.stage);
      }

      if (updates.template_id !== undefined) {
        objectUpdates.push(`template_id = $${paramIndex++}`);
        objectValues.push(updates.template_id);
      }

      if (updates.related !== undefined) {
        objectUpdates.push(`related = $${paramIndex++}`);
        objectValues.push(JSON.stringify(updates.related));
      }

      if (objectUpdates.length > 0) {
        objectUpdates.push(`updated_at = CURRENT_TIMESTAMP`);
        objectUpdates.push(`updated_by = $${paramIndex++}`);
        objectValues.push(userId);
        objectValues.push(objectId);

        const objectQuery = `UPDATE objects SET ${objectUpdates.join(', ')} WHERE id = $${paramIndex}`;
        await client.query(objectQuery, objectValues);
      }

      // Update blocks for all other properties (including Title and Description)
      for (const [key, value] of Object.entries(updates)) {
        if (key !== 'id' && key !== 'stage' && key !== 'parent_id' && key !== 'template_id' && key !== 'related' && key !== 'dependencies' && value !== undefined) {
          // Look up property_id from key
          const propertyQuery = 'SELECT id FROM template_properties WHERE key = $1 LIMIT 1';
          const propertyResult = await client.query(propertyQuery, [key]);

          if (propertyResult.rows.length > 0) {
            const propertyId = propertyResult.rows[0].id;
            const blockQuery = `
              INSERT INTO object_properties (task_id, property_id, content, position, created_by, updated_by)
              VALUES ($1, $2, $3, 0, $4, $5)
              ON CONFLICT (task_id, property_id)
              DO UPDATE SET content = $3, updated_at = CURRENT_TIMESTAMP, updated_by = $5
            `;
            await client.query(blockQuery, [objectId, propertyId, this.flattenToText(value), userId, userId]);
          }
        }
      }

      await client.query('COMMIT');
      return true;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Retrieves an object (task, project, epic, or rule) by its ID.
   * @param objectId - The ID of the object to retrieve
   * @returns The object data if found, null otherwise
   */
  async getObject(objectId: number): Promise<ObjectData | null> {
    try {
      // Get object core data with parent information (derived from related array)
      const objectQuery = `
        SELECT
          t.id,
          t.stage,
          t.template_id,
          t.related,
          t.dependencies,
          parent_info.parent_id,
          LOWER(pt.name) as parent_type,
          COALESCE(
            (SELECT b.content FROM object_properties b
             JOIN template_properties tp ON b.property_id = tp.id
             WHERE b.task_id = p.id AND tp.key = 'Title' LIMIT 1),
            'Untitled'
          ) as parent_name
        FROM objects t
        LEFT JOIN LATERAL (
          SELECT (elem->>'id')::int AS parent_id
          FROM jsonb_array_elements(t.related) AS elem
          LIMIT 1
        ) parent_info ON TRUE
        LEFT JOIN objects p ON parent_info.parent_id = p.id
        LEFT JOIN templates pt ON p.template_id = pt.id
        WHERE t.id = $1
      `;
      const objectResult = await this.pool.query(objectQuery, [objectId]);

      if (objectResult.rows.length === 0) {
        return null;
      }

      const object = objectResult.rows[0];

      // Get blocks for all properties including Title and Description
      const blocksQuery = `
        SELECT p.key as property_name, b.content
        FROM object_properties b
        JOIN template_properties p ON b.property_id = p.id
        WHERE b.task_id = $1
        ORDER BY b.position
      `;
      const blocksResult = await this.pool.query(blocksQuery, [objectId]);

      // Build complete object data
      const objectData: ObjectData = {
        id: object.id,
        parent_id: object.parent_id,
        project_id: object.parent_id, // For backward compatibility with UI
        stage: object.stage,
        template_id: object.template_id,
        parent_type: object.parent_type,
        parent_name: object.parent_name,
        related: object.related || [],
        dependencies: object.dependencies || [],
      };

      for (const block of blocksResult.rows) {
        // Content is now stored as TEXT, use directly
        objectData[block.property_name] = block.content;
      }

      return objectData;
    } catch (error) {
      console.error('Error fetching object:', error);
      return null;
    }
  }

  async getNextTaskId(): Promise<number> {
    try {
      const query = 'SELECT COALESCE(MAX(id), 0) + 1 as next_id FROM objects';
      const result = await this.pool.query(query);
      return result.rows[0].next_id;
    } catch (error) {
      console.error('Error getting next task ID:', error);
      return 1;
    }
  }

  /**
   * Lists objects (tasks, projects, epics, or rules) with optional filtering.
   * @param stageFilter - Optional stage to filter by
   * @param projectIdFilter - Optional parent relationship filter (uses related array)
   * @param templateIdFilter - Optional template_id to filter by object type
   * @returns Array of object data matching the filters
   */
  async listObjects(stageFilter?: string, projectIdFilter?: number, templateIdFilter?: number): Promise<ObjectData[]> {
    try {
      // Get basic object data including derived parent information
      let query = `
        SELECT
          t.id,
          parent_info.parent_id,
          t.stage,
          t.template_id,
          t.related,
          t.dependencies
        FROM objects t
        LEFT JOIN LATERAL (
          SELECT (elem->>'id')::int AS parent_id
          FROM jsonb_array_elements(t.related) AS elem
          LIMIT 1
        ) parent_info ON TRUE
      `;
      const params: any[] = [];
      let paramIndex = 1;

      const conditions: string[] = [];

      if (templateIdFilter !== undefined) {
        conditions.push(`t.template_id = $${paramIndex++}`);
        params.push(templateIdFilter);
      }

      if (stageFilter) {
        conditions.push(`t.stage = $${paramIndex++}`);
        params.push(stageFilter);
      }

      if (projectIdFilter !== undefined) {
        conditions.push(`t.related @> $${paramIndex++}`);
        params.push(JSON.stringify([{ id: projectIdFilter }]));
      }

      if (conditions.length > 0) {
        query += ' WHERE ' + conditions.join(' AND ');
      }

      query += ' ORDER BY t.id';

      const objectsResult = await this.pool.query(query, params);

      if (objectsResult.rows.length === 0) {
        return [];
      }

      // Get all blocks for these objects
      const objectIds = objectsResult.rows.map(row => row.id);
      const blocksQuery = `
        SELECT b.task_id, p.key as property_name, b.content
        FROM object_properties b
        JOIN template_properties p ON b.property_id = p.id
        WHERE b.task_id = ANY($1)
        ORDER BY b.task_id, b.position
      `;
      const blocksResult = await this.pool.query(blocksQuery, [objectIds]);

      // Group blocks by task_id (object_id)
      const blocksByObject: Record<number, Array<{property_name: string, content: string}>> = {};
      for (const block of blocksResult.rows) {
        if (!blocksByObject[block.task_id]) {
          blocksByObject[block.task_id] = [];
        }
        blocksByObject[block.task_id].push({
          property_name: block.property_name,
          content: block.content
        });
      }

      // Build complete object data
      return objectsResult.rows.map((row: any) => {
        const parentId = row.parent_id ?? null;
        const objectData: ObjectData = {
          id: row.id,
          parent_id: parentId,
          project_id: parentId, // For backward compatibility with UI
          stage: row.stage,
          template_id: row.template_id,
          related: row.related || [],
          dependencies: row.dependencies || [],
        };

        // Add blocks for this object
        const objectBlocks = blocksByObject[row.id] || [];
        for (const block of objectBlocks) {
          // Content is now stored as TEXT, use directly
          objectData[block.property_name] = block.content;
        }

        return objectData;
      });
    } catch (error) {
      console.error('Error fetching objects list:', error);
      return [];
    }
  }

  async getTemplates(): Promise<Array<{
    id: number;
    name: string;
    description: string;
    related_schema: any;
    type: string;
    metadata: any;
    created_at: Date;
    updated_at: Date;
    created_by: string;
    updated_by: string;
  }>> {
    try {
      const query = `
        SELECT
          id,
          name,
          description,
          COALESCE(related_schema, '[]'::jsonb) AS related_schema,
          type,
          COALESCE(metadata, '{}'::jsonb) AS metadata,
          created_at,
          updated_at,
          created_by,
          updated_by
        FROM templates
        ORDER BY name
      `;
      const result = await this.pool.query(query);
      return result.rows.map(row => {
        let relatedSchema = row.related_schema ?? [];
        let metadata = row.metadata ?? {};

        // Handle cases where the driver returns JSONB as string
        if (typeof relatedSchema === 'string') {
          try {
            relatedSchema = JSON.parse(relatedSchema);
          } catch (parseError) {
            console.error('Failed to parse related_schema JSON:', parseError);
            relatedSchema = [];
          }
        }

        if (typeof metadata === 'string') {
          try {
            metadata = JSON.parse(metadata);
          } catch (parseError) {
            console.error('Failed to parse metadata JSON:', parseError);
            metadata = {};
          }
        }

        return {
          ...row,
          related_schema: Array.isArray(relatedSchema) ? relatedSchema : [],
          metadata: typeof metadata === 'object' ? metadata : {}
        };
      });
    } catch (error) {
      console.error('Error fetching templates:', error);
      return [];
    }
  }

  /**
   * Updates the related_schema JSONB column for a template.
   * @param templateId - The ID of the template to update
   * @param relatedSchema - Array of schema entries defining allowed parent relationships
   * @param userId - The user ID performing the update (defaults to 'system')
   * @returns True if update was successful, false otherwise
   */
  async updateTemplateSchema(
    templateId: number,
    relatedSchema: Array<{
      key: string;
      label: string;
      allowed_types: number[];
      cardinality: 'single' | 'multiple';
      required: boolean;
      order: number;
    }>,
    userId: string = 'system'
  ): Promise<boolean> {
    try {
      // Validate templateId
      if (!Number.isInteger(templateId) || templateId < 1) {
        throw new Error('Invalid template_id: must be a positive integer');
      }

      // Validate each schema entry
      for (const entry of relatedSchema) {
        if (!entry.key || typeof entry.key !== 'string') {
          throw new Error('Invalid schema entry: key must be a non-empty string');
        }
        if (!entry.label || typeof entry.label !== 'string') {
          throw new Error('Invalid schema entry: label must be a non-empty string');
        }
        if (!Array.isArray(entry.allowed_types) || entry.allowed_types.length === 0) {
          throw new Error('Invalid schema entry: allowed_types must be a non-empty array');
        }
        if (!entry.allowed_types.every(id => Number.isInteger(id) && id > 0)) {
          throw new Error('Invalid schema entry: allowed_types must contain positive integers');
        }
        if (entry.cardinality !== 'single' && entry.cardinality !== 'multiple') {
          throw new Error('Invalid schema entry: cardinality must be "single" or "multiple"');
        }
        if (typeof entry.required !== 'boolean') {
          throw new Error('Invalid schema entry: required must be a boolean');
        }
        if (!Number.isInteger(entry.order) || entry.order < 0) {
          throw new Error('Invalid schema entry: order must be a non-negative integer');
        }
      }

      // Check if template exists
      const checkQuery = 'SELECT id FROM templates WHERE id = $1';
      const checkResult = await this.pool.query(checkQuery, [templateId]);

      if (checkResult.rows.length === 0) {
        throw new Error(`Template with ID ${templateId} not found`);
      }

      // Update the related_schema column
      const updateQuery = `
        UPDATE templates
        SET related_schema = $1, updated_at = CURRENT_TIMESTAMP, updated_by = $2
        WHERE id = $3
      `;
      const result = await this.pool.query(updateQuery, [
        JSON.stringify(relatedSchema),
        userId,
        templateId
      ]);

      return (result.rowCount || 0) > 0;
    } catch (error) {
      console.error('Error updating template schema:', error);
      throw error;
    }
  }


  async createProperty(templateId: number, propertyData: {
    key: string;
    type: string;
    description: string;
    dependencies?: string[];
    execution_order?: number;
    fixed?: boolean;
    step_type?: string;
    step_config?: Record<string, any>;
  }, userId: string = 'system'): Promise<number> {
    try {
      console.log('Database createProperty called with:', {
        templateId,
        propertyData,
        userId
      });

      const query = `
        INSERT INTO template_properties (template_id, key, type, description, dependencies, execution_order, fixed, step_type, step_config, created_by, updated_by) 
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) 
        RETURNING id
      `;
      const values = [
        templateId,
        propertyData.key,
        propertyData.type,
        propertyData.description,
        propertyData.dependencies || [],
        propertyData.execution_order || 0,
        propertyData.fixed || false,
        propertyData.step_type || 'property',
        JSON.stringify(propertyData.step_config || {}),
        userId,
        userId
      ];

      console.log('Executing query with values:', { query, values });

      const result = await this.pool.query(query, values);
      const propertyId = result.rows[0].id;
      
      console.log('Property created successfully in database with ID:', propertyId);
      return propertyId;
    } catch (error) {
      console.error('Database error creating property:', error);
      console.error('Error details:', {
        code: (error as any).code,
        detail: (error as any).detail,
        constraint: (error as any).constraint
      });
      throw error;
    }
  }

  async updateProperty(propertyId: number, updates: {
    key?: string;
    type?: string;
    description?: string;
    dependencies?: string[];
    execution_order?: number;
    fixed?: boolean;
    step_type?: string;
    step_config?: Record<string, any>;
  }, userId: string = 'system'): Promise<boolean> {
    try {
      const updateFields = [];
      const values = [];
      let paramIndex = 1;

      if (updates.key !== undefined) {
        updateFields.push(`key = $${paramIndex++}`);
        values.push(updates.key);
      }
      if (updates.type !== undefined) {
        updateFields.push(`type = $${paramIndex++}`);
        values.push(updates.type);
      }
      if (updates.description !== undefined) {
        updateFields.push(`description = $${paramIndex++}`);
        values.push(updates.description);
      }
      if (updates.dependencies !== undefined) {
        updateFields.push(`dependencies = $${paramIndex++}`);
        values.push(updates.dependencies);
      }
      if (updates.execution_order !== undefined) {
        updateFields.push(`execution_order = $${paramIndex++}`);
        values.push(updates.execution_order);
      }
      if (updates.fixed !== undefined) {
        updateFields.push(`fixed = $${paramIndex++}`);
        values.push(updates.fixed);
      }
      if (updates.step_type !== undefined) {
        updateFields.push(`step_type = $${paramIndex++}`);
        values.push(updates.step_type);
      }
      if (updates.step_config !== undefined) {
        updateFields.push(`step_config = $${paramIndex++}`);
        values.push(JSON.stringify(updates.step_config));
      }

      if (updateFields.length === 0) {
        return false; // No fields to update
      }

      updateFields.push(`updated_at = CURRENT_TIMESTAMP`);
      updateFields.push(`updated_by = $${paramIndex++}`);
      values.push(userId);
      values.push(propertyId);

      const query = `UPDATE template_properties SET ${updateFields.join(', ')} WHERE id = $${paramIndex}`;
      const result = await this.pool.query(query, values);
      return (result.rowCount || 0) > 0;
    } catch (error) {
      console.error('Error updating property:', error);
      throw error;
    }
  }

  async deleteProperty(propertyId: number): Promise<boolean> {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');

      // First, get the property details to check if it's fixed and get the key
      const propertyQuery = 'SELECT key, fixed FROM template_properties WHERE id = $1';
      const propertyResult = await client.query(propertyQuery, [propertyId]);
      
      if (propertyResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return false; // Property doesn't exist
      }

      const property = propertyResult.rows[0];
      
      // Check if property is fixed (cannot be deleted)
      if (property.fixed) {
        await client.query('ROLLBACK');
        throw new Error(`Property "${property.key}" is fixed and cannot be deleted`);
      }

      // Delete all blocks that use this property first (CASCADE DELETE)
      const deleteBlocksQuery = 'DELETE FROM object_properties WHERE property_id = $1';
      const blocksResult = await client.query(deleteBlocksQuery, [propertyId]);
      const deletedBlockCount = blocksResult.rowCount || 0;

      if (deletedBlockCount > 0) {
        console.log(`Deleted ${deletedBlockCount} block(s) using property "${property.key}"`);
      }

      // Now safe to delete the property
      const deleteQuery = 'DELETE FROM template_properties WHERE id = $1';
      const deleteResult = await client.query(deleteQuery, [propertyId]);
      
      await client.query('COMMIT');
      return (deleteResult.rowCount || 0) > 0;
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error deleting property:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Deletes an object (task, project, epic, or rule) from the database.
   * @param objectId - The ID of the object to delete
   * @returns True if deletion was successful, false if object not found
   */
  async deleteObject(objectId: number): Promise<boolean> {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      // Check if object exists
      const objectQuery = 'SELECT id FROM objects WHERE id = $1';
      const objectResult = await client.query(objectQuery, [objectId]);

      if (objectResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return false;
      }

      // Delete blocks first (foreign key constraint)
      const deleteBlocksQuery = 'DELETE FROM object_properties WHERE task_id = $1';
      await client.query(deleteBlocksQuery, [objectId]);

      // Delete object
      const deleteObjectQuery = 'DELETE FROM objects WHERE id = $1';
      const deleteResult = await client.query(deleteObjectQuery, [objectId]);

      await client.query('COMMIT');
      return (deleteResult.rowCount || 0) > 0;
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error deleting object:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async listProperties(templateId?: number): Promise<Array<SchemaProperty & { key: string; step_type?: string; step_config?: any }>> {
    try {
      let query = `
        SELECT id, template_id, key, type, description, dependencies, execution_order, fixed,
               created_by, updated_by, created_at, updated_at, step_type, step_config
        FROM template_properties
      `;
      let params: any[] = [];

      if (templateId) {
        query += ' WHERE template_id = $1';
        params.push(templateId);
      }

      query += ' ORDER BY template_id, execution_order, key';

      const result = await this.pool.query(query, params);
      return result.rows.map((row: any) => ({
        id: row.id,
        template_id: row.template_id,
        key: row.key,
        type: row.type,
        description: row.description,
        dependencies: row.dependencies,
        execution_order: row.execution_order,
        fixed: row.fixed,
        created_by: row.created_by,
        updated_by: row.updated_by,
        created_at: row.created_at,
        updated_at: row.updated_at,
        step_type: row.step_type,
        step_config: row.step_config
      }));
    } catch (error) {
      console.error('Error listing properties:', error);
      return [];
    }
  }

  // Global state CRUD operations
  async getGlobalState(key: string): Promise<any> {
    try {
      const query = 'SELECT value FROM global_state WHERE key = $1';
      const result = await this.pool.query(query, [key]);

      if (result.rows.length === 0) {
        return null;
      }

      // JSONB column returns object directly, no need to parse
      return result.rows[0].value;
    } catch (error) {
      console.error('Error fetching global state:', error);
      return null;
    }
  }

  async setGlobalState(key: string, value: any, userId: string = 'system'): Promise<boolean> {
    try {
      const query = `
        INSERT INTO global_state (key, value, created_by, updated_by) 
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (key) 
        DO UPDATE SET value = $2, updated_at = CURRENT_TIMESTAMP, updated_by = $4
      `;
      const values = [key, JSON.stringify(value), userId, userId];

      await this.pool.query(query, values);
      return true;
    } catch (error) {
      console.error('Error setting global state:', error);
      return false;
    }
  }

  async deleteGlobalState(key: string): Promise<boolean> {
    try {
      const query = 'DELETE FROM global_state WHERE key = $1';
      const result = await this.pool.query(query, [key]);
      return (result.rowCount || 0) > 0;
    } catch (error) {
      console.error('Error deleting global state:', error);
      return false;
    }
  }

  /**
   * Type guard to check if an object is a task (template_id === 1).
   * @param object - The object data to check
   * @returns True if object is a task, false otherwise
   */
  isTask(object: ObjectData): boolean {
    return object.template_id === 1;
  }

  /**
   * Type guard to check if an object is a project (template_id === 2).
   * @param object - The object data to check
   * @returns True if object is a project, false otherwise
   */
  isProject(object: ObjectData): boolean {
    return object.template_id === 2;
  }

  /**
   * Type guard to check if an object is an epic (template_id === 3).
   * @param object - The object data to check
   * @returns True if object is an epic, false otherwise
   */
  isEpic(object: ObjectData): boolean {
    return object.template_id === 3;
  }

  /**
   * Type guard to check if an object is a rule (template_id === 4).
   * @param object - The object data to check
   * @returns True if object is a rule, false otherwise
   */
  isRule(object: ObjectData): boolean {
    return object.template_id === 4;
  }

  /**
   * Gets the object type name based on template_id.
   * @param templateId - The template ID to convert
   * @returns The object type as a string ('task', 'project', 'epic', 'rule', or 'unknown')
   */
  getObjectType(templateId: number): 'task' | 'project' | 'epic' | 'rule' | 'unknown' {
    switch (templateId) {
      case 1:
        return 'task';
      case 2:
        return 'project';
      case 3:
        return 'epic';
      case 4:
        return 'rule';
      default:
        return 'unknown';
    }
  }

  /**
   * Creates a new template (workflow or object) in the database.
   * @param templateData - The template data including name, description, type, metadata, and related_schema
   * @param userId - The user ID creating the template (defaults to 'system')
   * @returns The ID of the newly created template
   */
  async createTemplate(templateData: {
    name: string;
    description: string;
    type?: string;
    metadata?: Record<string, any>;
    related_schema?: any[];
  }, userId: string = 'system'): Promise<number> {
    try {
      // Validate required fields
      if (!templateData.name || typeof templateData.name !== 'string' || !templateData.name.trim()) {
        throw new Error('Template name is required and must be a non-empty string');
      }
      if (!templateData.description || typeof templateData.description !== 'string' || !templateData.description.trim()) {
        throw new Error('Template description is required and must be a non-empty string');
      }

      // Validate type if provided
      const type = templateData.type || 'object';
      if (type !== 'object' && type !== 'workflow') {
        throw new Error('Template type must be "object" or "workflow"');
      }

      // Validate metadata for workflows
      if (type === 'workflow' && templateData.metadata) {
        const metadata = templateData.metadata;
        if (metadata.mcp_tool_name && typeof metadata.mcp_tool_name !== 'string') {
          throw new Error('metadata.mcp_tool_name must be a string');
        }
        if (metadata.enabled !== undefined && typeof metadata.enabled !== 'boolean') {
          throw new Error('metadata.enabled must be a boolean');
        }
      }

      const query = `
        INSERT INTO templates (name, description, type, metadata, related_schema, created_by, updated_by)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id
      `;
      const values = [
        templateData.name.trim(),
        templateData.description.trim(),
        type,
        JSON.stringify(templateData.metadata || {}),
        JSON.stringify(templateData.related_schema || []),
        userId,
        userId
      ];

      const result = await this.pool.query(query, values);
      const templateId = result.rows[0].id;

      console.log(`Template created successfully with ID: ${templateId}`);

      return templateId;
    } catch (error) {
      console.error('Error creating template:', error);
      throw error;
    }
  }

  /**
   * Updates an existing template in the database.
   * @param templateId - The ID of the template to update
   * @param updates - Partial template data with fields to update
   * @param userId - The user ID performing the update (defaults to 'system')
   * @returns True if update was successful, false otherwise
   */
  async updateTemplate(templateId: number, updates: {
    name?: string;
    description?: string;
    type?: string;
    metadata?: Record<string, any>;
    related_schema?: any[];
  }, userId: string = 'system'): Promise<boolean> {
    try {
      // Validate templateId
      if (!Number.isInteger(templateId) || templateId < 1) {
        throw new Error('Invalid template_id: must be a positive integer');
      }

      // Check if template exists
      const checkQuery = 'SELECT id, type FROM templates WHERE id = $1';
      const checkResult = await this.pool.query(checkQuery, [templateId]);

      if (checkResult.rows.length === 0) {
        throw new Error(`Template with ID ${templateId} not found`);
      }

      // Build update query dynamically
      const updateFields = [];
      const values = [];
      let paramIndex = 1;

      if (updates.name !== undefined) {
        if (typeof updates.name !== 'string' || !updates.name.trim()) {
          throw new Error('Template name must be a non-empty string');
        }
        updateFields.push(`name = $${paramIndex++}`);
        values.push(updates.name.trim());
      }

      if (updates.description !== undefined) {
        if (typeof updates.description !== 'string' || !updates.description.trim()) {
          throw new Error('Template description must be a non-empty string');
        }
        updateFields.push(`description = $${paramIndex++}`);
        values.push(updates.description.trim());
      }

      if (updates.type !== undefined) {
        if (updates.type !== 'object' && updates.type !== 'workflow') {
          throw new Error('Template type must be "object" or "workflow"');
        }
        updateFields.push(`type = $${paramIndex++}`);
        values.push(updates.type);
      }

      if (updates.metadata !== undefined) {
        updateFields.push(`metadata = $${paramIndex++}`);
        values.push(JSON.stringify(updates.metadata));
      }

      if (updates.related_schema !== undefined) {
        updateFields.push(`related_schema = $${paramIndex++}`);
        values.push(JSON.stringify(updates.related_schema));
      }

      if (updateFields.length === 0) {
        return false; // No fields to update
      }

      updateFields.push(`updated_at = CURRENT_TIMESTAMP`);
      updateFields.push(`updated_by = $${paramIndex++}`);
      values.push(userId);
      values.push(templateId);

      const query = `UPDATE templates SET ${updateFields.join(', ')} WHERE id = $${paramIndex}`;
      const result = await this.pool.query(query, values);

      return (result.rowCount || 0) > 0;
    } catch (error) {
      console.error('Error updating template:', error);
      throw error;
    }
  }

  /**
   * Deletes a template from the database.
   * This will cascade delete all associated properties and fail if objects are using this template.
   * @param templateId - The ID of the template to delete
   * @param userId - The user ID performing the deletion (defaults to 'system')
   * @returns True if deletion was successful, false if template not found
   */
  async deleteTemplate(templateId: number, userId: string = 'system'): Promise<boolean> {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      // Check if template exists
      const templateQuery = 'SELECT id, name, type FROM templates WHERE id = $1';
      const templateResult = await client.query(templateQuery, [templateId]);

      if (templateResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return false;
      }

      const template = templateResult.rows[0];

      // Check if any objects are using this template
      const objectsQuery = 'SELECT COUNT(*) as count FROM objects WHERE template_id = $1';
      const objectsResult = await client.query(objectsQuery, [templateId]);
      const objectCount = parseInt(objectsResult.rows[0].count);

      if (objectCount > 0) {
        await client.query('ROLLBACK');
        throw new Error(`Cannot delete template "${template.name}": ${objectCount} object(s) are still using it. Delete those objects first.`);
      }

      // Delete template (will cascade to template_properties)
      const deleteQuery = 'DELETE FROM templates WHERE id = $1';
      const deleteResult = await client.query(deleteQuery, [templateId]);

      await client.query('COMMIT');
      console.log(`Template ${templateId} ("${template.name}") deleted successfully`);
      return (deleteResult.rowCount || 0) > 0;
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error deleting template:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Gets a single template by ID.
   * @param templateId - The ID of the template to retrieve
   * @returns The template data if found, null otherwise
   */
  async getTemplate(templateId: number): Promise<{
    id: number;
    name: string;
    description: string;
    related_schema: any;
    type: string;
    metadata: any;
    created_at: Date;
    updated_at: Date;
    created_by: string;
    updated_by: string;
  } | null> {
    try {
      const query = `
        SELECT
          id,
          name,
          description,
          COALESCE(related_schema, '[]'::jsonb) AS related_schema,
          type,
          COALESCE(metadata, '{}'::jsonb) AS metadata,
          created_at,
          updated_at,
          created_by,
          updated_by
        FROM templates
        WHERE id = $1
      `;
      const result = await this.pool.query(query, [templateId]);

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      let relatedSchema = row.related_schema ?? [];
      let metadata = row.metadata ?? {};

      // Handle cases where the driver returns JSONB as string
      if (typeof relatedSchema === 'string') {
        try {
          relatedSchema = JSON.parse(relatedSchema);
        } catch (parseError) {
          console.error('Failed to parse related_schema JSON:', parseError);
          relatedSchema = [];
        }
      }

      if (typeof metadata === 'string') {
        try {
          metadata = JSON.parse(metadata);
        } catch (parseError) {
          console.error('Failed to parse metadata JSON:', parseError);
          metadata = {};
        }
      }

      return {
        ...row,
        related_schema: Array.isArray(relatedSchema) ? relatedSchema : [],
        metadata: typeof metadata === 'object' ? metadata : {}
      };
    } catch (error) {
      console.error('Error fetching template:', error);
      return null;
    }
  }

  /**
   * Updates the publish state of a workflow template.
   * Sets metadata.published flag to true or false.
   * @param templateId - The workflow template ID
   * @param published - Whether the workflow should be published
   * @param userId - The user ID performing the update (defaults to 'system')
   * @returns True if update was successful, false otherwise
   */
  async updateWorkflowPublishState(templateId: number, published: boolean, userId: string = 'system'): Promise<boolean> {
    try {
      // Get current metadata
      const template = await this.getTemplate(templateId);
      if (!template) {
        throw new Error(`Template with ID ${templateId} not found`);
      }

      // Validate it's a workflow
      if (template.type !== 'workflow') {
        throw new Error(`Template ${templateId} is not a workflow (type: ${template.type})`);
      }

      // Update metadata with published flag
      const metadata = { ...template.metadata, published };

      const query = `
        UPDATE templates
        SET metadata = $1, updated_at = CURRENT_TIMESTAMP, updated_by = $2
        WHERE id = $3
      `;
      const result = await this.pool.query(query, [
        JSON.stringify(metadata),
        userId,
        templateId
      ]);

      return (result.rowCount || 0) > 0;
    } catch (error) {
      console.error('Error updating workflow publish state:', error);
      throw error;
    }
  }

  /**
   * Validates that a workflow has a valid structure for publishing.
   * Checks for at least one executable step (agent, create_object, or load_object).
   * @param templateId - The workflow template ID
   * @returns Validation result with success flag and error message if failed
   */
  async validateWorkflowStructure(templateId: number): Promise<{ valid: boolean; error?: string }> {
    try {
      // Check if template exists and is a workflow
      const template = await this.getTemplate(templateId);
      if (!template) {
        return { valid: false, error: `Template with ID ${templateId} not found` };
      }

      if (template.type !== 'workflow') {
        return { valid: false, error: `Template ${templateId} is not a workflow (type: ${template.type})` };
      }

      // Check for at least one executable step
      const properties = await this.listProperties(templateId);
      const executableSteps = properties.filter((prop: any) => {
        const stepType = prop.step_type || '';
        return ['agent', 'create_object', 'load_object'].includes(stepType);
      });

      if (executableSteps.length === 0) {
        return {
          valid: false,
          error: 'Workflow must have at least one executable step (agent, create_object, or load_object)'
        };
      }

      // Validate tool name in metadata
      const metadata = template.metadata || {};
      if (!metadata.mcp_tool_name || typeof metadata.mcp_tool_name !== 'string' || !metadata.mcp_tool_name.trim()) {
        return { valid: false, error: 'Workflow must have a valid mcp_tool_name in template metadata' };
      }

      return { valid: true };
    } catch (error) {
      console.error('Error validating workflow structure:', error);
      return { valid: false, error: `Validation error: ${(error as Error).message}` };
    }
  }

  /**
   * Gets all published workflow templates.
   * @returns Array of published workflow templates
   */
  async getPublishedWorkflows(): Promise<Array<{
    id: number;
    name: string;
    description: string;
    related_schema: any;
    type: string;
    metadata: any;
    created_at: Date;
    updated_at: Date;
    created_by: string;
    updated_by: string;
  }>> {
    try {
      const query = `
        SELECT
          id,
          name,
          description,
          COALESCE(related_schema, '[]'::jsonb) AS related_schema,
          type,
          COALESCE(metadata, '{}'::jsonb) AS metadata,
          created_at,
          updated_at,
          created_by,
          updated_by
        FROM templates
        WHERE type = 'workflow' AND metadata->>'published' = 'true'
        ORDER BY name
      `;
      const result = await this.pool.query(query);

      return result.rows.map(row => {
        let relatedSchema = row.related_schema ?? [];
        let metadata = row.metadata ?? {};

        // Handle cases where the driver returns JSONB as string
        if (typeof relatedSchema === 'string') {
          try {
            relatedSchema = JSON.parse(relatedSchema);
          } catch (parseError) {
            console.error('Failed to parse related_schema JSON:', parseError);
            relatedSchema = [];
          }
        }

        if (typeof metadata === 'string') {
          try {
            metadata = JSON.parse(metadata);
          } catch (parseError) {
            console.error('Failed to parse metadata JSON:', parseError);
            metadata = {};
          }
        }

        return {
          ...row,
          related_schema: Array.isArray(relatedSchema) ? relatedSchema : [],
          metadata: typeof metadata === 'object' ? metadata : {}
        };
      });
    } catch (error) {
      console.error('Error fetching published workflows:', error);
      return [];
    }
  }

  async close() {
    await this.pool.end();
  }
}

export default DatabaseService;

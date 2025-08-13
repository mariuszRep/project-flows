/**
 * Database service layer for PostgreSQL integration
 */

import pg from 'pg';

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

interface ProjectData {
  id: number;
  name: string;
  description?: string;
  color: string;
  created_at: Date;
  updated_at: Date;
  created_by: string;
  updated_by: string;
}

interface TaskData {
  id: number;
  parent_id?: number;
  project_id?: number; // For backward compatibility with UI
  stage?: TaskStage;
  template_id?: number;
  [key: string]: any;
}

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


  async getSchemaProperties(templateId?: number): Promise<Record<string, SchemaProperty>> {
    try {
      let query = 'SELECT key, type, description, dependencies, execution_order, created_by, updated_by, created_at, updated_at, id, template_id, fixed FROM properties';
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
      
      return properties;
    } catch (error) {
      console.error('Error fetching schema properties:', error);
      // Return empty object on error to allow service to continue
      return {};
    }
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

  async createTask(taskData: Omit<TaskData, 'id'>, userId: string = 'system'): Promise<number> {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');

      // Insert task with parent_id, stage, and template_id
      const taskQuery = `
        INSERT INTO tasks (parent_id, stage, template_id, created_by, updated_by) 
        VALUES ($1, $2, $3, $4, $5) 
        RETURNING id
      `;
      const taskResult = await client.query(taskQuery, [taskData.parent_id || null, taskData.stage || 'draft', taskData.template_id || 1, userId, userId]);
      const taskId = taskResult.rows[0].id;

      // Insert blocks for all properties including Title and Description (previously title/summary)
      let position = 0;
      for (const [key, value] of Object.entries(taskData)) {
        if (key !== 'stage' && key !== 'parent_id' && key !== 'template_id' && value) {
          // Look up property_id from key
          const propertyQuery = 'SELECT id FROM properties WHERE key = $1 LIMIT 1';
          const propertyResult = await client.query(propertyQuery, [key]);
          
          if (propertyResult.rows.length > 0) {
            const propertyId = propertyResult.rows[0].id;
            const blockQuery = `
              INSERT INTO blocks (task_id, property_id, content, position, created_by, updated_by) 
              VALUES ($1, $2, $3, $4, $5, $6)
            `;
            await client.query(blockQuery, [taskId, propertyId, this.flattenToText(value), position++, userId, userId]);
          }
        }
      }

      await client.query('COMMIT');
      return taskId;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async updateTask(taskId: number, updates: Partial<TaskData>, userId: string = 'system'): Promise<boolean> {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');

      // Update task stage, parent_id, and/or template_id if provided
      const taskUpdates = [];
      const taskValues = [];
      let paramIndex = 1;
      
      if (updates.stage !== undefined) {
        taskUpdates.push(`stage = $${paramIndex++}`);
        taskValues.push(updates.stage);
      }
      
      if (updates.parent_id !== undefined) {
        taskUpdates.push(`parent_id = $${paramIndex++}`);
        taskValues.push(updates.parent_id);
      }
      
      if (updates.template_id !== undefined) {
        taskUpdates.push(`template_id = $${paramIndex++}`);
        taskValues.push(updates.template_id);
      }
      
      if (taskUpdates.length > 0) {
        taskUpdates.push(`updated_at = CURRENT_TIMESTAMP`);
        taskUpdates.push(`updated_by = $${paramIndex++}`);
        taskValues.push(userId);
        taskValues.push(taskId);
        
        const taskQuery = `UPDATE tasks SET ${taskUpdates.join(', ')} WHERE id = $${paramIndex}`;
        await client.query(taskQuery, taskValues);
      }

      // Update blocks for all other properties (including Title and Description)
      for (const [key, value] of Object.entries(updates)) {
        if (key !== 'id' && key !== 'stage' && key !== 'parent_id' && key !== 'template_id' && value !== undefined) {
          // Look up property_id from key
          const propertyQuery = 'SELECT id FROM properties WHERE key = $1 LIMIT 1';
          const propertyResult = await client.query(propertyQuery, [key]);
          
          if (propertyResult.rows.length > 0) {
            const propertyId = propertyResult.rows[0].id;
            const blockQuery = `
              INSERT INTO blocks (task_id, property_id, content, position, created_by, updated_by) 
              VALUES ($1, $2, $3, 0, $4, $5)
              ON CONFLICT (task_id, property_id) 
              DO UPDATE SET content = $3, updated_at = CURRENT_TIMESTAMP, updated_by = $5
            `;
            await client.query(blockQuery, [taskId, propertyId, this.flattenToText(value), userId, userId]);
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

  async getTask(taskId: number): Promise<TaskData | null> {
    try {
      // Get task core data (id, parent_id, stage, and template_id)
      const taskQuery = 'SELECT id, parent_id, stage, template_id FROM tasks WHERE id = $1';
      const taskResult = await this.pool.query(taskQuery, [taskId]);
      
      if (taskResult.rows.length === 0) {
        return null;
      }

      const task = taskResult.rows[0];
      
      // Get blocks for all properties including Title and Description
      const blocksQuery = `
        SELECT p.key as property_name, b.content 
        FROM blocks b
        JOIN properties p ON b.property_id = p.id
        WHERE b.task_id = $1 
        ORDER BY b.position
      `;
      const blocksResult = await this.pool.query(blocksQuery, [taskId]);
      
      // Build complete task data
      const taskData: TaskData = {
        id: task.id,
        parent_id: task.parent_id,
        project_id: task.parent_id, // For backward compatibility with UI
        stage: task.stage,
        template_id: task.template_id,
      };

      for (const block of blocksResult.rows) {
        // Content is now stored as TEXT, use directly
        taskData[block.property_name] = block.content;
      }

      return taskData;
    } catch (error) {
      console.error('Error fetching task:', error);
      return null;
    }
  }

  async getNextTaskId(): Promise<number> {
    try {
      const query = 'SELECT COALESCE(MAX(id), 0) + 1 as next_id FROM tasks';
      const result = await this.pool.query(query);
      return result.rows[0].next_id;
    } catch (error) {
      console.error('Error getting next task ID:', error);
      return 1;
    }
  }

  async listTasks(stageFilter?: string, projectIdFilter?: number, templateIdFilter?: number): Promise<TaskData[]> {
    try {
      // Get basic task data
      let query = 'SELECT id, parent_id, stage, template_id FROM tasks';
      let params: any[] = [];
      let paramIndex = 1;
      
      const conditions = [];
      
      if (templateIdFilter !== undefined) {
        conditions.push(`template_id = $${paramIndex++}`);
        params.push(templateIdFilter);
      }
      
      if (stageFilter) {
        conditions.push(`stage = $${paramIndex++}`);
        params.push(stageFilter);
      }
      
      if (projectIdFilter !== undefined) {
        conditions.push(`parent_id = $${paramIndex++}`);
        params.push(projectIdFilter);
      }
      
      if (conditions.length > 0) {
        query += ' WHERE ' + conditions.join(' AND ');
      }
      
      query += ' ORDER BY id';
      
      const tasksResult = await this.pool.query(query, params);
      
      if (tasksResult.rows.length === 0) {
        return [];
      }
      
      // Get all blocks for these tasks
      const taskIds = tasksResult.rows.map(row => row.id);
      const blocksQuery = `
        SELECT b.task_id, p.key as property_name, b.content 
        FROM blocks b
        JOIN properties p ON b.property_id = p.id
        WHERE b.task_id = ANY($1)
        ORDER BY b.task_id, b.position
      `;
      const blocksResult = await this.pool.query(blocksQuery, [taskIds]);
      
      // Group blocks by task_id
      const blocksByTask: Record<number, Array<{property_name: string, content: string}>> = {};
      for (const block of blocksResult.rows) {
        if (!blocksByTask[block.task_id]) {
          blocksByTask[block.task_id] = [];
        }
        blocksByTask[block.task_id].push({
          property_name: block.property_name,
          content: block.content
        });
      }
      
      // Build complete task data
      return tasksResult.rows.map((row: any) => {
        const taskData: TaskData = {
          id: row.id,
          parent_id: row.parent_id,
          project_id: row.parent_id, // For backward compatibility with UI
          stage: row.stage,
          template_id: row.template_id,
        };
        
        // Add blocks for this task
        const taskBlocks = blocksByTask[row.id] || [];
        for (const block of taskBlocks) {
          // Content is now stored as TEXT, use directly
          taskData[block.property_name] = block.content;
        }
        
        return taskData;
      });
    } catch (error) {
      console.error('Error fetching tasks list:', error);
      return [];
    }
  }

  async getTemplates(): Promise<Array<{id: number, name: string, description: string, created_at: Date, updated_at: Date, created_by: string, updated_by: string}>> {
    try {
      const query = 'SELECT id, name, description, created_at, updated_at, created_by, updated_by FROM templates ORDER BY name';
      const result = await this.pool.query(query);
      return result.rows;
    } catch (error) {
      console.error('Error fetching templates:', error);
      return [];
    }
  }


  async createProperty(templateId: number, propertyData: {
    key: string;
    type: string;
    description: string;
    dependencies?: string[];
    execution_order?: number;
    fixed?: boolean;
  }, userId: string = 'system'): Promise<number> {
    try {
      console.log('Database createProperty called with:', {
        templateId,
        propertyData,
        userId
      });

      const query = `
        INSERT INTO properties (template_id, key, type, description, dependencies, execution_order, fixed, created_by, updated_by) 
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) 
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

      if (updateFields.length === 0) {
        return false; // No fields to update
      }

      updateFields.push(`updated_at = CURRENT_TIMESTAMP`);
      updateFields.push(`updated_by = $${paramIndex++}`);
      values.push(userId);
      values.push(propertyId);

      const query = `UPDATE properties SET ${updateFields.join(', ')} WHERE id = $${paramIndex}`;
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
      const propertyQuery = 'SELECT key, fixed FROM properties WHERE id = $1';
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
      const deleteBlocksQuery = 'DELETE FROM blocks WHERE property_id = $1';
      const blocksResult = await client.query(deleteBlocksQuery, [propertyId]);
      const deletedBlockCount = blocksResult.rowCount || 0;

      if (deletedBlockCount > 0) {
        console.log(`Deleted ${deletedBlockCount} block(s) using property "${property.key}"`);
      }

      // Now safe to delete the property
      const deleteQuery = 'DELETE FROM properties WHERE id = $1';
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

  async deleteTask(taskId: number): Promise<boolean> {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');

      // Check if task exists
      const taskQuery = 'SELECT id FROM tasks WHERE id = $1';
      const taskResult = await client.query(taskQuery, [taskId]);
      
      if (taskResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return false;
      }

      // Delete blocks first (foreign key constraint)
      const deleteBlocksQuery = 'DELETE FROM blocks WHERE task_id = $1';
      await client.query(deleteBlocksQuery, [taskId]);

      // Delete task
      const deleteTaskQuery = 'DELETE FROM tasks WHERE id = $1';
      const deleteResult = await client.query(deleteTaskQuery, [taskId]);

      await client.query('COMMIT');
      return (deleteResult.rowCount || 0) > 0;
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error deleting task:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async listProperties(templateId?: number): Promise<Array<SchemaProperty & { key: string }>> {
    try {
      let query = `
        SELECT id, template_id, key, type, description, dependencies, execution_order, fixed,
               created_by, updated_by, created_at, updated_at 
        FROM properties
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
        updated_at: row.updated_at
      }));
    } catch (error) {
      console.error('Error listing properties:', error);
      return [];
    }
  }

  // Project CRUD operations (using tasks table with type='project')
  async createProject(projectData: {
    name: string;
    description?: string;
    color?: string;
  }, userId: string = 'system'): Promise<number> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // Create task with template_id=2 (Project template)
      const taskQuery = `
        INSERT INTO tasks (parent_id, stage, template_id, created_by, updated_by) 
        VALUES (NULL, 'backlog', 2, $1, $2) 
        RETURNING id
      `;
      const taskResult = await client.query(taskQuery, [userId, userId]);
      const taskId = taskResult.rows[0].id;

      // Insert Title block
      const titlePropertyQuery = 'SELECT id FROM properties WHERE key = $1 LIMIT 1';
      const titlePropertyResult = await client.query(titlePropertyQuery, ['Title']);
      if (titlePropertyResult.rows.length > 0) {
        const titlePropertyId = titlePropertyResult.rows[0].id;
        const titleQuery = `
          INSERT INTO blocks (task_id, property_id, content, position, created_by, updated_by) 
          VALUES ($1, $2, $3, 1, $4, $5)
        `;
        await client.query(titleQuery, [taskId, titlePropertyId, projectData.name, userId, userId]);
      }

      // Insert Description block if provided
      if (projectData.description) {
        const descPropertyQuery = 'SELECT id FROM properties WHERE key = $1 LIMIT 1';
        const descPropertyResult = await client.query(descPropertyQuery, ['Description']);
        if (descPropertyResult.rows.length > 0) {
          const descPropertyId = descPropertyResult.rows[0].id;
          const descQuery = `
            INSERT INTO blocks (task_id, property_id, content, position, created_by, updated_by) 
            VALUES ($1, $2, $3, 2, $4, $5)
          `;
          await client.query(descQuery, [taskId, descPropertyId, projectData.description, userId, userId]);
        }
      }

      // Insert color as Notes block for backward compatibility
      if (projectData.color) {
        const notesPropertyQuery = 'SELECT id FROM properties WHERE key = $1 LIMIT 1';
        const notesPropertyResult = await client.query(notesPropertyQuery, ['Notes']);
        if (notesPropertyResult.rows.length > 0) {
          const notesPropertyId = notesPropertyResult.rows[0].id;
          const colorQuery = `
            INSERT INTO blocks (task_id, property_id, content, position, created_by, updated_by) 
            VALUES ($1, $2, $3, 3, $4, $5)
          `;
          await client.query(colorQuery, [taskId, notesPropertyId, `Color: ${projectData.color}`, userId, userId]);
        }
      }

      await client.query('COMMIT');
      return taskId;
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error creating project:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async updateProject(projectId: number, updates: {
    name?: string;
    description?: string;
    color?: string;
  }, userId: string = 'system'): Promise<boolean> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // Verify this is a project task (template_id = 2)
      const checkQuery = 'SELECT id FROM tasks WHERE id = $1 AND template_id = $2';
      const checkResult = await client.query(checkQuery, [projectId, 2]);
      if (checkResult.rows.length === 0) {
        return false; // Project not found
      }

      // Update task timestamp
      const taskUpdateQuery = 'UPDATE tasks SET updated_at = CURRENT_TIMESTAMP, updated_by = $1 WHERE id = $2';
      await client.query(taskUpdateQuery, [userId, projectId]);

      // Update Title block if name is provided
      if (updates.name !== undefined) {
        const titlePropertyQuery = 'SELECT id FROM properties WHERE key = $1 LIMIT 1';
        const titlePropertyResult = await client.query(titlePropertyQuery, ['Title']);
        if (titlePropertyResult.rows.length > 0) {
          const titlePropertyId = titlePropertyResult.rows[0].id;
          const titleQuery = `
            INSERT INTO blocks (task_id, property_id, content, position, created_by, updated_by) 
            VALUES ($1, $2, $3, 1, $4, $5)
            ON CONFLICT (task_id, property_id) 
            DO UPDATE SET content = EXCLUDED.content, updated_by = EXCLUDED.updated_by, updated_at = CURRENT_TIMESTAMP
          `;
          await client.query(titleQuery, [projectId, titlePropertyId, updates.name, userId, userId]);
        }
      }

      // Update Description block if provided
      if (updates.description !== undefined) {
        const descPropertyQuery = 'SELECT id FROM properties WHERE key = $1 LIMIT 1';
        const descPropertyResult = await client.query(descPropertyQuery, ['Description']);
        if (descPropertyResult.rows.length > 0) {
          const descPropertyId = descPropertyResult.rows[0].id;
          const descQuery = `
            INSERT INTO blocks (task_id, property_id, content, position, created_by, updated_by) 
            VALUES ($1, $2, $3, 2, $4, $5)
            ON CONFLICT (task_id, property_id) 
            DO UPDATE SET content = EXCLUDED.content, updated_by = EXCLUDED.updated_by, updated_at = CURRENT_TIMESTAMP
          `;
          await client.query(descQuery, [projectId, descPropertyId, updates.description, userId, userId]);
        }
      }

      // Update color in Notes block if provided
      if (updates.color !== undefined) {
        const notesPropertyQuery = 'SELECT id FROM properties WHERE key = $1 LIMIT 1';
        const notesPropertyResult = await client.query(notesPropertyQuery, ['Notes']);
        if (notesPropertyResult.rows.length > 0) {
          const notesPropertyId = notesPropertyResult.rows[0].id;
          const colorQuery = `
            INSERT INTO blocks (task_id, property_id, content, position, created_by, updated_by) 
            VALUES ($1, $2, $3, 3, $4, $5)
            ON CONFLICT (task_id, property_id) 
            DO UPDATE SET content = EXCLUDED.content, updated_by = EXCLUDED.updated_by, updated_at = CURRENT_TIMESTAMP
          `;
          await client.query(colorQuery, [projectId, notesPropertyId, `Color: ${updates.color}`, userId, userId]);
        }
      }

      await client.query('COMMIT');
      return true;
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error updating project:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async getProject(projectId: number): Promise<ProjectData | null> {
    try {
      // Get task data for project type (template_id = 2)
      const taskQuery = 'SELECT id, created_at, updated_at, created_by, updated_by FROM tasks WHERE id = $1 AND template_id = $2';
      const taskResult = await this.pool.query(taskQuery, [projectId, 2]);
      
      if (taskResult.rows.length === 0) {
        return null;
      }

      const task = taskResult.rows[0];

      // Get blocks for this project
      const blocksQuery = `
        SELECT p.key as property_name, b.content 
        FROM blocks b
        JOIN properties p ON b.property_id = p.id
        WHERE b.task_id = $1 
        ORDER BY b.position
      `;
      const blocksResult = await this.pool.query(blocksQuery, [projectId]);

      // Build project data from blocks
      let name = 'Untitled Project';
      let description = '';
      let color = '#3b82f6';

      for (const block of blocksResult.rows) {
        // Content is now stored as TEXT
        const content = block.content;
        
        if (block.property_name === 'Title') {
          name = content;
        } else if (block.property_name === 'Description') {
          description = content;
        } else if (block.property_name === 'Notes' && content.startsWith('Color: ')) {
          color = content.replace('Color: ', '');
        }
      }

      return {
        id: task.id,
        name,
        description,
        color,
        created_at: task.created_at,
        updated_at: task.updated_at,
        created_by: task.created_by,
        updated_by: task.updated_by
      };
    } catch (error) {
      console.error('Error fetching project:', error);
      return null;
    }
  }

  async listProjects(): Promise<ProjectData[]> {
    try {
      // Get all project tasks (template_id = 2)
      const tasksQuery = 'SELECT id, created_at, updated_at, created_by, updated_by FROM tasks WHERE template_id = $1 ORDER BY created_at';
      const tasksResult = await this.pool.query(tasksQuery, [2]);
      
      if (tasksResult.rows.length === 0) {
        return [];
      }

      const projects: ProjectData[] = [];

      // Get blocks for all project tasks
      for (const task of tasksResult.rows) {
        const blocksQuery = `
          SELECT p.key as property_name, b.content 
          FROM blocks b
          JOIN properties p ON b.property_id = p.id
          WHERE b.task_id = $1 
          ORDER BY b.position
        `;
        const blocksResult = await this.pool.query(blocksQuery, [task.id]);

        // Build project data from blocks
        let name = 'Untitled Project';
        let description = '';
        let color = '#3b82f6';

        for (const block of blocksResult.rows) {
          // Content is now stored as TEXT
          const content = block.content;
          
          if (block.property_name === 'Title') {
            name = content;
          } else if (block.property_name === 'Description') {
            description = content;
          } else if (block.property_name === 'Notes' && content.startsWith('Color: ')) {
            color = content.replace('Color: ', '');
          }
        }

        projects.push({
          id: task.id,
          name,
          description,
          color,
          created_at: task.created_at,
          updated_at: task.updated_at,
          created_by: task.created_by,
          updated_by: task.updated_by
        });
      }

      // Sort by name
      projects.sort((a, b) => a.name.localeCompare(b.name));
      return projects;
    } catch (error) {
      console.error('Error fetching projects list:', error);
      return [];
    }
  }

  async deleteProject(projectId: number): Promise<boolean> {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');

      // Check if project exists (using tasks table with template_id=2)
      const projectQuery = 'SELECT id FROM tasks WHERE id = $1 AND template_id = $2';
      const projectResult = await client.query(projectQuery, [projectId, 2]);
      
      if (projectResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return false;
      }

      // Check for child tasks using this project as parent
      const tasksQuery = 'SELECT COUNT(*) as count FROM tasks WHERE parent_id = $1';
      const tasksResult = await client.query(tasksQuery, [projectId]);
      const taskCount = parseInt(tasksResult.rows[0].count);

      if (taskCount > 0) {
        await client.query('ROLLBACK');
        throw new Error(`Project cannot be deleted because it is used by ${taskCount} existing child task(s). Remove child tasks from this project first.`);
      }

      // Delete blocks associated with this project
      const deleteBlocksQuery = 'DELETE FROM blocks WHERE task_id = $1';
      await client.query(deleteBlocksQuery, [projectId]);

      // Delete the project task itself
      const deleteQuery = 'DELETE FROM tasks WHERE id = $1 AND template_id = $2';
      const deleteResult = await client.query(deleteQuery, [projectId, 2]);
      
      await client.query('COMMIT');
      return (deleteResult.rowCount || 0) > 0;
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error deleting project:', error);
      throw error;
    } finally {
      client.release();
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

      return JSON.parse(result.rows[0].value);
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

  async close() {
    await this.pool.end();
  }
}

export default DatabaseService;
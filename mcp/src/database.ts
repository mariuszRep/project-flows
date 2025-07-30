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

interface TaskData {
  id: number;
  stage?: TaskStage;
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


  async getSchemaProperties(): Promise<Record<string, SchemaProperty>> {
    try {
      const query = 'SELECT key, type, description, dependencies, execution_order, created_by, updated_by, created_at, updated_at, id, template_id, fixed FROM properties ORDER BY key';
      const result = await this.pool.query(query);
      
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

  async createTask(taskData: Omit<TaskData, 'id'>, userId: string = 'system'): Promise<number> {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');

      // Insert task with only stage
      const taskQuery = `
        INSERT INTO tasks (stage, created_by, updated_by) 
        VALUES ($1, $2, $3) 
        RETURNING id
      `;
      const taskResult = await client.query(taskQuery, [taskData.stage || 'draft', userId, userId]);
      const taskId = taskResult.rows[0].id;

      // Insert blocks for all properties including Title and Description (previously title/summary)
      let position = 0;
      for (const [key, value] of Object.entries(taskData)) {
        if (key !== 'stage' && value) {
          const blockQuery = `
            INSERT INTO blocks (task_id, property_name, content, position, created_by, updated_by) 
            VALUES ($1, $2, $3, $4, $5, $6)
          `;
          await client.query(blockQuery, [taskId, key, JSON.stringify(value), position++, userId, userId]);
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

      // Update task stage if provided
      if (updates.stage !== undefined) {
        const taskQuery = `
          UPDATE tasks 
          SET stage = $1, updated_at = CURRENT_TIMESTAMP, updated_by = $2 
          WHERE id = $3
        `;
        await client.query(taskQuery, [updates.stage, userId, taskId]);
      }

      // Update blocks for all other properties (including Title and Description)
      for (const [key, value] of Object.entries(updates)) {
        if (key !== 'id' && key !== 'stage' && value !== undefined) {
          const blockQuery = `
            INSERT INTO blocks (task_id, property_name, content, position, created_by, updated_by) 
            VALUES ($1, $2, $3, 0, $4, $5)
            ON CONFLICT (task_id, property_name) 
            DO UPDATE SET content = $3, updated_at = CURRENT_TIMESTAMP, updated_by = $5
          `;
          await client.query(blockQuery, [taskId, key, JSON.stringify(value), userId, userId]);
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
      // Get task core data (only id and stage now)
      const taskQuery = 'SELECT id, stage FROM tasks WHERE id = $1';
      const taskResult = await this.pool.query(taskQuery, [taskId]);
      
      if (taskResult.rows.length === 0) {
        return null;
      }

      const task = taskResult.rows[0];
      
      // Get blocks for all properties including Title and Description
      const blocksQuery = `
        SELECT property_name, content 
        FROM blocks 
        WHERE task_id = $1 
        ORDER BY position
      `;
      const blocksResult = await this.pool.query(blocksQuery, [taskId]);
      
      // Build complete task data
      const taskData: TaskData = {
        id: task.id,
        stage: task.stage,
      };

      for (const block of blocksResult.rows) {
        // Parse JSON content back to original value
        try {
          taskData[block.property_name] = JSON.parse(block.content);
        } catch (parseError) {
          // If JSON parsing fails, store as string
          taskData[block.property_name] = block.content;
        }
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

  async listTasks(stageFilter?: string): Promise<TaskData[]> {
    try {
      // Get basic task data
      let query = 'SELECT id, stage FROM tasks';
      let params: any[] = [];
      
      if (stageFilter) {
        query += ' WHERE stage = $1';
        params.push(stageFilter);
      }
      
      query += ' ORDER BY id';
      
      const tasksResult = await this.pool.query(query, params);
      
      if (tasksResult.rows.length === 0) {
        return [];
      }
      
      // Get all blocks for these tasks
      const taskIds = tasksResult.rows.map(row => row.id);
      const blocksQuery = `
        SELECT task_id, property_name, content 
        FROM blocks 
        WHERE task_id = ANY($1)
        ORDER BY task_id, position
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
          stage: row.stage,
        };
        
        // Add blocks for this task
        const taskBlocks = blocksByTask[row.id] || [];
        for (const block of taskBlocks) {
          try {
            taskData[block.property_name] = JSON.parse(block.content);
          } catch (parseError) {
            taskData[block.property_name] = block.content;
          }
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

  async getTemplateProperties(templateId: number): Promise<Record<string, SchemaProperty>> {
    try {
      const query = 'SELECT key, type, description, dependencies, execution_order, created_by, updated_by, created_at, updated_at, id, template_id, fixed FROM properties WHERE template_id = $1 ORDER BY execution_order, key';
      const result = await this.pool.query(query, [templateId]);
      
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
      console.error('Error fetching template properties:', error);
      return {};
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

      // Check for existing blocks using this property
      const blocksQuery = 'SELECT COUNT(*) as count FROM blocks WHERE property_name = $1';
      const blocksResult = await client.query(blocksQuery, [property.key]);
      const blockCount = parseInt(blocksResult.rows[0].count);

      if (blockCount > 0) {
        await client.query('ROLLBACK');
        throw new Error(`Property "${property.key}" cannot be deleted because it is used by ${blockCount} existing task block(s). Delete the tasks using this property first.`);
      }

      // Safe to delete - no references exist
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

  async close() {
    await this.pool.end();
  }
}

export default DatabaseService;
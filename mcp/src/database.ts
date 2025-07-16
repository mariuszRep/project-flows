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
  title: string;
  summary: string;
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

      // Insert task
      const taskQuery = `
        INSERT INTO tasks (title, summary, stage, created_by, updated_by) 
        VALUES ($1, $2, $3, $4, $5) 
        RETURNING id
      `;
      const taskResult = await client.query(taskQuery, [taskData.title, taskData.summary, taskData.stage || 'draft', userId, userId]);
      const taskId = taskResult.rows[0].id;

      // Insert blocks for dynamic properties
      let position = 0;
      for (const [key, value] of Object.entries(taskData)) {
        if (key !== 'title' && key !== 'summary' && value) {
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

      // Update task core fields if provided
      if (updates.title !== undefined || updates.summary !== undefined || updates.stage !== undefined) {
        const updateFields = [];
        const values = [];
        let paramIndex = 1;

        if (updates.title !== undefined) {
          updateFields.push(`title = $${paramIndex++}`);
          values.push(updates.title);
        }
        if (updates.summary !== undefined) {
          updateFields.push(`summary = $${paramIndex++}`);
          values.push(updates.summary);
        }
        if (updates.stage !== undefined) {
          updateFields.push(`stage = $${paramIndex++}`);
          values.push(updates.stage);
        }

        if (updateFields.length > 0) {
          updateFields.push(`updated_at = CURRENT_TIMESTAMP`);
          updateFields.push(`updated_by = $${paramIndex++}`);
          values.push(userId);
          values.push(taskId);
          const taskQuery = `UPDATE tasks SET ${updateFields.join(', ')} WHERE id = $${paramIndex}`;
          await client.query(taskQuery, values);
        }
      }

      // Update blocks for dynamic properties
      for (const [key, value] of Object.entries(updates)) {
        if (key !== 'id' && key !== 'title' && key !== 'summary' && key !== 'stage' && value !== undefined) {
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
      // Get task core data
      const taskQuery = 'SELECT id, title, summary, stage FROM tasks WHERE id = $1';
      const taskResult = await this.pool.query(taskQuery, [taskId]);
      
      if (taskResult.rows.length === 0) {
        return null;
      }

      const task = taskResult.rows[0];
      
      // Get blocks for dynamic properties
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
        title: task.title,
        summary: task.summary,
        stage: task.stage,
      };

      for (const block of blocksResult.rows) {
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

  async listTasks(stageFilter?: string): Promise<TaskData[]> {
    try {
      let query = 'SELECT id, title, summary, stage FROM tasks';
      let params: any[] = [];
      
      if (stageFilter) {
        query += ' WHERE stage = $1';
        params.push(stageFilter);
      }
      
      query += ' ORDER BY id';
      
      const result = await this.pool.query(query, params);
      return result.rows.map((row: any) => ({
        id: row.id,
        title: row.title,
        summary: row.summary,
        stage: row.stage,
      }));
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

  async close() {
    await this.pool.end();
  }
}

export default DatabaseService;
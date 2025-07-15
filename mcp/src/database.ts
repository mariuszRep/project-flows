/**
 * Database service layer for PostgreSQL integration
 */

import pg from 'pg';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const { Pool } = pg;

interface SchemaProperty {
  type: string;
  description: string;
  dependencies?: string[];
  execution_order?: number;
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
      
      // Load schema properties from JSON file into database
      await this.loadSchemaProperties();
    } catch (error) {
      console.error('Database initialization failed:', error);
      throw error;
    }
  }

  private async loadSchemaProperties() {
    try {
      const __filename = fileURLToPath(import.meta.url);
      const __dirname = dirname(__filename);
      const schemaPath = join(__dirname, '..', 'schema_properties.json');
      const schemaData = readFileSync(schemaPath, 'utf8');
      const properties = JSON.parse(schemaData);

      const client = await this.pool.connect();
      try {
        await client.query('BEGIN');

        for (const [key, value] of Object.entries(properties)) {
          const prop = value as SchemaProperty;
          const query = `
            INSERT INTO properties (key, type, description, dependencies, execution_order, created_by, updated_by) 
            VALUES ($1, $2, $3, $4, $5, $6, $7) 
            ON CONFLICT (key) 
            DO UPDATE SET 
              type = $2, 
              description = $3, 
              dependencies = $4, 
              execution_order = $5, 
              updated_by = $7, 
              updated_at = CURRENT_TIMESTAMP
          `;
          await client.query(query, [
            key, 
            prop.type, 
            prop.description, 
            prop.dependencies || [], 
            prop.execution_order || 0, 
            'system',
            'system'
          ]);
        }

        await client.query('COMMIT');
        console.log('Schema properties loaded successfully');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    } catch (error) {
      console.error('Error loading schema properties:', error);
      // Don't throw - allow service to continue even if schema loading fails
    }
  }

  async getSchemaProperties(): Promise<Record<string, SchemaProperty>> {
    try {
      const query = 'SELECT key, type, description, dependencies, execution_order FROM properties ORDER BY key';
      const result = await this.pool.query(query);
      
      const properties: Record<string, SchemaProperty> = {};
      for (const row of result.rows) {
        properties[row.key] = {
          type: row.type,
          description: row.description,
          dependencies: row.dependencies,
          execution_order: row.execution_order
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

  async listTasks(): Promise<TaskData[]> {
    try {
      const query = 'SELECT id, title, summary, stage FROM tasks ORDER BY id';
      const result = await this.pool.query(query);
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

  async close() {
    await this.pool.end();
  }
}

export default DatabaseService;
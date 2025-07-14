/**
 * Database service layer for PostgreSQL integration
 */
import pg from 'pg';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
const { Pool } = pg;
// Removed unused BlockData interface
class DatabaseService {
    pool;
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
        }
        catch (error) {
            console.error('Database initialization failed:', error);
            throw error;
        }
    }
    async loadSchemaProperties() {
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
                    const query = `
            INSERT INTO schema_properties (key, value) 
            VALUES ($1, $2) 
            ON CONFLICT (key) 
            DO UPDATE SET value = $2, updated_at = CURRENT_TIMESTAMP
          `;
                    await client.query(query, [key, JSON.stringify(value)]);
                }
                await client.query('COMMIT');
                console.log('Schema properties loaded successfully');
            }
            catch (error) {
                await client.query('ROLLBACK');
                throw error;
            }
            finally {
                client.release();
            }
        }
        catch (error) {
            console.error('Error loading schema properties:', error);
            // Don't throw - allow service to continue even if schema loading fails
        }
    }
    async getSchemaProperties() {
        try {
            const query = 'SELECT key, value FROM schema_properties ORDER BY key';
            const result = await this.pool.query(query);
            const properties = {};
            for (const row of result.rows) {
                properties[row.key] = JSON.parse(row.value);
            }
            return properties;
        }
        catch (error) {
            console.error('Error fetching schema properties:', error);
            // Return empty object on error to allow service to continue
            return {};
        }
    }
    async createTask(taskData) {
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');
            // Insert task
            const taskQuery = `
        INSERT INTO tasks (title, summary) 
        VALUES ($1, $2) 
        RETURNING id
      `;
            const taskResult = await client.query(taskQuery, [taskData.title, taskData.summary]);
            const taskId = taskResult.rows[0].id;
            // Insert blocks for dynamic properties
            let position = 0;
            for (const [key, value] of Object.entries(taskData)) {
                if (key !== 'title' && key !== 'summary' && value) {
                    const blockQuery = `
            INSERT INTO blocks (task_id, property_name, content, position) 
            VALUES ($1, $2, $3, $4)
          `;
                    await client.query(blockQuery, [taskId, key, JSON.stringify(value), position++]);
                }
            }
            await client.query('COMMIT');
            return taskId;
        }
        catch (error) {
            await client.query('ROLLBACK');
            throw error;
        }
        finally {
            client.release();
        }
    }
    async updateTask(taskId, updates) {
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');
            // Update task core fields if provided
            if (updates.title !== undefined || updates.summary !== undefined) {
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
                if (updateFields.length > 0) {
                    updateFields.push(`updated_at = CURRENT_TIMESTAMP`);
                    values.push(taskId);
                    const taskQuery = `UPDATE tasks SET ${updateFields.join(', ')} WHERE id = $${paramIndex}`;
                    await client.query(taskQuery, values);
                }
            }
            // Update blocks for dynamic properties
            for (const [key, value] of Object.entries(updates)) {
                if (key !== 'id' && key !== 'title' && key !== 'summary' && value !== undefined) {
                    const blockQuery = `
            INSERT INTO blocks (task_id, property_name, content, position) 
            VALUES ($1, $2, $3, 0)
            ON CONFLICT (task_id, property_name) 
            DO UPDATE SET content = $3, updated_at = CURRENT_TIMESTAMP
          `;
                    await client.query(blockQuery, [taskId, key, JSON.stringify(value)]);
                }
            }
            await client.query('COMMIT');
            return true;
        }
        catch (error) {
            await client.query('ROLLBACK');
            throw error;
        }
        finally {
            client.release();
        }
    }
    async getTask(taskId) {
        try {
            // Get task core data
            const taskQuery = 'SELECT id, title, summary FROM tasks WHERE id = $1';
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
            const taskData = {
                id: task.id,
                title: task.title,
                summary: task.summary,
            };
            for (const block of blocksResult.rows) {
                taskData[block.property_name] = JSON.parse(block.content);
            }
            return taskData;
        }
        catch (error) {
            console.error('Error fetching task:', error);
            return null;
        }
    }
    async getNextTaskId() {
        try {
            const query = 'SELECT COALESCE(MAX(id), 0) + 1 as next_id FROM tasks';
            const result = await this.pool.query(query);
            return result.rows[0].next_id;
        }
        catch (error) {
            console.error('Error getting next task ID:', error);
            return 1;
        }
    }
    async close() {
        await this.pool.end();
    }
}
export default DatabaseService;
//# sourceMappingURL=database.js.map
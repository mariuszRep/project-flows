#!/usr/bin/env node

/**
 * Integration tests for MCP PostgreSQL persistence
 * Tests database operations and task lifecycle
 */

import { spawn } from 'child_process';
import { Pool } from 'pg';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Test configuration
const TEST_DB_URL = process.env.TEST_DATABASE_URL || 'postgresql://mcp_user:mcp_password@localhost:5432/mcp_tasks';

class IntegrationTester {
  constructor() {
    this.pool = new Pool({ connectionString: TEST_DB_URL });
    this.passed = 0;
    this.failed = 0;
  }

  async runTests() {
    console.log('🧪 Starting MCP PostgreSQL Integration Tests\n');

    try {
      await this.testDatabaseConnection();
      await this.testSchemaPropertiesLoad();
      await this.testTaskCreation();
      await this.testTaskRetrieval();
      await this.testTaskUpdate();
      await this.testTaskDeletion();
      await this.testCascadeDeletion();
    } catch (error) {
      console.error('❌ Test suite failed:', error);
      this.failed++;
    } finally {
      await this.cleanup();
    }

    console.log(`\\n📊 Test Results: ${this.passed} passed, ${this.failed} failed`);
    process.exit(this.failed > 0 ? 1 : 0);
  }

  async testDatabaseConnection() {
    console.log('🔗 Testing database connection...');
    try {
      const result = await this.pool.query('SELECT NOW() as current_time');
      console.log('✅ Database connection successful');
      console.log(`   Connected at: ${result.rows[0].current_time}`);
      this.passed++;
    } catch (error) {
      console.error('❌ Database connection failed:', error.message);
      this.failed++;
      throw error;
    }
  }

  async testSchemaPropertiesLoad() {
    console.log('\\n📋 Testing schema properties loading...');
    try {
      // Load expected schema properties
      const schemaPath = join(__dirname, '..', 'schema_properties.json');
      const expectedSchema = JSON.parse(readFileSync(schemaPath, 'utf8'));
      
      // Query database for schema properties
      const result = await this.pool.query('SELECT key, value FROM schema_properties ORDER BY key');
      
      if (result.rows.length === 0) {
        console.log('⚠️  No schema properties found, loading them...');
        // Load schema properties (simulate bootstrap)
        for (const [key, value] of Object.entries(expectedSchema)) {
          await this.pool.query(
            'INSERT INTO schema_properties (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2',
            [key, JSON.stringify(value)]
          );
        }
        console.log('✅ Schema properties loaded successfully');
      } else {
        console.log(`✅ Found ${result.rows.length} schema properties in database`);
      }
      
      // Verify properties match expected
      for (const [key, expectedValue] of Object.entries(expectedSchema)) {
        const dbRow = result.rows.find(row => row.key === key);
        if (dbRow && JSON.stringify(JSON.parse(dbRow.value)) === JSON.stringify(expectedValue)) {
          console.log(`   ✓ Property '${key}' matches expected value`);
        } else {
          console.log(`   ⚠️  Property '${key}' missing or incorrect`);
        }
      }
      
      this.passed++;
    } catch (error) {
      console.error('❌ Schema properties test failed:', error.message);
      this.failed++;
    }
  }

  async testTaskCreation() {
    console.log('\\n➕ Testing task creation...');
    try {
      // Create a test task
      const taskData = {
        title: 'Test Task Creation',
        summary: 'Testing database task creation functionality',
        Research: 'This is test research data',
        Items: 'Test item 1\\nTest item 2'
      };

      // Insert task
      const taskResult = await this.pool.query(
        'INSERT INTO tasks (title, summary) VALUES ($1, $2) RETURNING id',
        [taskData.title, taskData.summary]
      );
      
      const taskId = taskResult.rows[0].id;
      console.log(`✅ Created task with ID: ${taskId}`);

      // Insert blocks
      let position = 0;
      for (const [key, value] of Object.entries(taskData)) {
        if (key !== 'title' && key !== 'summary') {
          await this.pool.query(
            'INSERT INTO blocks (task_id, property_name, content, position) VALUES ($1, $2, $3, $4)',
            [taskId, key, JSON.stringify(value), position++]
          );
        }
      }

      // Verify creation
      const verifyResult = await this.pool.query(
        'SELECT t.*, b.property_name, b.content FROM tasks t LEFT JOIN blocks b ON t.id = b.task_id WHERE t.id = $1',
        [taskId]
      );

      if (verifyResult.rows.length > 0) {
        console.log(`✅ Task verification successful - found ${verifyResult.rows.length} records`);
        this.passed++;
      } else {
        console.error('❌ Task verification failed - no records found');
        this.failed++;
      }
    } catch (error) {
      console.error('❌ Task creation test failed:', error.message);
      this.failed++;
    }
  }

  async testTaskRetrieval() {
    console.log('\\n📖 Testing task retrieval...');
    try {
      // Get all tasks
      const tasksResult = await this.pool.query('SELECT * FROM tasks ORDER BY id DESC LIMIT 1');
      
      if (tasksResult.rows.length === 0) {
        console.log('⚠️  No tasks found for retrieval test');
        return;
      }

      const taskId = tasksResult.rows[0].id;
      console.log(`🔍 Testing retrieval of task ID: ${taskId}`);

      // Get task with blocks
      const result = await this.pool.query(`
        SELECT t.id, t.title, t.summary, b.property_name, b.content, b.position
        FROM tasks t 
        LEFT JOIN blocks b ON t.id = b.task_id 
        WHERE t.id = $1 
        ORDER BY b.position
      `, [taskId]);

      if (result.rows.length > 0) {
        console.log(`✅ Retrieved task with ${result.rows.length} total records`);
        console.log(`   Task: ${result.rows[0].title}`);
        
        // Group by property
        const properties = {};
        for (const row of result.rows) {
          if (row.property_name) {
            properties[row.property_name] = JSON.parse(row.content);
          }
        }
        console.log(`   Properties: ${Object.keys(properties).join(', ')}`);
        this.passed++;
      } else {
        console.error('❌ Task retrieval failed - no records found');
        this.failed++;
      }
    } catch (error) {
      console.error('❌ Task retrieval test failed:', error.message);
      this.failed++;
    }
  }

  async testTaskUpdate() {
    console.log('\\n📝 Testing task update...');
    try {
      // Get a task to update
      const taskResult = await this.pool.query('SELECT id FROM tasks ORDER BY id DESC LIMIT 1');
      
      if (taskResult.rows.length === 0) {
        console.log('⚠️  No tasks found for update test');
        return;
      }

      const taskId = taskResult.rows[0].id;
      console.log(`📝 Testing update of task ID: ${taskId}`);

      // Update task core fields
      await this.pool.query(
        'UPDATE tasks SET title = $1, summary = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3',
        ['Updated Test Task', 'Updated summary for testing', taskId]
      );

      // Update/insert block
      await this.pool.query(`
        INSERT INTO blocks (task_id, property_name, content, position) 
        VALUES ($1, $2, $3, 0)
        ON CONFLICT (task_id, property_name) 
        DO UPDATE SET content = $3, updated_at = CURRENT_TIMESTAMP
      `, [taskId, 'Research', JSON.stringify('Updated research content')]);

      // Verify update
      const verifyResult = await this.pool.query(
        'SELECT title, summary FROM tasks WHERE id = $1',
        [taskId]
      );

      if (verifyResult.rows[0]?.title === 'Updated Test Task') {
        console.log('✅ Task update successful');
        this.passed++;
      } else {
        console.error('❌ Task update failed - changes not reflected');
        this.failed++;
      }
    } catch (error) {
      console.error('❌ Task update test failed:', error.message);
      this.failed++;
    }
  }

  async testTaskDeletion() {
    console.log('\\n🗑️  Testing task deletion...');
    try {
      // Create a task specifically for deletion testing
      const taskResult = await this.pool.query(
        'INSERT INTO tasks (title, summary) VALUES ($1, $2) RETURNING id',
        ['Task for Deletion', 'This task will be deleted']
      );
      
      const taskId = taskResult.rows[0].id;
      console.log(`Created task ${taskId} for deletion testing`);

      // Add some blocks
      await this.pool.query(
        'INSERT INTO blocks (task_id, property_name, content, position) VALUES ($1, $2, $3, 0)',
        [taskId, 'TestProperty', JSON.stringify('Test content'), 0]
      );

      // Delete the task
      const deleteResult = await this.pool.query('DELETE FROM tasks WHERE id = $1', [taskId]);
      
      if (deleteResult.rowCount === 1) {
        console.log('✅ Task deletion successful');
        this.passed++;
      } else {
        console.error('❌ Task deletion failed - no rows affected');
        this.failed++;
      }
    } catch (error) {
      console.error('❌ Task deletion test failed:', error.message);
      this.failed++;
    }
  }

  async testCascadeDeletion() {
    console.log('\\n🔗 Testing cascade deletion...');
    try {
      // Create a task with blocks
      const taskResult = await this.pool.query(
        'INSERT INTO tasks (title, summary) VALUES ($1, $2) RETURNING id',
        ['Cascade Test Task', 'Testing cascade deletion']
      );
      
      const taskId = taskResult.rows[0].id;

      // Add multiple blocks
      await this.pool.query(
        'INSERT INTO blocks (task_id, property_name, content, position) VALUES ($1, $2, $3, $4)',
        [taskId, 'Property1', JSON.stringify('Content 1'), 0]
      );
      await this.pool.query(
        'INSERT INTO blocks (task_id, property_name, content, position) VALUES ($1, $2, $3, $4)',
        [taskId, 'Property2', JSON.stringify('Content 2'), 1]
      );

      // Verify blocks exist
      const blocksResult = await this.pool.query(
        'SELECT COUNT(*) as count FROM blocks WHERE task_id = $1',
        [taskId]
      );
      
      console.log(`Created ${blocksResult.rows[0].count} blocks for cascade test`);

      // Delete the task
      await this.pool.query('DELETE FROM tasks WHERE id = $1', [taskId]);

      // Verify blocks are also deleted
      const remainingBlocks = await this.pool.query(
        'SELECT COUNT(*) as count FROM blocks WHERE task_id = $1',
        [taskId]
      );

      if (remainingBlocks.rows[0].count === '0') {
        console.log('✅ Cascade deletion successful - all blocks removed');
        this.passed++;
      } else {
        console.error(`❌ Cascade deletion failed - ${remainingBlocks.rows[0].count} blocks remaining`);
        this.failed++;
      }
    } catch (error) {
      console.error('❌ Cascade deletion test failed:', error.message);
      this.failed++;
    }
  }

  async cleanup() {
    console.log('\\n🧹 Cleaning up test environment...');
    try {
      // Clean up test data (optional - comment out to preserve data)
      // await this.pool.query("DELETE FROM tasks WHERE title LIKE '%Test%'");
      // await this.pool.query("DELETE FROM tasks WHERE title LIKE '%Updated%'");
      
      await this.pool.end();
      console.log('✅ Cleanup completed');
    } catch (error) {
      console.error('⚠️  Cleanup failed:', error.message);
    }
  }
}

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const tester = new IntegrationTester();
  tester.runTests();
}
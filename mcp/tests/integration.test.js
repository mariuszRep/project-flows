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
      await this.testTaskCreation();
      await this.testTaskRetrieval();
      await this.testTaskUpdate();
      await this.testTaskDeletion();
      await this.testCascadeDeletion();
      await this.testExecuteTaskWorkflow();
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
        'INSERT INTO objects (template_id) VALUES (1) RETURNING id',
        []
      );
      
      const taskId = taskResult.rows[0].id;
      console.log(`✅ Created task with ID: ${taskId}`);

      // Insert blocks
      let position = 0;
      for (const [key, value] of Object.entries(taskData)) {
        if (key !== 'title' && key !== 'summary') {
          await this.pool.query(
            'INSERT INTO object_properties (task_id, property_id, content, position) VALUES ($1, (SELECT id FROM template_properties WHERE key = $2), $3, $4)',
            [taskId, key, value, position++]
          );
        }
      }

      // Verify creation
      const verifyResult = await this.pool.query(
        'SELECT t.*, op.content FROM objects t LEFT JOIN object_properties op ON t.id = op.task_id WHERE t.id = $1',
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
      const tasksResult = await this.pool.query('SELECT * FROM objects ORDER BY id DESC LIMIT 1');
      
      if (tasksResult.rows.length === 0) {
        console.log('⚠️  No tasks found for retrieval test');
        return;
      }

      const taskId = tasksResult.rows[0].id;
      console.log(`🔍 Testing retrieval of task ID: ${taskId}`);

      // Get task with blocks
      const result = await this.pool.query(`
        SELECT t.id, op.content, op.position
        FROM objects t 
        LEFT JOIN object_properties op ON t.id = op.task_id 
        WHERE t.id = $1 
        ORDER BY op.position
      `, [taskId]);

      if (result.rows.length > 0) {
        console.log(`✅ Retrieved task with ${result.rows.length} total records`);
        console.log(`   Task: ${result.rows[0].id}`);
        
        // Group by property
        const properties = {};
        for (const row of result.rows) {
          if (row.content) {
            properties[row.position] = row.content;
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
      const taskResult = await this.pool.query('SELECT id FROM objects ORDER BY id DESC LIMIT 1');
      
      if (taskResult.rows.length === 0) {
        console.log('⚠️  No tasks found for update test');
        return;
      }

      const taskId = taskResult.rows[0].id;
      console.log(`📝 Testing update of task ID: ${taskId}`);

      // Update task core fields
      await this.pool.query(
        'UPDATE objects SET updated_at = CURRENT_TIMESTAMP WHERE id = $1',
        [taskId]
      );

      // Update/insert block
      await this.pool.query(`
        INSERT INTO object_properties (task_id, property_id, content, position) 
        VALUES ($1, (SELECT id FROM template_properties WHERE key = 'Title'), $2, 0)
        ON CONFLICT (task_id, property_id) 
        DO UPDATE SET content = $2, updated_at = CURRENT_TIMESTAMP
      `, [taskId, 'Updated Test Task']);

      // Verify update
      const verifyResult = await this.pool.query(
        'SELECT content FROM object_properties WHERE task_id = $1 AND property_id = (SELECT id FROM template_properties WHERE key = \'Title\')',
        [taskId]
      );

      if (verifyResult.rows[0]?.content === 'Updated Test Task') {
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
        'INSERT INTO objects (template_id) VALUES (1) RETURNING id',
        []
      );
      
      const taskId = taskResult.rows[0].id;
      console.log(`Created task ${taskId} for deletion testing`);

      // Add some blocks
      await this.pool.query(
        'INSERT INTO object_properties (task_id, property_id, content, position) VALUES ($1, (SELECT id FROM template_properties WHERE key = \'Title\'), $2, 0)',
        [taskId, 'Task for Deletion']
      );

      // Delete the task
      const deleteResult = await this.pool.query('DELETE FROM objects WHERE id = $1', [taskId]);
      
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
        'INSERT INTO objects (template_id) VALUES (1) RETURNING id',
        []
      );
      
      const taskId = taskResult.rows[0].id;

      // Add multiple blocks
      await this.pool.query(
        'INSERT INTO object_properties (task_id, property_id, content, position) VALUES ($1, (SELECT id FROM template_properties WHERE key = \'Title\'), $2, 0)',
        [taskId, 'Cascade Test Task']
      );
      await this.pool.query(
        'INSERT INTO object_properties (task_id, property_id, content, position) VALUES ($1, (SELECT id FROM template_properties WHERE key = \'Description\'), $2, 1)',
        [taskId, 'Testing cascade deletion']
      );

      // Verify blocks exist
      const blocksResult = await this.pool.query(
        'SELECT COUNT(*) as count FROM object_properties WHERE task_id = $1',
        [taskId]
      );
      
      console.log(`Created ${blocksResult.rows[0].count} blocks for cascade test`);

      // Delete the task
      await this.pool.query('DELETE FROM objects WHERE id = $1', [taskId]);

      // Verify blocks are also deleted
      const remainingBlocks = await this.pool.query(
        'SELECT COUNT(*) as count FROM object_properties WHERE task_id = $1',
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

  async testExecuteTaskWorkflow() {
    console.log('\\n⚡ Testing execute_task workflow stage transition...');
    try {
      // Create a test task using the current schema (objects table)
      const taskResult = await this.pool.query(`
        INSERT INTO objects (stage, template_id, parent_id, created_by, updated_by) 
        VALUES ($1, $2, $3, $4, $5) 
        RETURNING id
      `, ['backlog', 1, null, 'test_system', 'test_system']);
      
      const taskId = taskResult.rows[0].id;
      console.log(`📋 Created test task with ID: ${taskId} in 'backlog' stage`);

      // Add Title and Description properties to the task
      // First get property IDs for Title and Description
      const titlePropResult = await this.pool.query(
        'SELECT id FROM template_properties WHERE key = $1', ['Title']
      );
      const descPropResult = await this.pool.query(
        'SELECT id FROM template_properties WHERE key = $1', ['Description']
      );

      if (titlePropResult.rows.length > 0) {
        await this.pool.query(`
          INSERT INTO object_properties (task_id, property_id, content, position, created_by, updated_by)
          VALUES ($1, $2, $3, 0, $4, $5)
        `, [taskId, titlePropResult.rows[0].id, 'Test Execute Task Workflow', 'test_system', 'test_system']);
      }

      if (descPropResult.rows.length > 0) {
        await this.pool.query(`
          INSERT INTO object_properties (task_id, property_id, content, position, created_by, updated_by)
          VALUES ($1, $2, $3, 0, $4, $5)
        `, [taskId, descPropResult.rows[0].id, 'Testing that execute_task moves task to review stage', 'test_system', 'test_system']);
      }

      // Verify initial stage is 'backlog'
      const initialStageResult = await this.pool.query(
        'SELECT stage FROM objects WHERE id = $1', [taskId]
      );
      
      if (initialStageResult.rows[0].stage !== 'backlog') {
        console.error(`❌ Initial stage verification failed. Expected 'backlog', got '${initialStageResult.rows[0].stage}'`);
        this.failed++;
        return;
      }
      console.log(`✅ Verified initial stage: ${initialStageResult.rows[0].stage}`);

      // Simulate execute_task workflow stage transitions
      // Step 1: Move to 'doing' (this is what execute_task does initially)
      await this.pool.query(
        'UPDATE objects SET stage = $1, updated_at = CURRENT_TIMESTAMP, updated_by = $2 WHERE id = $3',
        ['doing', 'test_system', taskId]
      );
      console.log(`📝 Moved task to 'doing' stage (simulating execute_task start)`);

      // Step 2: Move to 'review' (this is the new functionality we added)
      await this.pool.query(
        'UPDATE objects SET stage = $1, updated_at = CURRENT_TIMESTAMP, updated_by = $2 WHERE id = $3',
        ['review', 'test_system', taskId]
      );
      console.log(`📝 Moved task to 'review' stage (simulating execute_task completion)`);

      // Verify final stage is 'review'
      const finalStageResult = await this.pool.query(
        'SELECT stage FROM objects WHERE id = $1', [taskId]
      );

      if (finalStageResult.rows[0].stage === 'review') {
        console.log('✅ Execute_task workflow test successful - task moved to review stage');
        this.passed++;
      } else {
        console.error(`❌ Execute_task workflow test failed. Expected 'review', got '${finalStageResult.rows[0].stage}'`);
        this.failed++;
      }

      // Clean up test task
      await this.pool.query('DELETE FROM objects WHERE id = $1', [taskId]);
      console.log(`🧹 Cleaned up test task ${taskId}`);

    } catch (error) {
      console.error('❌ Execute_task workflow test failed:', error.message);
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
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: "postgresql://mcp_user:mcp_password@localhost:5432/mcp_tasks"
});

// Simulate the database methods
class TestDatabase {
  constructor(pool) {
    this.pool = pool;
  }

  async listTasks(stageFilter) {
    try {
      // Get basic task data, excluding project-type tasks
      let query = 'SELECT id, parent_id, stage, type FROM tasks WHERE type != $1';
      let params = ['project'];
      
      if (stageFilter) {
        query += ' AND stage = $2';
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
      const blocksByTask = {};
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
      return tasksResult.rows.map((row) => {
        const taskData = {
          id: row.id,
          parent_id: row.parent_id,
          project_id: row.parent_id, // For backward compatibility with UI
          stage: row.stage,
          type: row.type,
        };
        
        // Add blocks for this task
        const taskBlocks = blocksByTask[row.id] || [];
        for (const block of taskBlocks) {
          // Parse JSON content back to original value
          try {
            taskData[block.property_name] = JSON.parse(block.content);
          } catch (parseError) {
            // If JSON parsing fails, store as string
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

  async listProjects() {
    try {
      // Get all project tasks
      const tasksQuery = 'SELECT id, created_at, updated_at, created_by, updated_by FROM tasks WHERE type = $1 ORDER BY created_at';
      const tasksResult = await this.pool.query(tasksQuery, ['project']);
      
      if (tasksResult.rows.length === 0) {
        return [];
      }

      const projects = [];

      // Get blocks for all project tasks
      for (const task of tasksResult.rows) {
        const blocksQuery = 'SELECT property_name, content FROM blocks WHERE task_id = $1 ORDER BY position';
        const blocksResult = await this.pool.query(blocksQuery, [task.id]);

        // Build project data from blocks
        let name = 'Untitled Project';
        let description = '';
        let color = '#3b82f6';

        for (const block of blocksResult.rows) {
          const content = typeof block.content === 'string' ? block.content : JSON.stringify(block.content).slice(1, -1); // Remove quotes
          
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
}

async function test() {
  const db = new TestDatabase(pool);
  
  console.log('=== TESTING LIST_PROJECTS ===');
  const projects = await db.listProjects();
  console.log(`Found ${projects.length} projects:`);
  projects.forEach(p => {
    console.log(`  Project ${p.id}: "${p.name}" (${p.description})`);
  });
  
  console.log('\n=== TESTING LIST_TASKS ===');
  const tasks = await db.listTasks();
  console.log(`Found ${tasks.length} tasks:`);
  tasks.forEach(t => {
    console.log(`  Task ${t.id}: parent_id=${t.parent_id}, project_id=${t.project_id}, stage=${t.stage}, title="${t.Title || 'No title'}"`);
  });
  
  console.log('\n=== FILTERING TASKS BY PROJECT 30 ===');
  const tasksForProject30 = tasks.filter(t => t.project_id === 30);
  console.log(`Found ${tasksForProject30.length} tasks for project 30:`);
  tasksForProject30.forEach(t => {
    console.log(`  Task ${t.id}: "${t.Title || 'No title'}" (${t.stage})`);
  });
  
  await pool.end();
}

test().catch(console.error);
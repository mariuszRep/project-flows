const { Pool } = require('pg');

const pool = new Pool({
  connectionString: "postgresql://mcp_user:mcp_password@localhost:5432/mcp_tasks"
});

async function debugTasks() {
  try {
    console.log('=== TESTING LISTTASKS QUERY ===');
    
    // This is the query from listTasks method
    let query = 'SELECT id, parent_id, stage, type FROM tasks WHERE type != $1';
    let params = ['project'];
    query += ' ORDER BY id';
    
    console.log('Query:', query);
    console.log('Params:', params);
    
    const tasksResult = await pool.query(query, params);
    console.log('Tasks found:', tasksResult.rows.length);
    console.log('Tasks:', tasksResult.rows);
    
    if (tasksResult.rows.length > 0) {
      // Get blocks for these tasks
      const taskIds = tasksResult.rows.map(row => row.id);
      const blocksQuery = `
        SELECT task_id, property_name, content 
        FROM blocks 
        WHERE task_id = ANY($1)
        ORDER BY task_id, position
      `;
      const blocksResult = await pool.query(blocksQuery, [taskIds]);
      console.log('\nBlocks found:', blocksResult.rows.length);
      
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
      const results = tasksResult.rows.map((row) => {
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
            taskData[block.property_name] = block.content;
          }
        }
        
        return taskData;
      });
      
      console.log('\n=== FINAL RESULTS ===');
      results.forEach(task => {
        console.log(`Task ${task.id}: parent_id=${task.parent_id}, project_id=${task.project_id}, type=${task.type}, stage=${task.stage}`);
        if (task.Title) console.log(`  Title: ${task.Title}`);
      });
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

debugTasks();
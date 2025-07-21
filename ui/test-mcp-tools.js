import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';

async function testMCPTools() {
  console.log('Testing MCP tools...');
  
  try {
    // Connect to the MCP server
    const transport = new SSEClientTransport(new URL('http://localhost:3001/sse'));
    const client = new Client(
      { name: 'test-client', version: '1.0.0' }, 
      { capabilities: { tools: {} } }
    );
    
    await client.connect(transport);
    console.log('✅ Connected to MCP server');
    
    // List available tools
    const toolsResponse = await client.listTools();
    console.log('\n📋 Available tools:');
    toolsResponse.tools.forEach(tool => {
      console.log(`  - ${tool.name}: ${tool.description || 'No description'}`);
    });
    
    // Test get_tasks_by_stage for each stage
    console.log('\n🧪 Testing get_tasks_by_stage for each stage:');
    
    for (const stage of ['backlog', 'doing', 'completed']) {
      try {
        console.log(`\n--- Testing stage: ${stage} ---`);
        const result = await client.callTool({ 
          name: 'get_tasks_by_stage', 
          arguments: { stage } 
        });
        console.log(`Result for ${stage}:`, result.content[0].text);
      } catch (error) {
        console.error(`Error testing ${stage}:`, error.message);
      }
    }
    
    // Test list_tasks (all tasks)
    console.log('\n--- Testing list_tasks (all tasks) ---');
    try {
      const result = await client.callTool({ 
        name: 'list_tasks', 
        arguments: {} 
      });
      console.log('All tasks result:', result.content[0].text);
    } catch (error) {
      console.error('Error testing list_tasks:', error.message);
    }
    
    // Create some test tasks to ensure we have data
    console.log('\n🔧 Creating test tasks...');
    
    const testTasks = [
      {
        title: 'Test Backlog Task 1',
        body: 'This is a test task in backlog',
        stage: 'backlog',
        created_by: 'test-script'
      },
      {
        title: 'Test Backlog Task 2',
        body: 'This is another test task in backlog',
        stage: 'backlog',
        created_by: 'test-script'
      },
      {
        title: 'Test Doing Task 1',
        body: 'This is a test task in doing',
        stage: 'doing',
        created_by: 'test-script'
      },
      {
        title: 'Test Doing Task 2',
        body: 'This is another test task in doing',
        stage: 'doing',
        created_by: 'test-script'
      },
      {
        title: 'Test Completed Task 1',
        body: 'This is a test task in completed',
        stage: 'completed',
        created_by: 'test-script'
      },
      {
        title: 'Test Completed Task 2',
        body: 'This is another test task in completed',
        stage: 'completed',
        created_by: 'test-script'
      }
    ];
    
    for (const task of testTasks) {
      try {
        const result = await client.callTool({ 
          name: 'create_task', 
          arguments: task 
        });
        console.log(`✅ Created ${task.title}`);
      } catch (error) {
        console.error(`❌ Failed to create ${task.title}:`, error.message);
      }
    }
    
    // Test get_tasks_by_stage again after creating tasks
    console.log('\n🧪 Testing get_tasks_by_stage after creating test tasks:');
    
    for (const stage of ['backlog', 'doing', 'completed']) {
      try {
        console.log(`\n--- Testing stage: ${stage} ---`);
        const result = await client.callTool({ 
          name: 'get_tasks_by_stage', 
          arguments: { stage } 
        });
        console.log(`Result for ${stage}:`, result.content[0].text);
        
        // Count tasks in the response
        const taskCount = (result.content[0].text.match(/Task #\d+:/g) || []).length;
        console.log(`Number of tasks found in ${stage}: ${taskCount}`);
      } catch (error) {
        console.error(`Error testing ${stage}:`, error.message);
      }
    }
    
    // Test list_tasks (all tasks) again
    console.log('\n--- Testing list_tasks (all tasks) after creating test tasks ---');
    try {
      const result = await client.callTool({ 
        name: 'list_tasks', 
        arguments: {} 
      });
      console.log('All tasks result:', result.content[0].text);
      
      // Count total tasks
      const totalTaskCount = (result.content[0].text.match(/Task #\d+:/g) || []).length;
      console.log(`Total number of tasks found: ${totalTaskCount}`);
    } catch (error) {
      console.error('Error testing list_tasks:', error.message);
    }
    
    await client.close();
    console.log('\n✅ Test completed successfully');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testMCPTools().catch(console.error);
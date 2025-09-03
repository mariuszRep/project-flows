import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';

async function testMCPObjectTools() {
  console.log('Testing MCP Object Tools...');

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

    // Helper to parse JSON content from tool response
    const parseContent = (res) => {
      try {
        const txt = res?.content?.[0]?.text ?? '';
        return JSON.parse(txt);
      } catch {
        return null;
      }
    };

    // Create some test tasks using create_object (template_id=1)
    console.log('\n🔧 Creating test tasks via create_object...');

    const testTasks = [
      { Title: 'Test Backlog Task 1', Description: 'This is a test task in backlog', stage: 'backlog' },
      { Title: 'Test Backlog Task 2', Description: 'This is another test task in backlog', stage: 'backlog' },
      { Title: 'Test Doing Task 1', Description: 'This is a test task in doing', stage: 'doing' },
      { Title: 'Test Doing Task 2', Description: 'This is another test task in doing', stage: 'doing' },
      { Title: 'Test Completed Task 1', Description: 'This is a test task in completed', stage: 'completed' },
      { Title: 'Test Completed Task 2', Description: 'This is another test task in completed', stage: 'completed' },
    ];

    const createdIds = [];
    for (const task of testTasks) {
      try {
        const res = await client.callTool({
          name: 'create_object',
          arguments: { template_id: 1, ...task }
        });
        const data = parseContent(res);
        if (data?.success && data?.object_id) {
          createdIds.push(data.object_id);
          console.log(`✅ Created ${task.Title} (ID ${data.object_id})`);
        } else {
          console.warn(`⚠️ Create response not parsable for ${task.Title}`);
        }
      } catch (error) {
        console.error(`❌ Failed to create ${task.Title}:`, error.message);
      }
    }

    // List all tasks using list_objects
    console.log('\n📄 Listing all tasks via list_objects...');
    try {
      const res = await client.callTool({ name: 'list_objects', arguments: { template_id: 1 } });
      const data = parseContent(res);
      console.log('All tasks summary:', JSON.stringify(data, null, 2));
      console.log(`Total tasks returned: ${data?.count ?? 'unknown'}`);
    } catch (error) {
      console.error('Error listing tasks:', error.message);
    }

    // List tasks by stage using list_objects with stage filter
    for (const stage of ['backlog', 'doing', 'completed']) {
      try {
        console.log(`\n🧪 Listing tasks in stage: ${stage}`);
        const res = await client.callTool({ name: 'list_objects', arguments: { template_id: 1, stage } });
        const data = parseContent(res);
        const count = data?.count ?? 0;
        console.log(`Count for ${stage}: ${count}`);
      } catch (error) {
        console.error(`Error listing ${stage}:`, error.message);
      }
    }

    // Cleanup: delete created test tasks
    console.log('\n🧹 Cleaning up created test tasks...');
    for (const id of createdIds) {
      try {
        const res = await client.callTool({ name: 'delete_object', arguments: { object_id: id } });
        const data = parseContent(res);
        if (data?.success) {
          console.log(`🗑️ Deleted task ID ${id}`);
        } else {
          console.warn(`⚠️ Delete response not parsable for ID ${id}`);
        }
      } catch (error) {
        console.error(`Error deleting task ID ${id}:`, error.message);
      }
    }

    await client.close();
    console.log('\n✅ Object Tools test completed successfully');

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testMCPObjectTools().catch(console.error);

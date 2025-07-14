#!/usr/bin/env node

import DatabaseService from './dist/database.js';

async function testBlocks() {
  const dbService = new DatabaseService();
  
  try {
    await dbService.initialize();
    
    // Create a task with dynamic properties
    const taskData = {
      title: "Test Task with Blocks",
      summary: "Testing if blocks are properly saved",
      Research: "This is research content that should be saved as a block",
      Items: "- Item 1\n- Item 2\n- Item 3"
    };
    
    console.log('Creating task with data:', taskData);
    
    const taskId = await dbService.createTask(taskData);
    console.log('Created task with ID:', taskId);
    
    // Retrieve the task to verify blocks were saved
    const retrievedTask = await dbService.getTask(taskId);
    console.log('Retrieved task:', retrievedTask);
    
    await dbService.close();
  } catch (error) {
    console.error('Test failed:', error);
    await dbService.close();
  }
}

testBlocks();
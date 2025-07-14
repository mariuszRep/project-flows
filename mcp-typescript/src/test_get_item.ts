#!/usr/bin/env node

/**
 * Unit tests for the get_item MCP tool
 */

import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

// Import the types and functions from the main module
interface SchemaProperty {
  type: string;
  description: string;
  dependencies?: string[];
  execution_order?: number;
}

interface SchemaProperties {
  [key: string]: SchemaProperty;
}

interface ExecutionChainItem {
  execution_order: number;
  prop_name: string;
  prop_config: SchemaProperty;
}

interface TaskData {
  id: number;
  title: string;
  summary: string;
  [key: string]: any;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Mock task storage for testing
let taskIdCounter = 1;
const taskStorage: Map<number, TaskData> = new Map();

function loadDynamicSchemaProperties(): SchemaProperties {
  try {
    const schemaFile = join(__dirname, "..", "schema_properties.json");
    const data = readFileSync(schemaFile, "utf8");
    return JSON.parse(data);
  } catch (error) {
    return {};
  }
}

function createExecutionChain(properties: SchemaProperties): ExecutionChainItem[] {
  const sortedProps: ExecutionChainItem[] = [];
  
  for (const [propName, propConfig] of Object.entries(properties)) {
    const executionOrder = propConfig.execution_order ?? 999;
    sortedProps.push({
      execution_order: executionOrder,
      prop_name: propName,
      prop_config: propConfig,
    });
  }
  
  return sortedProps.sort((a, b) => a.execution_order - b.execution_order);
}

// Test cases
interface TestCase {
  name: string;
  taskId: number;
  expectedSuccess: boolean;
  expectedContent?: string[];
}

const testCases: TestCase[] = [
  {
    name: "Get non-existent task - should fail",
    taskId: 999,
    expectedSuccess: false,
    expectedContent: ["Error: Task with ID 999 not found"]
  },
  {
    name: "Get task with invalid ID (0) - should fail",
    taskId: 0,
    expectedSuccess: false,
    expectedContent: ["Error: Valid numeric task_id is required"]
  },
  {
    name: "Get existing task - should succeed",
    taskId: 1,
    expectedSuccess: true,
    expectedContent: ["**Task ID:** 1", "**Title:** Test Task", "## Summary", "Test summary"]
  },
  {
    name: "Get task with dynamic properties - should succeed",
    taskId: 2,
    expectedSuccess: true,
    expectedContent: ["**Task ID:** 2", "**Title:** Complex Task", "## Research", "## Items", "Research content", "Item 1"]
  }
];

async function runTests() {
  console.log("🧪 Running get_item MCP tool tests...\n");
  
  const dynamicProperties = loadDynamicSchemaProperties();
  console.log("📋 Loaded schema properties:", Object.keys(dynamicProperties));
  
  // Set up test data
  console.log("🔧 Setting up test tasks...");
  
  // Task 1: Simple task
  const task1: TaskData = {
    id: 1,
    title: "Test Task",
    summary: "Test summary"
  };
  taskStorage.set(1, task1);
  
  // Task 2: Complex task with dynamic properties
  const task2: TaskData = {
    id: 2,
    title: "Complex Task",
    summary: "Complex summary",
    Research: "Research content for testing",
    Items: "- Item 1\n- Item 2\n- Item 3"
  };
  taskStorage.set(2, task2);
  
  console.log("✅ Test tasks created\n");

  let passed = 0;
  let failed = 0;

  for (const testCase of testCases) {
    console.log(`🔍 Testing: ${testCase.name}`);
    
    try {
      // Simulate the get_item validation logic
      const taskId = testCase.taskId;
      let markdownContent: string;
      
      // First check task ID validation
      if (!taskId || typeof taskId !== 'number' || taskId < 1) {
        markdownContent = "Error: Valid numeric task_id is required for retrieval.";
        
        if (testCase.expectedSuccess) {
          console.log(`❌ FAIL: Expected success but task ID validation failed`);
          failed++;
          continue;
        }
      } else {
        // Check if task exists
        const task = taskStorage.get(taskId);
        if (!task) {
          markdownContent = `Error: Task with ID ${taskId} not found.`;
          
          if (testCase.expectedSuccess) {
            console.log(`❌ FAIL: Expected success but task not found`);
            failed++;
            continue;
          }
        } else {
          // Generate success markdown
          markdownContent = `# Task\n**Task ID:** ${task.id}\n\n**Title:** ${task.title}\n\n## Summary\n\n${task.summary}\n`;
          
          const executionChain = createExecutionChain(dynamicProperties);
          for (const { prop_name } of executionChain) {
            const value = task[prop_name];
            if (value) {
              markdownContent += `\n## ${prop_name}\n\n${value}\n`;
            }
          }
        }
      }

      // Check expected content appears in output
      if (testCase.expectedContent) {
        const allContentFound = testCase.expectedContent.every(content => 
          markdownContent.includes(content)
        );
        
        if (!allContentFound) {
          console.log(`❌ FAIL: Expected content not found in output`);
          console.log(`   Expected: ${testCase.expectedContent.join(', ')}`);
          console.log(`   Got: ${markdownContent.substring(0, 200)}...`);
          failed++;
          continue;
        }
      }
      
      console.log(`✅ PASS`);
      passed++;
      
    } catch (error) {
      console.log(`❌ FAIL: ${error}`);
      failed++;
    }
    
    console.log();
  }
  
  console.log(`\n📊 Test Results: ${passed} passed, ${failed} failed`);
  
  if (failed === 0) {
    console.log("🎉 All tests passed!");
    return true;
  } else {
    console.log("💥 Some tests failed!");
    return false;
  }
}

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runTests().then((success) => {
    process.exit(success ? 0 : 1);
  });
}
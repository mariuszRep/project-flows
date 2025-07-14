import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

// Task and Block interfaces
export interface Task {
  id: number;
  title: string;
  created_by: string;
  created_at: Date;
  version: number;
}

export interface Block {
  id: number;
  task_id: number;
  block_type: string;
  content: string;
  created_at: Date;
  updated_at: Date;
}

interface SchemaProperty {
  type: string;
  description: string;
  dependencies?: string[];
  execution_order?: number;
}

interface SchemaProperties {
  [key: string]: SchemaProperty;
}

// Storage
let taskIdCounter = 1;
let blockIdCounter = 1;
const taskStorage: Map<number, Task> = new Map();
const blockStorage: Map<number, Block[]> = new Map();

// Helper function to load schema properties
function loadDynamicSchemaProperties(): SchemaProperties {
  try {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    const schemaFile = join(__dirname, "..", "schema_properties.json");
    const data = readFileSync(schemaFile, "utf8");
    return JSON.parse(data);
  } catch (error) {
    return {};
  }
}

// CRUD Helper Functions
export function createTask(title: string, createdBy: string = "system"): Task {
  const now = new Date();
  const task: Task = {
    id: taskIdCounter++,
    title,
    created_by: createdBy,
    created_at: now,
    version: 1,
  };
  
  taskStorage.set(task.id, task);
  return task;
}

export function updateTask(taskId: number, updates: Partial<Omit<Task, 'id' | 'created_at'>>): Task | null {
  const task = taskStorage.get(taskId);
  if (!task) return null;
  
  const updatedTask: Task = {
    ...task,
    ...updates,
    version: task.version + 1,
  };
  
  taskStorage.set(taskId, updatedTask);
  return updatedTask;
}

export function getTask(taskId: number): Task | null {
  return taskStorage.get(taskId) || null;
}

export function addBlock(taskId: number, blockType: string, content: string): Block | null {
  const task = getTask(taskId);
  if (!task) return null;
  
  // Validate block_type against schema
  const dynamicProperties = loadDynamicSchemaProperties();
  const validBlockTypes = ["Summary", ...Object.keys(dynamicProperties)];
  if (!validBlockTypes.includes(blockType)) {
    return null;
  }
  
  const now = new Date();
  const block: Block = {
    id: blockIdCounter++,
    task_id: taskId,
    block_type: blockType,
    content,
    created_at: now,
    updated_at: now,
  };
  
  const taskBlocks = blockStorage.get(taskId) || [];
  taskBlocks.push(block);
  blockStorage.set(taskId, taskBlocks);
  
  return block;
}

export function updateBlock(taskId: number, blockType: string, content: string): Block | null {
  const taskBlocks = blockStorage.get(taskId);
  if (!taskBlocks) return null;
  
  const blockIndex = taskBlocks.findIndex(b => b.block_type === blockType);
  if (blockIndex === -1) return null;
  
  const updatedBlock: Block = {
    ...taskBlocks[blockIndex],
    content,
    updated_at: new Date(),
  };
  
  taskBlocks[blockIndex] = updatedBlock;
  blockStorage.set(taskId, taskBlocks);
  
  return updatedBlock;
}

export function getBlocks(taskId: number): Block[] {
  return blockStorage.get(taskId) || [];
}

export function getBlockByType(taskId: number, blockType: string): Block | null {
  const blocks = getBlocks(taskId);
  return blocks.find(b => b.block_type === blockType) || null;
}

// Output aggregation types
export interface AggregatedOutput {
  task: Task | null;
  blocks: Block[];
  metadata: {
    taskId: number;
    totalBlocks: number;
    hasContent: boolean;
    aggregatedAt: Date;
    [key: string]: any; // Allow additional metadata properties
  };
}

// Unified output aggregator function
export function aggregateFinalOutput(
  taskOutput: Task | null,
  blocksOutput: Block[],
  metadataOutput: Record<string, any> | null
): AggregatedOutput {
  const safeTask = taskOutput || null;
  const safeBlocks = Array.isArray(blocksOutput) ? blocksOutput : [];
  const safeMeta = metadataOutput || {};

  return {
    task: safeTask,
    blocks: safeBlocks,
    metadata: {
      taskId: safeTask?.id || 0,
      totalBlocks: safeBlocks.length,
      hasContent: safeBlocks.length > 0 || safeTask !== null,
      aggregatedAt: new Date(),
      ...safeMeta
    }
  };
}

// Test utilities
export function resetStorage(): void {
  taskIdCounter = 1;
  blockIdCounter = 1;
  taskStorage.clear();
  blockStorage.clear();
}
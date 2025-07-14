import { test } from 'node:test';
import assert from 'node:assert';
import { createTask, addBlock, aggregateFinalOutput, resetStorage } from './storage.js';
test('aggregateFinalOutput should handle normal case with all valid inputs', () => {
    resetStorage();
    const task = createTask('Test Task');
    const block1 = addBlock(task.id, 'Summary', 'Test summary content');
    const block2 = addBlock(task.id, 'Research', 'Test research content');
    const metadata = { version: 1, source: 'test' };
    const result = aggregateFinalOutput(task, [block1, block2], metadata);
    assert.strictEqual(result.task?.id, task.id);
    assert.strictEqual(result.task?.title, 'Test Task');
    assert.strictEqual(result.blocks.length, 2);
    assert.strictEqual(result.metadata.taskId, task.id);
    assert.strictEqual(result.metadata.totalBlocks, 2);
    assert.strictEqual(result.metadata.hasContent, true);
    assert.strictEqual(result.metadata.version, 1);
    assert.strictEqual(result.metadata.source, 'test');
    assert.ok(result.metadata.aggregatedAt instanceof Date);
});
test('aggregateFinalOutput should handle null task input', () => {
    resetStorage();
    const blocks = [];
    const metadata = { note: 'no task' };
    const result = aggregateFinalOutput(null, blocks, metadata);
    assert.strictEqual(result.task, null);
    assert.strictEqual(result.blocks.length, 0);
    assert.strictEqual(result.metadata.taskId, 0);
    assert.strictEqual(result.metadata.totalBlocks, 0);
    assert.strictEqual(result.metadata.hasContent, false);
    assert.strictEqual(result.metadata.note, 'no task');
    assert.ok(result.metadata.aggregatedAt instanceof Date);
});
test('aggregateFinalOutput should handle empty blocks array', () => {
    resetStorage();
    const task = createTask('Task without blocks');
    const emptyBlocks = [];
    const metadata = null;
    const result = aggregateFinalOutput(task, emptyBlocks, metadata);
    assert.strictEqual(result.task?.id, task.id);
    assert.strictEqual(result.blocks.length, 0);
    assert.strictEqual(result.metadata.taskId, task.id);
    assert.strictEqual(result.metadata.totalBlocks, 0);
    assert.strictEqual(result.metadata.hasContent, true); // true because task exists
    assert.ok(result.metadata.aggregatedAt instanceof Date);
});
test('aggregateFinalOutput should handle invalid blocks input gracefully', () => {
    resetStorage();
    const task = createTask('Test Task');
    // Testing invalid input handling
    const invalidBlocks = "not an array";
    const metadata = { test: true };
    const result = aggregateFinalOutput(task, invalidBlocks, metadata);
    assert.strictEqual(result.task?.id, task.id);
    assert.strictEqual(result.blocks.length, 0);
    assert.strictEqual(result.metadata.taskId, task.id);
    assert.strictEqual(result.metadata.totalBlocks, 0);
    assert.strictEqual(result.metadata.hasContent, true); // true because task exists
    assert.strictEqual(result.metadata.test, true);
});
test('aggregateFinalOutput should handle all null/undefined inputs', () => {
    resetStorage();
    const result = aggregateFinalOutput(null, [], null);
    assert.strictEqual(result.task, null);
    assert.strictEqual(result.blocks.length, 0);
    assert.strictEqual(result.metadata.taskId, 0);
    assert.strictEqual(result.metadata.totalBlocks, 0);
    assert.strictEqual(result.metadata.hasContent, false);
    assert.ok(result.metadata.aggregatedAt instanceof Date);
});
test('aggregateFinalOutput should handle large payloads', () => {
    resetStorage();
    const task = createTask('Large Task');
    const blocks = [];
    // Create many blocks to test large payload handling
    for (let i = 0; i < 100; i++) {
        const block = addBlock(task.id, 'Summary', `Content ${i}`.repeat(100));
        if (block)
            blocks.push(block);
    }
    const largeMetadata = {
        description: 'x'.repeat(1000),
        items: Array.from({ length: 50 }, (_, i) => ({ id: i, data: `item-${i}` }))
    };
    const result = aggregateFinalOutput(task, blocks, largeMetadata);
    assert.strictEqual(result.task?.id, task.id);
    assert.strictEqual(result.blocks.length, 100);
    assert.strictEqual(result.metadata.taskId, task.id);
    assert.strictEqual(result.metadata.totalBlocks, 100);
    assert.strictEqual(result.metadata.hasContent, true);
    assert.strictEqual(result.metadata.description.length, 1000);
    assert.strictEqual(result.metadata.items.length, 50);
});
test('aggregateFinalOutput return type should match AggregatedOutput interface', () => {
    resetStorage();
    const task = createTask('Type Test');
    const block = addBlock(task.id, 'Summary', 'Content');
    const result = aggregateFinalOutput(task, block ? [block] : [], { test: 1 });
    // Verify the structure matches AggregatedOutput interface
    assert.ok('task' in result);
    assert.ok('blocks' in result);
    assert.ok('metadata' in result);
    assert.ok('taskId' in result.metadata);
    assert.ok('totalBlocks' in result.metadata);
    assert.ok('hasContent' in result.metadata);
    assert.ok('aggregatedAt' in result.metadata);
    // Verify types
    assert.ok(result.task === null || typeof result.task.id === 'number');
    assert.ok(Array.isArray(result.blocks));
    assert.ok(typeof result.metadata.taskId === 'number');
    assert.ok(typeof result.metadata.totalBlocks === 'number');
    assert.ok(typeof result.metadata.hasContent === 'boolean');
    assert.ok(result.metadata.aggregatedAt instanceof Date);
});
//# sourceMappingURL=storage.test.js.map
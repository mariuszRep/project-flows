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
export declare function createTask(title: string, createdBy?: string): Task;
export declare function updateTask(taskId: number, updates: Partial<Omit<Task, 'id' | 'created_at'>>): Task | null;
export declare function getTask(taskId: number): Task | null;
export declare function addBlock(taskId: number, blockType: string, content: string): Block | null;
export declare function updateBlock(taskId: number, blockType: string, content: string): Block | null;
export declare function getBlocks(taskId: number): Block[];
export declare function getBlockByType(taskId: number, blockType: string): Block | null;
export interface AggregatedOutput {
    task: Task | null;
    blocks: Block[];
    metadata: {
        taskId: number;
        totalBlocks: number;
        hasContent: boolean;
        aggregatedAt: Date;
        [key: string]: any;
    };
}
export declare function aggregateFinalOutput(taskOutput: Task | null, blocksOutput: Block[], metadataOutput: Record<string, any> | null): AggregatedOutput;
export declare function resetStorage(): void;
//# sourceMappingURL=storage.d.ts.map
/**
 * Database service layer for PostgreSQL integration
 */
interface SchemaProperty {
    type: string;
    description: string;
    dependencies?: string[];
    execution_order?: number;
}
interface TaskData {
    id: number;
    title: string;
    summary: string;
    [key: string]: any;
}
declare class DatabaseService {
    private pool;
    constructor();
    initialize(): Promise<void>;
    private loadSchemaProperties;
    getSchemaProperties(): Promise<Record<string, SchemaProperty>>;
    createTask(taskData: Omit<TaskData, 'id'>): Promise<number>;
    updateTask(taskId: number, updates: Partial<TaskData>): Promise<boolean>;
    getTask(taskId: number): Promise<TaskData | null>;
    getNextTaskId(): Promise<number>;
    listTasks(): Promise<TaskData[]>;
    close(): Promise<void>;
}
export default DatabaseService;
//# sourceMappingURL=database.d.ts.map
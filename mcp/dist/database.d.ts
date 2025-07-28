/**
 * Database service layer for PostgreSQL integration
 */
interface SchemaProperty {
    type: string;
    description: string;
    dependencies?: string[];
    execution_order?: number;
    created_by?: string;
    updated_by?: string;
    created_at?: Date;
    updated_at?: Date;
    id?: number;
    template_id?: number;
    fixed?: boolean;
}
type TaskStage = 'draft' | 'backlog' | 'doing' | 'review' | 'completed';
interface TaskData {
    id: number;
    title: string;
    summary: string;
    stage?: TaskStage;
    [key: string]: any;
}
declare class DatabaseService {
    private pool;
    constructor();
    initialize(): Promise<void>;
    getSchemaProperties(): Promise<Record<string, SchemaProperty>>;
    createTask(taskData: Omit<TaskData, 'id'>, userId?: string): Promise<number>;
    updateTask(taskId: number, updates: Partial<TaskData>, userId?: string): Promise<boolean>;
    getTask(taskId: number): Promise<TaskData | null>;
    getNextTaskId(): Promise<number>;
    listTasks(stageFilter?: string): Promise<TaskData[]>;
    getTemplates(): Promise<Array<{
        id: number;
        name: string;
        description: string;
        created_at: Date;
        updated_at: Date;
        created_by: string;
        updated_by: string;
    }>>;
    getTemplateProperties(templateId: number): Promise<Record<string, SchemaProperty>>;
    createProperty(templateId: number, propertyData: {
        key: string;
        type: string;
        description: string;
        dependencies?: string[];
        execution_order?: number;
        fixed?: boolean;
    }, userId?: string): Promise<number>;
    updateProperty(propertyId: number, updates: {
        key?: string;
        type?: string;
        description?: string;
        dependencies?: string[];
        execution_order?: number;
        fixed?: boolean;
    }, userId?: string): Promise<boolean>;
    deleteProperty(propertyId: number): Promise<boolean>;
    listProperties(templateId?: number): Promise<Array<SchemaProperty & {
        key: string;
    }>>;
    close(): Promise<void>;
}
export default DatabaseService;
//# sourceMappingURL=database.d.ts.map
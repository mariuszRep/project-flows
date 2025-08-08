export type TaskStage = 'draft' | 'backlog' | 'doing' | 'review' | 'completed';

export interface Task {
  id: number;
  title: string; // Mapped from Title block
  body?: string; // Mapped from Summary or Description block
  stage: TaskStage;
  project_id?: number;
  created_at: string;
  updated_at: string;
  created_by: string;
  updated_by: string;
  // JSON response properties
  parent_id?: number; // Alternative to project_id from JSON
  parent_name?: string; // Project name from JSON
  parent_type?: string; // Type of parent (project, task, etc.)
  type?: string; // Task type from JSON
  template_id?: number; // Template ID from JSON
  description?: string; // Alternative to body from JSON
  // New blocks structure - properties are nested in blocks object
  blocks?: {
    Title?: string;
    Summary?: string;
    Description?: string;
    Items?: string;
    Notes?: string;
    [key: string]: string | number | boolean | undefined; // for other dynamic properties
  };
  // Legacy properties for backward compatibility - these are now in blocks
  Title?: string;
  Summary?: string;
  Description?: string;
  Items?: string;
  Notes?: string;
  [key: string]: string | number | boolean | undefined; // for other dynamic properties
}

export interface CreateTaskRequest {
  title: string;
  body?: string;
  stage?: TaskStage;
  project_id?: number;
  createdBy?: string;
}

export interface UpdateTaskRequest {
  id: number;
  title?: string;
  body?: string;
  stage?: TaskStage;
  project_id?: number;
  updatedBy?: string;
}

export interface TaskListResponse {
  tasks: Task[];
}

export interface TaskResponse {
  task: Task;
}
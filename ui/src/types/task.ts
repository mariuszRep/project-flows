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
  // Dynamic properties from blocks system
  Title?: string;
  Summary?: string;
  Description?: string;
  [key: string]: any; // for other dynamic properties
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
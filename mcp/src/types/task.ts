export type TaskStage = 'draft' | 'backlog' | 'doing' | 'review' | 'completed';

export interface TaskData {
  id: number;
  stage?: TaskStage;
  [key: string]: any; // for dynamic properties
}
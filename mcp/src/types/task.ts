export type TaskStage = 'draft' | 'backlog' | 'doing' | 'review' | 'completed';

export interface TaskData {
  id: number;
  stage?: TaskStage;
  template_id?: number;
  parent_id?: number;
  [key: string]: any; // for dynamic properties
}
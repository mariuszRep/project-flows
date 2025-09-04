export type EpicStage = 'draft' | 'backlog' | 'doing' | 'review' | 'completed';

export interface EpicData {
  id: number;
  stage?: EpicStage;
  template_id?: number;
  parent_id?: number;
  [key: string]: any; // for dynamic properties
}
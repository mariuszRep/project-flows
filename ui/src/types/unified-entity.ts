import { TaskStage } from './task';

export interface RelatedEntry {
  id: number;
  object: 'task' | 'project' | 'epic' | 'rule';
}

export interface UnifiedEntity {
  id: number;
  title: string;
  summary: string;
  stage?: TaskStage;
  type: 'Task' | 'Project' | 'Epic' | 'Rule';
  template_id: number;
  parent_id?: number; // Legacy field, use related array instead
  related?: RelatedEntry[];
  dependencies?: any[];
  created_at?: string;
  updated_at?: string;
  created_by?: string;
  updated_by?: string;
  children?: UnifiedEntity[];
}

// Utility function to convert list_objects response to UnifiedEntity
export const mapToUnifiedEntity = (obj: any): UnifiedEntity => {
  return {
    id: Number(obj.id),
    title: obj.title || obj.Title || obj?.blocks?.Title || 'Untitled',
    summary: obj.description || obj.Description || obj?.blocks?.Description || obj?.blocks?.Summary || obj.summary || obj.Summary || '',
    stage: obj.stage as TaskStage,
    type: (obj.type === 'Epic' || obj.type === 'Project' || obj.type === 'Task' || obj.type === 'Rule')
      ? obj.type
      : (obj.type ? (obj.type.charAt(0).toUpperCase() + obj.type.slice(1)) : (
          obj.template_id === 4 ? 'Rule' :
          obj.template_id === 3 ? 'Epic' :
          obj.template_id === 2 ? 'Project' :
          'Task'
        )),
    template_id: obj.template_id ?? (
      obj.type === 'Rule' ? 4 :
      obj.type === 'Epic' ? 3 :
      obj.type === 'Project' ? 2 :
      1
    ),
    parent_id: obj.parent_id ?? obj.project_id, // Legacy field
    related: obj.related,
    dependencies: obj.dependencies,
    created_at: obj.created_at,
    updated_at: obj.updated_at,
    created_by: obj.created_by,
    updated_by: obj.updated_by,
  };
};
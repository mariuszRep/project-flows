export type EpicStage = 'draft' | 'backlog' | 'doing' | 'review' | 'completed';

export interface Epic {
  id: number;
  title: string; // Mapped from Title block
  body?: string; // Mapped from Summary or Description block
  stage: EpicStage;
  project_id?: number;
  created_at: string;
  updated_at: string;
  created_by: string;
  updated_by: string;
  // JSON response properties
  parent_id?: number; // Alternative to project_id from JSON - should point to Project
  parent_name?: string; // Project name from JSON
  parent_type?: string; // Type of parent (should be 'project')
  type?: string; // Epic type from JSON
  template_id: 3; // Always 3 for Epics
  description?: string; // Alternative to body from JSON
  // New blocks structure - properties are nested in blocks object
  blocks?: {
    Title?: string;
    Description?: string;
    Priority?: string;
    Tasks?: string;
    [key: string]: string | number | boolean | undefined; // for other dynamic properties
  };
  // Legacy properties for backward compatibility - these are now in blocks
  Title?: string;
  Description?: string;
  Priority?: string;
  Tasks?: string;
  [key: string]: string | number | boolean | undefined; // for other dynamic properties
}

export interface CreateEpicRequest {
  title: string;
  body?: string;
  stage?: EpicStage;
  project_id?: number;
  createdBy?: string;
  Priority?: string;
}

export interface UpdateEpicRequest {
  id: number;
  title?: string;
  body?: string;
  stage?: EpicStage;
  project_id?: number;
  updatedBy?: string;
  Priority?: string;
}

export interface EpicListResponse {
  epics: Epic[];
}

export interface EpicResponse {
  epic: Epic;
}
export interface Project {
  id: number;
  name: string;
  description?: string;
  color: string;
  created_at: string;
  updated_at: string;
  created_by: string;
  updated_by: string;
}

export interface CreateProjectRequest {
  name: string;
  description?: string;
  color?: string;
  createdBy?: string;
}

export interface UpdateProjectRequest {
  id: number;
  name?: string;
  description?: string;
  color?: string;
  updatedBy?: string;
}

export interface ProjectListResponse {
  projects: Project[];
}

export interface ProjectResponse {
  project: Project;
}
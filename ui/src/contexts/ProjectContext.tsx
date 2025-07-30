import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Project } from '@/types/project';
import { useMCP } from './MCPContext';

interface ProjectContextType {
  projects: Project[];
  selectedProjectId: number | null;
  isLoadingProjects: boolean;
  projectError: string | null;
  
  setSelectedProjectId: (projectId: number | null) => void;
  fetchProjects: () => Promise<void>;
  createProject: (projectData: { name: string; description?: string; color?: string }) => Promise<Project | null>;
  updateProject: (projectId: number, updates: { name?: string; description?: string; color?: string }) => Promise<boolean>;
  deleteProject: (projectId: number) => Promise<boolean>;
  
  // Helper functions
  getProjectById: (projectId: number) => Project | undefined;
  getSelectedProject: () => Project | undefined;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

interface ProjectProviderProps {
  children: ReactNode;
}

export function ProjectProvider({ children }: ProjectProviderProps) {
  const { callTool, isConnected, tools } = useMCP();
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [isLoadingProjects, setIsLoadingProjects] = useState(false);
  const [projectError, setProjectError] = useState<string | null>(null);

  // Fetch projects from MCP tools
  const fetchProjects = async () => {
    if (!isConnected || !callTool || tools.length === 0) {
      setProjects([]);
      return;
    }

    setIsLoadingProjects(true);
    setProjectError(null);
    
    try {
      const listProjectsTool = tools.find(tool => tool.name === 'list_projects');
      
      if (listProjectsTool) {
        const result = await callTool('list_projects', {});
        if (result && result.content && result.content[0]) {
          const contentText = result.content[0].text;
          
          // Parse the markdown table format
          const lines = contentText.split('\n').filter(line => line.trim());
          const projectRows = lines.slice(2); // Skip header and separator
          
          const parsedProjects = projectRows.map((row, index) => {
            const columns = row.split('|').map(col => col.trim()).filter(col => col);
            
            if (columns.length >= 4) { // ID, Name, Description, Color
              const id = parseInt(columns[0]) || index + 1;
              const name = columns[1] || 'Untitled Project';
              const description = columns[2] || '';
              const color = columns[3] || '#3b82f6';
              
              return {
                id,
                name,
                description,
                color,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                created_by: 'user@example.com',
                updated_by: 'user@example.com'
              };
            }
            return null;
          }).filter(project => project !== null);
          
          setProjects(parsedProjects);
        }
      }
    } catch (err) {
      console.error('Error fetching projects:', err);
      setProjectError(err instanceof Error ? err.message : 'Failed to fetch projects');
    } finally {
      setIsLoadingProjects(false);
    }
  };

  // Create a new project
  const createProject = async (projectData: { name: string; description?: string; color?: string }): Promise<Project | null> => {
    if (!isConnected || !callTool) {
      setProjectError('MCP not connected');
      return null;
    }

    try {
      const result = await callTool('create_project', {
        name: projectData.name,
        description: projectData.description,
        color: projectData.color || '#3b82f6'
      });

      if (result && result.content && result.content[0]) {
        // Refresh projects list to get the new project
        await fetchProjects();
        
        // Return a mock project object
        return {
          id: Date.now(), // Temporary ID until we refresh
          name: projectData.name,
          description: projectData.description || '',
          color: projectData.color || '#3b82f6',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          created_by: 'user@example.com',
          updated_by: 'user@example.com'
        };
      }
    } catch (err) {
      console.error('Error creating project:', err);
      setProjectError(err instanceof Error ? err.message : 'Failed to create project');
    }
    
    return null;
  };

  // Update an existing project
  const updateProject = async (projectId: number, updates: { name?: string; description?: string; color?: string }): Promise<boolean> => {
    if (!isConnected || !callTool) {
      setProjectError('MCP not connected');
      return false;
    }

    try {
      const result = await callTool('update_project', {
        project_id: projectId,
        ...updates
      });

      if (result && result.content && result.content[0]) {
        // Refresh projects list to get updated data
        await fetchProjects();
        return true;
      }
    } catch (err) {
      console.error('Error updating project:', err);
      setProjectError(err instanceof Error ? err.message : 'Failed to update project');
    }
    
    return false;
  };

  // Delete a project
  const deleteProject = async (projectId: number): Promise<boolean> => {
    if (!isConnected || !callTool) {
      setProjectError('MCP not connected');
      return false;
    }

    try {
      const result = await callTool('delete_project', {
        project_id: projectId
      });

      if (result && result.content && result.content[0]) {
        // If the deleted project was selected, deselect it
        if (selectedProjectId === projectId) {
          setSelectedProjectId(null);
        }
        
        // Refresh projects list
        await fetchProjects();
        return true;
      }
    } catch (err) {
      console.error('Error deleting project:', err);
      setProjectError(err instanceof Error ? err.message : 'Failed to delete project');
    }
    
    return false;
  };

  // Helper functions
  const getProjectById = (projectId: number): Project | undefined => {
    return projects.find(p => p.id === projectId);
  };

  const getSelectedProject = (): Project | undefined => {
    return selectedProjectId ? getProjectById(selectedProjectId) : undefined;
  };

  // Auto-fetch projects when MCP connection changes
  useEffect(() => {
    if (isConnected && tools.length > 0) {
      fetchProjects();
    } else {
      setProjects([]);
      setSelectedProjectId(null);
    }
  }, [isConnected, tools]);

  // Persist selected project in localStorage
  useEffect(() => {
    if (selectedProjectId !== null) {
      localStorage.setItem('selectedProjectId', selectedProjectId.toString());
    } else {
      localStorage.removeItem('selectedProjectId');
    }
  }, [selectedProjectId]);

  // Load selected project from localStorage on mount
  useEffect(() => {
    const savedProjectId = localStorage.getItem('selectedProjectId');
    if (savedProjectId) {
      setSelectedProjectId(parseInt(savedProjectId));
    }
  }, []);

  const value: ProjectContextType = {
    projects,
    selectedProjectId,
    isLoadingProjects,
    projectError,
    
    setSelectedProjectId,
    fetchProjects,
    createProject,
    updateProject,
    deleteProject,
    
    getProjectById,
    getSelectedProject
  };

  return (
    <ProjectContext.Provider value={value}>
      {children}
    </ProjectContext.Provider>
  );
}

export function useProject(): ProjectContextType {
  const context = useContext(ProjectContext);
  if (context === undefined) {
    throw new Error('useProject must be used within a ProjectProvider');
  }
  return context;
}
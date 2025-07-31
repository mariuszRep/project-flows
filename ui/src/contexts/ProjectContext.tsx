import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Project } from '@/types/project';
import { useMCP } from './MCPContext';
import { projectStorageService } from '@/services/projectStorageService';

interface ProjectContextType {
  projects: Project[];
  selectedProjectId: number | null;
  isLoadingProjects: boolean;
  projectError: string | null;
  isOfflineMode: boolean;
  
  setSelectedProjectId: (projectId: number | null) => void;
  selectProject: (projectId: number | null) => Promise<boolean>;
  syncProjectSelectionFromMCP: () => Promise<void>;
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
  const [isOfflineMode, setIsOfflineMode] = useState(false);

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

  // Select a project using MCP tool (bidirectional sync)
  const selectProject = async (projectId: number | null): Promise<boolean> => {
    // Always update local state first for immediate UI feedback
    setSelectedProjectId(projectId);
    
    if (!isConnected || !callTool) {
      // In offline mode, just update local state
      setProjectError(null); // Clear any previous errors
      return false; // Return false to indicate MCP sync failed but local update succeeded
    }

    try {
      const result = await callTool('select_project', {
        project_id: projectId
      });

      if (result && result.content && result.content[0]) {
        // Clear any previous errors on success
        setProjectError(null);
        return true;
      } else {
        setProjectError('MCP tool returned invalid response');
        return false;
      }
    } catch (err) {
      console.error('Error selecting project via MCP:', err);
      
      // Set error but keep local state - don't revert
      const errorMessage = err instanceof Error ? err.message : 'Failed to select project';
      setProjectError(`MCP sync failed: ${errorMessage}. Selection saved locally.`);
      
      // Don't revert local state - keep the selection for offline use
      return false;
    }
  };

  // Sync project selection from MCP server
  const syncProjectSelectionFromMCP = async (): Promise<void> => {
    if (!isConnected || !callTool) {
      return;
    }

    try {
      const result = await callTool('get_selected_project', {});
      
      if (result && result.content && result.content[0]) {
        const contentText = result.content[0].text;
        
        // Parse the response to extract project ID
        if (contentText.includes('No project is currently selected')) {
          // Only update if different from current local state
          if (selectedProjectId !== null) {
            setSelectedProjectId(null);
          }
        } else {
          const match = contentText.match(/Currently selected project ID: (\d+)/);
          if (match) {
            const projectId = parseInt(match[1]);
            // Only update if different from current local state
            if (selectedProjectId !== projectId) {
              setSelectedProjectId(projectId);
            }
          }
        }
        
        // Clear any sync errors on successful sync
        if (projectError && projectError.includes('MCP sync failed')) {
          setProjectError(null);
        }
      }
    } catch (err) {
      console.error('Error syncing project selection from MCP:', err);
      
      // Only set error if this is a new error (not a repeated sync failure)
      if (!projectError || !projectError.includes('MCP sync failed')) {
        setProjectError('Failed to sync project selection from server. Using local state.');
      }
    }
  };

  // Helper functions
  const getProjectById = (projectId: number): Project | undefined => {
    return projects.find(p => p.id === projectId);
  };

  const getSelectedProject = (): Project | undefined => {
    return selectedProjectId ? getProjectById(selectedProjectId) : undefined;
  };

  // Auto-fetch projects and sync selection when MCP connection changes
  useEffect(() => {
    if (isConnected && tools.length > 0) {
      setIsOfflineMode(false);
      fetchProjects();
      syncProjectSelectionFromMCP();
    } else {
      setIsOfflineMode(true);
      setProjects([]);
      // Don't clear selection when going offline - preserve local state
    }
  }, [isConnected, tools]);

  // Persist selected project with cross-tab synchronization
  useEffect(() => {
    projectStorageService.setSelectedProjectId(selectedProjectId);
  }, [selectedProjectId]);

  // Load selected project from storage on mount and subscribe to changes
  useEffect(() => {
    // Load initial value
    const savedProjectId = projectStorageService.getSelectedProjectId();
    if (savedProjectId) {
      setSelectedProjectId(savedProjectId);
    }

    // Subscribe to cross-tab changes
    const unsubscribe = projectStorageService.subscribe('selectedProjectId', (newProjectId: number | null) => {
      // Only update if different from current state (avoid loops)
      if (newProjectId !== selectedProjectId) {
        setSelectedProjectId(newProjectId);
      }
    });

    // Cleanup subscription on unmount
    return unsubscribe;
  }, []);

  // Cleanup storage service on unmount
  useEffect(() => {
    return () => {
      projectStorageService.cleanup();
    };
  }, []);

  const value: ProjectContextType = {
    projects,
    selectedProjectId,
    isLoadingProjects,
    projectError,
    isOfflineMode,
    
    setSelectedProjectId,
    selectProject,
    syncProjectSelectionFromMCP,
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
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Plus, Folder, FolderOpen, Edit2 } from 'lucide-react';
import { Project } from '@/types/project';
import { useMCP } from '@/contexts/MCPContext';

interface ProjectSidebarProps {
  isCollapsed: boolean;
  selectedProjectId?: number | null;
  onProjectSelect: (projectId: number | null) => void;
  onCreateProject: () => void;
  onEditProject: (project: Project) => void;
  refreshTrigger?: number;
}

export function ProjectSidebar({ 
  isCollapsed, 
  selectedProjectId, 
  onProjectSelect, 
  onCreateProject,
  onEditProject,
  refreshTrigger 
}: ProjectSidebarProps) {
  const { callTool, isConnected, tools } = useMCP();
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Fetch projects from MCP tools
  const fetchProjects = async () => {
    if (!isConnected || !callTool || tools.length === 0) {
      setProjects([]);
      return;
    }

    setIsLoading(true);
    try {
      const listProjectsTool = tools.find(tool => tool.name === 'list_projects');
      
      if (listProjectsTool) {
        const result = await callTool('list_projects', {});
        if (result && result.content && result.content[0]) {
          const contentText = result.content[0].text;
          
          try {
            // Parse the JSON response
            const jsonResponse = JSON.parse(contentText);
            
            if (jsonResponse.tasks && Array.isArray(jsonResponse.tasks)) {
              const parsedProjects = jsonResponse.tasks.map((task: any) => ({
                id: task.id,
                name: task.title || 'Untitled Project',
                description: task.description || '',
                color: '#3b82f6', // Default color since projects are now stored as tasks
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                created_by: 'user@example.com',
                updated_by: 'user@example.com'
              }));
              
              setProjects(parsedProjects);
            } else {
              setProjects([]);
            }
          } catch (parseError) {
            console.error('Error parsing JSON response:', parseError);
            setProjects([]);
          }
        }
      }
    } catch (err) {
      console.error('Error fetching projects:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isConnected && tools.length > 0) {
      fetchProjects();
    } else {
      setProjects([]);
    }
  }, [isConnected, tools]);

  // Refresh projects when refreshTrigger changes
  useEffect(() => {
    if (refreshTrigger && isConnected && tools.length > 0) {
      fetchProjects();
    }
  }, [refreshTrigger, isConnected, tools]);

  const getProjectColor = (color: string) => {
    return `border-l border-l-[${color}]`;
  };

  const handleProjectClick = (projectId: number) => {
    if (selectedProjectId === projectId) {
      // If clicking the same project, deselect it (show all tasks)
      onProjectSelect(null);
    } else {
      onProjectSelect(projectId);
    }
  };

  const handleAllTasksClick = () => {
    onProjectSelect(null);
  };

  if (isCollapsed) {
    return (
      <div className="px-1 py-2 space-y-2">
        {/* Create Project Button */}
        <Button
          variant="ghost"
          size="icon"
          onClick={onCreateProject}
          className="w-9 h-9 rounded-full"
          title="Create Project"
        >
          <Plus className="h-4 w-4" />
        </Button>

        {/* All Tasks */}
        <Button
          variant={selectedProjectId === null ? 'secondary' : 'ghost'}
          size="icon"
          onClick={handleAllTasksClick}
          className="w-9 h-9 rounded-full"
          title="All Tasks"
        >
          <FolderOpen className="h-4 w-4" />
        </Button>

        {/* Project Icons */}
        {projects.map((project) => (
          <div key={project.id} className="relative group">
            <Button
              variant={selectedProjectId === project.id ? 'secondary' : 'ghost'}
              size="icon"
              onClick={() => handleProjectClick(project.id)}
              className="w-9 h-9 rounded-full"
              title={project.name}
              style={{ borderLeftColor: project.color }}
            >
              <Folder className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => {
                e.stopPropagation();
                onEditProject(project);
              }}
              className="absolute right-0 top-0 w-4 h-4 rounded-full opacity-0 group-hover:opacity-100 transition-opacity bg-background/90 border shadow-sm"
              title="Edit Project"
            >
              <Edit2 className="h-2 w-2" />
            </Button>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="px-3 py-2">
      {/* Create Project Button */}
      <div className="mb-4">
        <Button
          variant="outline"
          size="sm"
          onClick={onCreateProject}
          className="w-full justify-start"
          disabled={!isConnected}
        >
          <Plus className="h-4 w-4 mr-2" />
          Create Project
        </Button>
      </div>

      {/* Projects Header */}
      <div className="mb-3">
        <h3 className="text-sm font-medium text-muted-foreground px-2">Projects</h3>
      </div>

      {/* All Tasks Option */}
      <div className="mb-2">
        <Button
          variant="default"
          size="sm"
          onClick={handleAllTasksClick}
          className={`w-full justify-start ${selectedProjectId === null ? 'bg-border' : ''}`}
        >
          <FolderOpen className="h-4 w-4 mr-2" />
          All Tasks
        </Button>
      </div>

      {/* Projects List */}
      {isLoading ? (
        <div className="px-2 py-4 text-center">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto"></div>
          <p className="text-xs text-muted-foreground mt-2">Loading projects...</p>
        </div>
      ) : projects.length === 0 ? (
        <div className="px-2 py-4 text-center">
          <p className="text-xs text-muted-foreground">No projects yet</p>
        </div>
      ) : (
        <div className="space-y-1">
          {projects.map((project) => (
            <div key={project.id} className="relative group">
              <Button
                variant="default"
                size="sm"
                onClick={() => handleProjectClick(project.id)}
                className={`w-full justify-start pr-8 ${selectedProjectId === project.id ? 'bg-border' : ''}`}
              >
                <Folder className="h-4 w-4 mr-2 flex-shrink-0" />
                <span className="truncate flex-1 text-left">{project.name}</span>
              </Button>
              <Button
                variant="primary"
                size="icon"
                onClick={(e) => {
                  e.stopPropagation();
                  onEditProject(project);
                }}
                className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                title="Edit Project"
              >
                <Edit2 className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
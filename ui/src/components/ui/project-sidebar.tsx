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
}

export function ProjectSidebar({ 
  isCollapsed, 
  selectedProjectId, 
  onProjectSelect, 
  onCreateProject,
  onEditProject 
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

  const getProjectColor = (color: string) => {
    return `border-l-4` + ` border-[${color}]`;
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
          variant={selectedProjectId === null ? 'secondary' : 'outline'}
          size="sm"
          onClick={handleAllTasksClick}
          className="w-full justify-start"
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
                variant={selectedProjectId === project.id ? 'secondary' : 'outline'}
                size="sm"
                onClick={() => handleProjectClick(project.id)}
                className={`w-full justify-start ${getProjectColor(project.color)} pr-8`}
              >
                <Folder className="h-4 w-4 mr-2 flex-shrink-0" />
                <span className="truncate flex-1 text-left">{project.name}</span>
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => {
                  e.stopPropagation();
                  onEditProject(project);
                }}
                className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 rounded-md opacity-0 group-hover:opacity-100 transition-opacity hover:bg-background/80"
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
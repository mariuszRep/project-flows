import React, { useState, useEffect } from 'react';
import { HeaderAndSidebarLayout } from '@/components/layout/HeaderAndSidebarLayout';
import { useNavigate } from 'react-router-dom';
import { Task } from '@/types/task';
import { Project } from '@/types/project';
import { TaskBoard } from '@/components/board/TaskBoard';
import { Button } from '@/components/ui/button';
import TaskForm from '@/components/forms/TaskForm';
import ProjectForm from '@/components/forms/ProjectForm';
import { ProjectSidebar } from '@/components/ui/project-sidebar';
import { MCPDisconnectedState, NoTasksState } from '@/components/ui/empty-state';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';
import { Plus, X, Filter } from 'lucide-react';
import { useMCP } from '@/contexts/MCPContext';
import { useProject } from '@/contexts/ProjectContext';

export default function Board() {
  const navigate = useNavigate();
  const { callTool, isConnected, tools } = useMCP();
  const { 
    projects, 
    selectedProjectId, 
    setSelectedProjectId, 
    selectProject,
    fetchProjects, 
    createProject,
    getSelectedProject 
  } = useProject();
  
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAddTaskForm, setShowAddTaskForm] = useState(false);
  const [showCreateProjectForm, setShowCreateProjectForm] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<number | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<{
    isOpen: boolean;
    taskId: number | null;
    taskTitle: string;
  }>({
    isOpen: false,
    taskId: null,
    taskTitle: '',
  });

  // Fetch tasks from MCP tools
  const fetchTasks = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      // If not connected to MCP, clear tasks and return early
      if (!isConnected || !callTool || tools.length === 0) {
        console.log('MCP not connected, clearing tasks');
        setTasks([]);
        setIsLoading(false);
        return;
      }
      
      let allTasks: Task[] = [];
      
      console.log('Available tools:', tools.map(t => t.name));
      
      // Try to get all tasks using the list_tasks tool
      const listTasksTool = tools.find(tool => tool.name === 'list_tasks');
      
      if (listTasksTool) {
        try {
          // Build arguments for list_tasks, including project_id if a project is selected
          const listTasksArgs: any = {};
          if (selectedProjectId !== null) {
            listTasksArgs.project_id = selectedProjectId;
            console.log(`Calling list_tasks with project_id: ${selectedProjectId}`);
          } else {
            console.log('Calling list_tasks for all projects');
          }
          
          const result = await callTool('list_tasks', listTasksArgs);
          if (result && result.content && result.content[0]) {
            console.log('List tasks result:', result.content);
            
            const contentText = result.content[0].text;
            
            // Parse the markdown table format
            const lines = contentText.split('\n').filter(line => line.trim());
            const taskRows = lines.slice(2); // Skip header and separator
            
            const parsedTasks = taskRows.map((row, index) => {
              const columns = row.split('|').map(col => col.trim()).filter(col => col);
              
              if (columns.length >= 6) { // Now expecting 6 columns: ID, Title, Description, Stage, Project, Project ID
                const id = parseInt(columns[0]) || index + 1;
                const titleColumn = columns[1] || 'Untitled Task';
                const descriptionColumn = columns[2] || '';
                const stage = columns[3] || 'backlog';
                const projectName = columns[4]; // Project name for display (not used in filtering)
                const projectIdColumn = columns[5]; // Project ID for filtering
                const projectId = projectIdColumn === 'None' ? undefined : parseInt(projectIdColumn);
                
                return {
                  id,
                  title: titleColumn, // For backward compatibility
                  body: descriptionColumn, // For backward compatibility
                  stage: stage as 'draft' | 'backlog' | 'doing' | 'review' | 'completed',
                  project_id: projectId,
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                  created_by: 'user@example.com',
                  updated_by: 'user@example.com',
                  // Store original block-based properties
                  Title: titleColumn,
                  Description: descriptionColumn
                };
              }
              return null;
            }).filter(task => task !== null);
            
            allTasks = parsedTasks;
          }
        } catch (err) {
          console.warn('Failed to get tasks with list_tasks:', err);
        }
      }
      
      // Remove duplicates based on id
      const uniqueTasks = allTasks.filter((task, index, self) => 
        index === self.findIndex(t => t.id === task.id)
      );
      
      // No need for client-side project filtering since we pass project_id to list_tasks
      console.log(`Found ${uniqueTasks.length} tasks for selected project: ${selectedProjectId}`);
      setTasks(uniqueTasks);
      
    } catch (err) {
      console.error('Error fetching tasks:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch tasks');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!isConnected) {
      // Clear tasks when disconnected
      setTasks([]);
      setIsLoading(false);
    } else {
      // Fetch tasks when connected or when selected project changes
      fetchTasks();
    }
  }, [isConnected, tools, selectedProjectId]);

  const handleTaskUpdate = async (taskId?: number, newStage?: string) => {
    if (!isConnected || !callTool) {
      console.log('MCP not connected, skipping task update');
      return;
    }

    try {
      const updateTool = tools.find(tool => 
        tool.name === 'update_task' || 
        tool.name === 'modify_task' ||
        tool.name === 'edit_task'
      );
      
      if (updateTool && taskId && newStage) {
        await callTool(updateTool.name, {
          task_id: taskId,
          stage: newStage
        });
        console.log(`Task ${taskId} updated to ${newStage}`);
      } else {
        console.log('Update tool not available or missing parameters');
      }
      
      // Refresh tasks after update
      await fetchTasks();
    } catch (err) {
      console.error('Error updating task:', err);
      setError(err instanceof Error ? err.message : 'Failed to update task');
    }
  };

  const handleTaskDelete = (taskId: number, taskTitle: string) => {
    setDeleteDialog({
      isOpen: true,
      taskId,
      taskTitle,
    });
  };

  const confirmTaskDelete = async () => {
    if (!isConnected || !callTool || !deleteDialog.taskId) {
      console.log('MCP not connected or no task ID, skipping delete');
      setDeleteDialog({ isOpen: false, taskId: null, taskTitle: '' });
      return;
    }

    try {
      const deleteTool = tools.find(tool => tool.name === 'delete_task');
      
      if (deleteTool) {
        const result = await callTool('delete_task', {
          task_id: deleteDialog.taskId
        });
        
        console.log('Delete result:', result);
        
        // Remove task from local state immediately for better UX
        setTasks(prevTasks => prevTasks.filter(task => task.id !== deleteDialog.taskId));
        
        // Refresh tasks from server to ensure consistency
        await fetchTasks();
      } else {
        console.log('Delete tool not available');
        setError('Delete functionality is not available');
      }
    } catch (err) {
      console.error('Error deleting task:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete task');
      // Refresh tasks in case of error to restore correct state
      await fetchTasks();
    } finally {
      setDeleteDialog({ isOpen: false, taskId: null, taskTitle: '' });
    }
  };

  const cancelTaskDelete = () => {
    setDeleteDialog({ isOpen: false, taskId: null, taskTitle: '' });
  };

  const handleSettingsClick = () => {
    navigate('/settings');
  };

  const handleTaskSuccess = async (task: Task) => {
    console.log('Task created/updated successfully:', task);
    setShowAddTaskForm(false);
    setEditingTaskId(null);
    setError(null);
    // Refresh tasks after successful creation/update
    await fetchTasks();
  };

  const handleTaskCancel = () => {
    setShowAddTaskForm(false);
    setEditingTaskId(null);
    setError(null);
  };

  const handleCreateProject = () => {
    setShowCreateProjectForm(true);
  };

  const handleProjectSuccess = async (project: Project) => {
    console.log('Project created successfully:', project);
    setShowCreateProjectForm(false);
    setError(null);
    // Refresh projects
    await fetchProjects();
  };

  const handleProjectCancel = () => {
    setShowCreateProjectForm(false);
    setError(null);
  };

  const handleProjectSelect = async (projectId: number | null) => {
    try {
      // Use the MCP selectProject method to sync globally
      await selectProject(projectId);
    } catch (err) {
      console.error('Error selecting project:', err);
      // Fallback to local state if MCP fails
      setSelectedProjectId(projectId);
    }
  };

  const selectedProject = getSelectedProject();

  return (
    <HeaderAndSidebarLayout
      onSettingsClick={handleSettingsClick}
      sidebarContent={
        <ProjectSidebar
          selectedProjectId={selectedProjectId}
          onProjectSelect={handleProjectSelect}
          onCreateProject={handleCreateProject}
          isCollapsed={false} // This will be injected by the layout
        />
      }
    >
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              {selectedProject ? `${selectedProject.name} - Tasks` : 'Task Board'}
            </h1>
            <p className="text-sm text-muted-foreground">
              {selectedProject 
                ? `Managing tasks for ${selectedProject.name} project` 
                : 'Manage your tasks with drag-and-drop kanban boards'
              }
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate('/task-list')}>
              <Filter className="h-4 w-4 mr-2" />
              Task Manager
            </Button>
            <Button onClick={() => setShowAddTaskForm(true)} disabled={!isConnected}>
              <Plus className="h-4 w-4 mr-2" />
              Create Task
            </Button>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-4">
            <p className="text-red-800 text-sm">{error}</p>
          </div>
        )}

        <TaskForm
          mode={editingTaskId ? 'edit' : 'create'}
          taskId={editingTaskId || undefined}
          templateId={1}
          initialStage="draft"
          onSuccess={handleTaskSuccess}
          onCancel={handleTaskCancel}
          onDelete={handleTaskDelete}
          isOpen={showAddTaskForm || !!editingTaskId}
        />

        <ProjectForm
          mode="create"
          onSuccess={handleProjectSuccess}
          onClose={handleProjectCancel}
          isOpen={showCreateProjectForm}
        />

        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">Loading tasks...</p>
            </div>
          </div>
        ) : !isConnected ? (
          <MCPDisconnectedState />
        ) : tasks.length === 0 ? (
          <NoTasksState />
        ) : (
          <TaskBoard
            tasks={tasks}
            setTasks={setTasks}
            onTaskUpdate={handleTaskUpdate}
            onTaskDelete={handleTaskDelete}
            onTaskEdit={(taskId) => setEditingTaskId(taskId)}
            projects={projects}
          />
        )}

        <ConfirmationDialog
          isOpen={deleteDialog.isOpen}
          onClose={cancelTaskDelete}
          onConfirm={confirmTaskDelete}
          title="Delete Task"
          description={`Are you sure you want to delete "${deleteDialog.taskTitle}"? This action cannot be undone.`}
          confirmText="Delete"
          cancelText="Cancel"
          variant="destructive"
        />
      </div>
    </HeaderAndSidebarLayout>
  );
}
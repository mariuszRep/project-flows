import React, { useState, useEffect } from 'react';
import { HeaderAndSidebarLayout } from '@/components/layout/HeaderAndSidebarLayout';
import { useNavigate } from 'react-router-dom';
import { Task } from '@/types/task';
import { Project } from '@/types/project';
import { TaskBoard } from '@/components/board/TaskBoard';
import { Button } from '@/components/ui/button';
import UnifiedForm from '@/components/forms/UnifiedForm';
import TaskView from '@/components/view/TaskView';
import ProjectView from '@/components/view/ProjectView';
// import ProjectEditForm from '@/components/forms/ProjectEditForm'; // Replaced by UnifiedForm
import { ProjectSidebar } from '@/components/ui/project-sidebar';
import { MCPDisconnectedState, NoTasksState } from '@/components/ui/empty-state';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';
import { Plus, X, Filter } from 'lucide-react';
import { useMCP } from '@/contexts/MCPContext';
import { useProject } from '@/contexts/ProjectContext';
import { useChangeEvents } from '@/hooks/useChangeEvents';

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
  const [editingProjectId, setEditingProjectId] = useState<number | null>(null);
  const [editingTaskId, setEditingTaskId] = useState<number | null>(null);
  const [sidebarRefreshTrigger, setSidebarRefreshTrigger] = useState(0);
  const [viewingTaskId, setViewingTaskId] = useState<number | null>(null);
  const [viewingProjectId, setViewingProjectId] = useState<number | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<{
    isOpen: boolean;
    taskId: number | null;
    taskTitle: string;
  }>({
    isOpen: false,
    taskId: null,
    taskTitle: '',
  });

  const suppressNextRefreshRef = React.useRef(false);

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
      
      // First try to get all objects using list_objects to ensure we get tasks connected to EPICs
      const listObjectsTool = tools.find(tool => tool.name === 'list_objects');
      
      if (listObjectsTool) {
        try {
          // Get all objects, then filter as needed
          console.log('Calling list_objects to get all objects including tasks under EPICs');
          const result = await callTool('list_objects', {});
          
          if (result && result.content && result.content[0]) {
            const contentText = result.content[0].text;
            
            if (contentText.trim().startsWith('{') || contentText.trim().startsWith('[')) {
              try {
                const jsonResponse = JSON.parse(contentText);
                
                // Handle response format with { objects: [...], count: number }
                let objectsArray;
                if (jsonResponse.objects && Array.isArray(jsonResponse.objects)) {
                  objectsArray = jsonResponse.objects;
                } else if (Array.isArray(jsonResponse)) {
                  objectsArray = jsonResponse;
                } else {
                  console.warn('Unexpected JSON response format:', jsonResponse);
                  objectsArray = [];
                }

                // Filter to only include tasks (template_id = 1)
                const taskObjects = objectsArray.filter((obj: any) => obj.template_id === 1);
                
                // If a project is selected, include tasks directly under the project
                // AND tasks under any EPICs that are under the project
                let relevantTasks;
                if (selectedProjectId !== null) {
                  // First, find all EPICs under this project
                  const projectEpics = objectsArray.filter((obj: any) => 
                    obj.template_id === 3 && obj.parent_id === selectedProjectId
                  );
                  
                  const epicIds = projectEpics.map((epic: any) => epic.id);
                  
                  // Include tasks directly under the project and tasks under any of the project's EPICs
                  relevantTasks = taskObjects.filter((task: any) => 
                    task.parent_id === selectedProjectId || 
                    epicIds.includes(task.parent_id)
                  );
                } else {
                  // No project selected, include all tasks
                  relevantTasks = taskObjects;
                }

                const parsedTasks = relevantTasks.map((taskData: any) => ({
                  id: taskData.id,
                  title: taskData.title || 'Untitled Task',
                  body: taskData.description || '',
                  stage: taskData.stage as 'draft' | 'backlog' | 'doing' | 'review' | 'completed',
                  project_id: taskData.parent_id,
                  created_at: taskData.created_at || null,
                  updated_at: taskData.updated_at || null,
                  created_by: taskData.created_by || 'user@example.com',
                  updated_by: taskData.updated_by || 'user@example.com',
                  // Store original block-based properties for compatibility
                  Title: taskData.title,
                  Description: taskData.description
                }));
                
                allTasks = parsedTasks;
                console.log(`Found ${allTasks.length} tasks using list_objects`);
              } catch (e) {
                console.error('Error parsing JSON response from list_objects:', e);
              }
            }
          }
        } catch (err) {
          console.warn('Failed to get tasks with list_objects:', err);
        }
      }
      
      // Note: Legacy list_tasks fallback has been removed - we only use list_objects now
      
      // Remove duplicates based on id
      const uniqueTasks = allTasks.filter((task, index, self) => 
        index === self.findIndex(t => t.id === task.id)
      );
      
      // Client-side filtering is done after fetching all objects from list_objects
      console.log(`Found ${uniqueTasks.length} tasks for selected project: ${selectedProjectId}`);
      setTasks(uniqueTasks);
      
    } catch (err) {
      console.error('Error fetching tasks:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch tasks');
    } finally {
      setIsLoading(false);
    }
  };

  // Set up change event listeners for real-time updates
  const { callToolWithEvent } = useChangeEvents({
    onTaskChanged: () => {
      if (suppressNextRefreshRef.current) {
        suppressNextRefreshRef.current = false;
        return;
      }
      console.log('Task changed event received, refreshing tasks');
      fetchTasks();
    },
    onProjectChanged: () => {
      if (suppressNextRefreshRef.current) {
        suppressNextRefreshRef.current = false;
        return;
      }
      console.log('Project changed event received, refreshing tasks');
      fetchTasks();
    }
  });

  // Initial fetch when component mounts or dependencies change
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
    if (!isConnected || !callToolWithEvent) {
      console.log('MCP not connected, skipping task update');
      return;
    }

    try {
      const updateTool = tools.find(tool => 
        tool.name === 'update_object' || 
        tool.name === 'modify_task' ||
        tool.name === 'edit_task'
      );
      
      if (updateTool && taskId && newStage) {
        // Suppress the refresh from the event
        suppressNextRefreshRef.current = true;
        // Use callToolWithEvent to trigger events after successful update
        await callToolWithEvent(updateTool.name, {
          object_id: taskId,
          template_id: 1,
          stage: newStage
        });
        console.log(`Task ${taskId} updated to ${newStage}`);
      } else {
        console.log('Update tool not available or missing parameters');
      }
      
      // No need to manually refresh - the event system will handle it
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
    if (!isConnected || !callToolWithEvent || !deleteDialog.taskId) {
      console.log('MCP not connected or no task ID, skipping delete');
      setDeleteDialog({ isOpen: false, taskId: null, taskTitle: '' });
      return;
    }

    try {
      const deleteObjectTool = tools.find(tool => tool.name === 'delete_object') 
        || tools.find(tool => tool.name.endsWith('delete_object') || tool.name.includes('delete_object'));
      const deleteTaskTool = tools.find(tool => tool.name === 'delete_task')
        || tools.find(tool => tool.name.endsWith('delete_task') || tool.name.includes('delete_task'));
      
      if (deleteObjectTool) {
        // Preferred: generic delete by object id
        const result = await callToolWithEvent(deleteObjectTool.name, {
          object_id: deleteDialog.taskId,
          template_id: 1 // Task template
        });
        console.log('Delete result (delete_object):', result);

        // Remove task from local state immediately for better UX
        setTasks(prevTasks => prevTasks.filter(task => task.id !== deleteDialog.taskId));

        // Close any open viewers for this task
        if (viewingTaskId === deleteDialog.taskId) {
          setViewingTaskId(null);
        }
      } else if (deleteTaskTool) {
        // Fallback to legacy task-specific delete
        const result = await callToolWithEvent(deleteTaskTool.name, {
          task_id: deleteDialog.taskId
        });
        
        console.log('Delete result (delete_task):', result);
        
        // Remove task from local state immediately for better UX
        setTasks(prevTasks => prevTasks.filter(task => task.id !== deleteDialog.taskId));

        // Close any open viewers for this task
        if (viewingTaskId === deleteDialog.taskId) {
          setViewingTaskId(null);
        }
        
        // No need to manually refresh - the event system will handle it
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

  const handleTaskEdit = (taskId: number) => {
    console.log('Edit task:', taskId);
    setEditingTaskId(taskId);
  };
  
  const handleTaskView = (taskId: number) => {
    console.log('View task:', taskId);
    setViewingTaskId(taskId);
  };
  
  const handleSwitchToEdit = () => {
    if (viewingTaskId) {
      setEditingTaskId(viewingTaskId);
      setViewingTaskId(null);
    }
  };

  const handleTaskSuccess = async (task: Task) => {
    console.log('Task created/updated successfully:', task);
    setShowAddTaskForm(false);
    setEditingTaskId(null);
    // No need to manually refresh - the event system will handle it
  };

  const handleProjectSuccess = async (project: Project) => {
    console.log('Project created/updated successfully:', project);
    setShowCreateProjectForm(false);
    setEditingProjectId(null);
    setError(null);
    // Trigger sidebar refresh
    setSidebarRefreshTrigger(prev => prev + 1);
    // No need to manually refresh - the event system will handle it
  };

  const handleProjectCancel = () => {
    setShowCreateProjectForm(false);
    setEditingProjectId(null);
    setError(null);
  };

  const handleEditProject = (project: Project) => {
    // First show the project view instead of directly editing
    setViewingProjectId(project.id);
  };
  
  const handleSwitchToProjectEdit = () => {
    if (viewingProjectId) {
      setEditingProjectId(viewingProjectId);
      setViewingProjectId(null);
    }
  };

  const handleProjectDelete = async (projectId: number, projectTitle: string) => {
    if (!isConnected || !callToolWithEvent) {
      console.log('MCP not connected, skipping project delete');
      return;
    }

    try {
      const deleteObjectTool = tools.find(tool => tool.name === 'delete_object') 
        || tools.find(tool => tool.name.endsWith('delete_object') || tool.name.includes('delete_object'));
      if (deleteObjectTool) {
        const result = await callToolWithEvent(deleteObjectTool.name, {
          object_id: projectId,
          template_id: 2 // Project template
        });
        
        console.log('Project delete result (delete_object):', result);
        
        // Close the edit form
        setEditingProjectId(null);
        setShowCreateProjectForm(false);
        
        // If the deleted project was selected, deselect it
        if (selectedProjectId === projectId) {
          await handleProjectSelect(null);
        }
        
        // Trigger sidebar refresh
        setSidebarRefreshTrigger(prev => prev + 1);
        
        // No need to manually refresh - the event system will handle it
      } else {
        console.log('Delete tool not available');
        setError('Delete functionality is not available');
      }
    } catch (err) {
      console.error('Error deleting project:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete project');
    }
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
          onCreateProject={() => setShowCreateProjectForm(true)}
          onEditProject={handleEditProject}
          refreshTrigger={sidebarRefreshTrigger}
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

        <UnifiedForm
          entityType="task"
          mode={editingTaskId ? 'edit' : 'create'}
          entityId={editingTaskId || undefined}
          templateId={1}
          initialStage="draft"
          onSuccess={handleTaskSuccess}
          onCancel={() => {
            setShowAddTaskForm(false);
            setEditingTaskId(null);
            setError(null);
          }}
          onDelete={handleTaskDelete}
          isOpen={showAddTaskForm || !!editingTaskId}
        />
        
        <TaskView
          taskId={viewingTaskId || 0}
          isOpen={!!viewingTaskId}
          onClose={() => setViewingTaskId(null)}
          onEdit={handleSwitchToEdit}
          onTaskUpdate={handleTaskUpdate}
          onDelete={handleTaskDelete}
        />
        
        <ProjectView
          projectId={viewingProjectId || 0}
          isOpen={!!viewingProjectId}
          onClose={() => setViewingProjectId(null)}
          onEdit={handleSwitchToProjectEdit}
        />

        <UnifiedForm
          entityType="project"
          mode={editingProjectId ? 'edit' : 'create'}
          entityId={editingProjectId || undefined}
          onSuccess={handleProjectSuccess}
          onCancel={handleProjectCancel}
          onDelete={handleProjectDelete}
          isOpen={showCreateProjectForm || !!editingProjectId}
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
            onTaskEdit={handleTaskView}
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

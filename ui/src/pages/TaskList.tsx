import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { HeaderAndSidebarLayout } from '@/components/layout/HeaderAndSidebarLayout';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { SlidableTaskCard } from '@/components/ui/slidable-task-card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { useMCP } from '@/contexts/MCPContext';
import { useProject } from '@/contexts/ProjectContext';
import { Task, TaskStage } from '@/types/task';
import { Project } from '@/types/project';
import { useChangeEvents } from '@/hooks/useChangeEvents';
import { MCPDisconnectedState } from '@/components/ui/empty-state';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';
import { ProjectSidebar } from '@/components/ui/project-sidebar';
// import ProjectEditForm from '@/components/forms/ProjectEditForm'; // Replaced by UnifiedForm
import { FileText, Plus, Edit, ArrowRight, Filter } from 'lucide-react';
import UnifiedForm from '@/components/forms/UnifiedForm';
import TaskView from '@/components/view/TaskView';
import ProjectView from '@/components/view/ProjectView';

const DraftTasks = () => {
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
  
  const [allTasks, setAllTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCreateProjectForm, setShowCreateProjectForm] = useState(false);
  const [editingProjectId, setEditingProjectId] = useState<number | null>(null);
  const [showAddTaskForm, setShowAddTaskForm] = useState(false);
  const [sidebarRefreshTrigger, setSidebarRefreshTrigger] = useState(0);
  
  // Filter state - default to all stages selected
  const [selectedStages, setSelectedStages] = useState<TaskStage[]>(['draft', 'backlog', 'doing', 'review', 'completed']);
  
  // Edit task state
  const [editingTaskId, setEditingTaskId] = useState<number | null>(null);
  const [viewingTaskId, setViewingTaskId] = useState<number | null>(null);
  
  // Project view state
  const [viewingProjectId, setViewingProjectId] = useState<number | null>(null);
  
  // Delete task state
  const [deleteDialog, setDeleteDialog] = useState<{
    isOpen: boolean;
    taskId: number | null;
    taskTitle: string;
  }>({
    isOpen: false,
    taskId: null,
    taskTitle: '',
  });
  
  const stages: { key: TaskStage; title: string; color: string }[] = [
    { key: 'draft', title: 'Draft', color: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200' },
    { key: 'backlog', title: 'Backlog', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' },
    { key: 'doing', title: 'Doing', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' },
    { key: 'review', title: 'Review', color: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200' },
    { key: 'completed', title: 'Completed', color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' }
  ];

  // Get filtered tasks based on selected stages (project filtering handled by server)
  const filteredTasks = allTasks.filter(task => {
    const stageMatch = selectedStages.includes(task.stage);
    return stageMatch;
  });

  // Fetch all tasks from MCP
  const fetchAllTasks = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      if (isConnected && callTool && tools.length > 0) {
        const listTasksTool = tools.find(tool => tool.name === 'list_tasks');
        
        if (listTasksTool) {
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
            const contentText = result.content[0].text;
            
            // Check if response is JSON (object or array)
            if (contentText.trim().startsWith('{') || contentText.trim().startsWith('[')) {
              try {
                const jsonResponse = JSON.parse(contentText);
                
                // Handle new JSON response format with { tasks: [...], count: number }
                let tasksArray;
                if (jsonResponse.tasks && Array.isArray(jsonResponse.tasks)) {
                  tasksArray = jsonResponse.tasks;
                } else if (Array.isArray(jsonResponse)) {
                  // Handle simple array format as fallback
                  tasksArray = jsonResponse;
                } else {
                  console.warn('Unexpected JSON response format:', jsonResponse);
                  setAllTasks([]);
                  return;
                }

                const parsedTasks = tasksArray.map((taskData: any) => ({
                  id: taskData.id,
                  title: taskData.title || taskData.Title || 'Untitled Task',
                  body: taskData.description || taskData.Description || taskData.Summary || '',
                  stage: taskData.stage as TaskStage,
                  project_id: taskData.parent_id || taskData.project_id,
                  created_at: taskData.created_at || new Date().toISOString(),
                  updated_at: taskData.updated_at || new Date().toISOString(),
                  created_by: taskData.created_by || 'user@example.com',
                  updated_by: taskData.updated_by || 'user@example.com'
                }));
                setAllTasks(parsedTasks);
              } catch (e) {
                console.error('Error parsing JSON response:', e);
                setError('Error parsing task list response');
                setAllTasks([]);
              }
            } else if (contentText.includes('No tasks found')) {
              setAllTasks([]);
            } else {
              // Fallback to markdown table parsing for compatibility
              const lines = contentText.split('\n').filter(line => line.trim());
              const taskRows = lines.slice(2); // Skip header and separator
              
              const parsedTasks = taskRows.map((row, index) => {
                const columns = row.split('|').map(col => col.trim());
                // Don't filter out empty columns - keep them to maintain column positions
                
                if (columns.length >= 7) { // Need at least 7 elements: ['', id, title, summary, stage, project_name, project_id, '']
                  const id = parseInt(columns[1]) || index + 1; // Skip first empty element
                  const title = columns[2] || 'Untitled Task';
                  const summary = columns[3] || '';
                  const stage = columns[4] || 'draft';
                  const projectName = columns[5]; // Project name for display
                  const projectIdColumn = columns[6]; // Project ID for filtering
                  const projectId = projectIdColumn === 'None' ? undefined : parseInt(projectIdColumn);
                  
                  return {
                    id,
                    title,
                    body: summary,
                    stage: stage as TaskStage,
                    project_id: projectId,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                    created_by: 'user@example.com',
                    updated_by: 'user@example.com'
                  };
                }
                return null;
              }).filter(task => task !== null);
              
              setAllTasks(parsedTasks);
            }
          }
        }
      }
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
      console.log('Task changed event received, refreshing tasks');
      fetchAllTasks();
    },
    onProjectChanged: () => {
      console.log('Project changed event received, refreshing tasks');
      fetchAllTasks();
    }
  });

  // Initial fetch when component mounts or dependencies change
  useEffect(() => {
    fetchAllTasks();
  }, [isConnected, tools, selectedProjectId]);

  const handleStageToggle = (stage: TaskStage, ctrlKey: boolean = false) => {
    setSelectedStages(prev => {
      if (ctrlKey) {
        // Multi-select mode with Ctrl key
        if (prev.includes(stage)) {
          // Remove stage if already selected (but keep at least one selected)
          return prev.length > 1 ? prev.filter(s => s !== stage) : prev;
        } else {
          // Add stage if not selected
          return [...prev, stage];
        }
      } else {
        // Single select mode - replace selection with clicked stage
        return [stage];
      }
    });
  };


  const handleClearAll = () => {
    setSelectedStages(['draft', 'backlog', 'doing', 'review', 'completed']); // Reset to all stages
  };

  const handleEditTask = (taskId: number) => {
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
  
  const handleEditSuccess = async (task: Task) => {
    console.log('Task updated successfully:', task);
    setEditingTaskId(null);
    setError(null);
    // Refresh tasks after successful update
    await fetchAllTasks();
  };
  
  const handleEditCancel = () => {
    setEditingTaskId(null);
    setError(null);
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
      const deleteTool = tools.find(tool => tool.name === 'delete_task');
      
      if (deleteTool) {
        // Use callToolWithEvent to trigger events after successful deletion
        const result = await callToolWithEvent('delete_task', {
          task_id: deleteDialog.taskId
        });
        
        console.log('Delete result:', result);
        
        // Remove task from local state immediately for better UX
        setAllTasks(prevTasks => prevTasks.filter(task => task.id !== deleteDialog.taskId));
        
        // Close edit form if the deleted task was being edited
        if (editingTaskId === deleteDialog.taskId) {
          setEditingTaskId(null);
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
      await fetchAllTasks();
    } finally {
      setDeleteDialog({ isOpen: false, taskId: null, taskTitle: '' });
    }
  };

  const cancelTaskDelete = () => {
    setDeleteDialog({ isOpen: false, taskId: null, taskTitle: '' });
  };

  const handleMoveTask = async (taskId: number, newStage: TaskStage) => {
    try {
      const updateTaskTool = tools.find(tool => tool.name === 'update_task');
      if (updateTaskTool && isConnected && callToolWithEvent) {
        // Use callToolWithEvent to trigger events after successful update
        await callToolWithEvent('update_task', { task_id: taskId, stage: newStage });
        // No need to manually refresh - the event system will handle it
      }
    } catch (err) {
      console.error('Error moving task:', err);
      setError(err instanceof Error ? err.message : 'Failed to move task');
    }
  };

  const getNextStage = (currentStage: TaskStage): TaskStage => {
    const stageOrder: TaskStage[] = ['draft', 'backlog', 'doing', 'review', 'completed'];
    const currentIndex = stageOrder.indexOf(currentStage);
    return currentIndex < stageOrder.length - 1 ? stageOrder[currentIndex + 1] : currentStage;
  };

  const getPreviousStage = (currentStage: TaskStage): TaskStage => {
    const stageOrder: TaskStage[] = ['draft', 'backlog', 'doing', 'review', 'completed'];
    const currentIndex = stageOrder.indexOf(currentStage);
    return currentIndex > 0 ? stageOrder[currentIndex - 1] : currentStage;
  };

  const getStageColor = (stage: TaskStage) => {
    return stages.find(s => s.key === stage)?.color || 'bg-gray-100 text-gray-800';
  };

  const EmptyTasksState = () => (
    <div className="text-center py-12">
      <FileText className="mx-auto h-16 w-16 text-muted-foreground mb-4" />
      <h3 className="text-lg font-semibold text-foreground mb-2">
        No Tasks Found
      </h3>
      <p className="text-muted-foreground mb-6 max-w-md mx-auto">
        {selectedStages.length === 1 
          ? `You don't have any tasks in ${stages.find(s => s.key === selectedStages[0])?.title.toLowerCase()} stage.`
          : `You don't have any tasks in the selected stages.`
        }
      </p>
      <div className="flex gap-3 justify-center">
        <Button onClick={() => navigate('/task-board')}>
          <Plus className="h-4 w-4 mr-2" />
          Create Task
        </Button>
        <Button variant="outline" onClick={() => navigate('/task-board')}>
          View Board
        </Button>
      </div>
    </div>
  );

  const handleSettingsClick = () => {
    navigate('/settings');
  };

  const handleCreateProject = () => {
    setShowCreateProjectForm(true);
  };

  const handleProjectSuccess = async (project: Project) => {
    console.log('Project created/updated successfully:', project);
    setShowCreateProjectForm(false);
    setEditingProjectId(null);
    setError(null);
    await fetchProjects();
    // Trigger sidebar refresh
    setSidebarRefreshTrigger(prev => prev + 1);
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
      const deleteTool = tools.find(tool => tool.name === 'delete_task');
      
      if (deleteTool) {
        // Use callToolWithEvent to trigger events after successful deletion
        const result = await callToolWithEvent('delete_task', {
          task_id: projectId
        });
        
        console.log('Project delete result:', result);
        
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

  const handleTaskSuccess = async (task: Task) => {
    console.log('Task created successfully:', task);
    setShowAddTaskForm(false);
    setError(null);
    // Refresh tasks
    await fetchAllTasks();
  };

  const handleTaskCancel = () => {
    setShowAddTaskForm(false);
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
      fullWidth={true}
      sidebarContent={
        <ProjectSidebar
          selectedProjectId={selectedProjectId}
          onProjectSelect={handleProjectSelect}
          onCreateProject={handleCreateProject}
          onEditProject={handleEditProject}
          refreshTrigger={sidebarRefreshTrigger}
          isCollapsed={false} // This will be injected by the layout
        />
      }
    >
      <div className="w-full px-[10%] space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              {selectedProject ? `${selectedProject.name} - Task Manager` : 'Task Manager'}
            </h1>
            <p className="text-sm text-muted-foreground">
              {selectedProject 
                ? `Filter and manage tasks for ${selectedProject.name} project` 
                : 'Filter and manage your tasks by stage'
              }
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate('/task-board')}>
              <ArrowRight className="h-4 w-4 mr-2" />
              View Board
            </Button>
            <Button onClick={() => setShowAddTaskForm(true)} disabled={!isConnected}>
              <Plus className="h-4 w-4 mr-2" />
              Create Task
            </Button>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="w-full bg-surface border border-border rounded-lg py-2 px-3">
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium text-sm">Filter by Stage</span>
              </div>
              <div className="flex items-center gap-2">
                {stages.map((stage) => {
                  const isSelected = selectedStages.includes(stage.key);
                  const getBorderColor = () => {
                    if (stage.key === 'draft') return 'border-gray-400 dark:border-gray-500';
                    if (stage.key === 'backlog') return 'border-blue-400 dark:border-blue-400';
                    if (stage.key === 'doing') return 'border-yellow-400 dark:border-yellow-400';
                    if (stage.key === 'review') return 'border-purple-400 dark:border-purple-400';
                    if (stage.key === 'completed') return 'border-green-400 dark:border-green-400';
                    return 'border-gray-400';
                  };
                  
                  return (
                    <button
                      key={stage.key}
                      onClick={(e) => handleStageToggle(stage.key, e.ctrlKey || e.metaKey)}
                      className="transition-all duration-200 cursor-pointer"
                    >
                      <Badge 
                        variant="secondary" 
                        className={`${stage.color} transition-all duration-200 ${
                          isSelected 
                            ? `border-2 ${getBorderColor()} shadow-sm` 
                            : 'border border-transparent hover:border-muted-foreground/30'
                        }`}
                      >
                        {stage.title}
                        <span className="ml-1 text-xs">
                          ({allTasks.filter(t => t.stage === stage.key).length})
                        </span>
                      </Badge>
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={handleClearAll}>
                Reset
              </Button>
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-4">
            <p className="text-red-800 text-sm">{error}</p>
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">Loading tasks...</p>
            </div>
          </div>
        ) : !isConnected ? (
          <MCPDisconnectedState />
        ) : filteredTasks.length === 0 ? (
          <EmptyTasksState />
        ) : (
          <div className="w-full">
            <div className="flex items-center justify-between mb-4 w-full">
              <h2 className="text-lg font-semibold">
                {filteredTasks.length} task{filteredTasks.length !== 1 ? 's' : ''} found
              </h2>
            </div>
            <div className="space-y-3 w-full">
              {filteredTasks.map((task) => {
                return (
                  <SlidableTaskCard
                    key={task.id}
                    task={task}
                    onStageChange={handleMoveTask}
                    onDoubleClick={() => handleTaskView(task.id)}
                    getStageColor={getStageColor}
                    stages={stages}
                    getPreviousStage={getPreviousStage}
                    getNextStage={getNextStage}
                  />
                );
              })}
            </div>
          </div>
        )}
        
        {/* Edit Task Form */}
        <UnifiedForm
          entityType="task"
          mode="edit"
          entityId={editingTaskId || undefined}
          templateId={1}
          onSuccess={handleEditSuccess}
          onCancel={handleEditCancel}
          onDelete={handleTaskDelete}
          isOpen={!!editingTaskId}
        />
        
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

        <UnifiedForm
          entityType="project"
          mode={editingProjectId ? 'edit' : 'create'}
          entityId={editingProjectId || undefined}
          onSuccess={handleProjectSuccess}
          onCancel={handleProjectCancel}
          onDelete={handleProjectDelete}
          isOpen={showCreateProjectForm || !!editingProjectId}
        />

        <UnifiedForm
          entityType="task"
          mode="create"
          templateId={1}
          initialStage="draft"
          onSuccess={handleTaskSuccess}
          onCancel={handleTaskCancel}
          isOpen={showAddTaskForm}
        />
        
        <TaskView
          taskId={viewingTaskId || 0}
          isOpen={!!viewingTaskId}
          onClose={() => setViewingTaskId(null)}
          onEdit={handleSwitchToEdit}
          onTaskUpdate={handleMoveTask}
          onDelete={handleTaskDelete}
        />
        
        <ProjectView
          projectId={viewingProjectId || 0}
          isOpen={!!viewingProjectId}
          onClose={() => setViewingProjectId(null)}
          onEdit={handleSwitchToProjectEdit}
        />
      </div>
    </HeaderAndSidebarLayout>
  );
};

export default DraftTasks;
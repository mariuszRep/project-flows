import React, { useState, useEffect } from 'react';
import { HeaderAndSidebarLayout } from '@/components/layout/HeaderAndSidebarLayout';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Task } from '@/types/task';
import { Project } from '@/types/project';
import { TaskBoard } from '@/components/board/TaskBoard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, X } from 'lucide-react';
import { useMCP } from '@/contexts/MCPContext';

export default function Board() {
  const navigate = useNavigate();
  const { callTool, isConnected, tools } = useMCP();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAddTaskForm, setShowAddTaskForm] = useState(false);
  const [isCreatingTask, setIsCreatingTask] = useState(false);
  const [taskForm, setTaskForm] = useState({
    title: '',
    body: '',
    stage: 'draft' as const,
    notes: '',
    taskList: '',
    currentGoal: ''
  });

  const [projects] = useState<Project[]>([
    {
      id: 1,
      name: 'Agentic Boards',
      description: 'Task management application with kanban boards',
      color: '#3b82f6',
      created_at: '2024-01-14T08:00:00Z',
      updated_at: '2024-01-14T08:00:00Z',
      created_by: 'user@example.com',
      updated_by: 'user@example.com'
    }
  ]);

  // Fetch tasks from MCP tools
  const fetchTasks = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      let allTasks: Task[] = [];
      
      if (isConnected && callTool && tools.length > 0) {
        console.log('Available tools:', tools.map(t => t.name));
        
        // Try to get all tasks from all stages
        const stages = ['backlog', 'doing', 'review', 'completed'];
        
        for (const stage of stages) {
          try {
            // First try the specific get_tasks_by_stage tool
            const stageResult = await callTool('get_tasks_by_stage', { stage });
            if (stageResult && stageResult.content && stageResult.content[0]) {
              console.log(`Tasks from ${stage} stage:`, stageResult.content);
              
              // Parse the task data from the tool result
              const taskText = stageResult.content[0].text;
              const taskMatches = taskText.match(/Task #(\d+): (.+?)(?=\nTask #|\n\n|$)/gs);
              
              if (taskMatches) {
                const parsedTasks = taskMatches.map((match) => {
                  const idMatch = match.match(/Task #(\d+):/);
                  const titleMatch = match.match(/Task #\d+: (.+?)(?=\n)/);
                  const bodyMatch = match.match(/Body: (.+?)(?=\nTask List|\nCurrent Goal|$)/s);
                  
                  const id = idMatch ? parseInt(idMatch[1]) : Math.random();
                  const title = titleMatch ? titleMatch[1].trim() : 'Untitled Task';
                  const body = bodyMatch ? bodyMatch[1].trim() : '';
                  
                  return {
                    id,
                    title,
                    body,
                    stage: stage as 'backlog' | 'doing' | 'completed',
                    project_id: 1,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                    created_by: 'user@example.com',
                    updated_by: 'user@example.com'
                  };
                });
                
                allTasks = [...allTasks, ...parsedTasks];
              }
            }
          } catch (err) {
            console.warn(`Failed to get tasks for stage ${stage}:`, err);
          }
        }
        
        // If no tasks found, try other task tools
        if (allTasks.length === 0) {
          const taskTools = tools.filter(tool => 
            tool.name.toLowerCase().includes('task') || 
            tool.name.toLowerCase().includes('todo') ||
            tool.name.toLowerCase().includes('get') ||
            tool.name.toLowerCase().includes('list') ||
            tool.name.toLowerCase().includes('fetch')
          );
          
          for (const tool of taskTools) {
            try {
              const result = await callTool(tool.name, {});
              if (result && result.content && result.content[0]) {
                console.log(`Result from ${tool.name}:`, result.content);
                
                // Handle MCP response format: content is an array with text content
                const contentText = result.content[0].text;
                
                // Parse the task data from the text content
                const taskMatches = contentText.match(/Task #(\d+): (.+?)(?=\nTask #|\n\n|$)/gs);
                let taskData: any[] = [];
                
                if (taskMatches) {
                  taskData = taskMatches.map((match) => {
                    const idMatch = match.match(/Task #(\d+):/);
                    const titleMatch = match.match(/Task #\d+: (.+?)(?=\n)/);
                    const bodyMatch = match.match(/Body: (.+?)(?=\nTask List|\nCurrent Goal|$)/s);
                    const stageMatch = match.match(/Stage: (.+?)(?=\n)/);
                    
                    return {
                      id: idMatch ? parseInt(idMatch[1]) : Math.random(),
                      title: titleMatch ? titleMatch[1].trim() : 'Untitled Task',
                      body: bodyMatch ? bodyMatch[1].trim() : '',
                      stage: stageMatch ? stageMatch[1].trim() : 'backlog'
                    };
                  });
                } else {
                  // Fallback: try to parse as single task
                  taskData = [{ title: contentText, description: `From ${tool.name}` }];
                }
                
                const parsedTasks = taskData.map((task: any, index: number) => ({
                  id: task.id || `${tool.name}-${index}-${Date.now()}`,
                  title: task.title || task.name || task.summary || task.text || 'Untitled Task',
                  body: task.body || task.description || task.content || task.details || '',
                  stage: task.stage || task.status || task.state || 'backlog',
                  project_id: task.project_id || 1,
                  created_at: task.created_at || new Date().toISOString(),
                  updated_at: task.updated_at || new Date().toISOString(),
                  created_by: task.created_by || 'user@example.com',
                  updated_by: task.updated_by || 'user@example.com'
                }));
                
                allTasks = [...allTasks, ...parsedTasks];
              }
            } catch (toolErr) {
              console.warn(`Tool ${tool.name} failed:`, toolErr);
            }
          }
        }
      }
      
      // If no tasks found from MCP tools, use fallback data
      if (allTasks.length === 0) {
        allTasks = [
          {
            id: 1,
            title: 'Design new user interface',
            body: 'Create wireframes and mockups for the new dashboard interface',
            stage: 'backlog',
            project_id: 1,
            created_at: '2024-01-15T10:00:00Z',
            updated_at: '2024-01-15T10:00:00Z',
            created_by: 'user@example.com',
            updated_by: 'user@example.com'
          },
          {
            id: 2,
            title: 'Implement API endpoints',
            body: 'Set up REST API endpoints for user management',
            stage: 'doing',
            project_id: 1,
            created_at: '2024-01-15T11:00:00Z',
            updated_at: '2024-01-15T11:00:00Z',
            created_by: 'user@example.com',
            updated_by: 'user@example.com'
          },
          {
            id: 3,
            title: 'Setup project structure',
            body: 'Initialize React project with TypeScript and Tailwind CSS',
            stage: 'completed',
            project_id: 1,
            created_at: '2024-01-14T09:00:00Z',
            updated_at: '2024-01-14T09:00:00Z',
            created_by: 'user@example.com',
            updated_by: 'user@example.com'
          }
        ];
      }
      
      // Remove duplicates based on id
      const uniqueTasks = allTasks.filter((task, index, self) => 
        index === self.findIndex(t => t.id === task.id)
      );
      
      console.log(`Found ${uniqueTasks.length} unique tasks from ${tools.length} tools`);
      setTasks(uniqueTasks);
      
    } catch (err) {
      console.error('Error fetching tasks:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch tasks');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, [isConnected, tools]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/auth');
  };

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
          id: taskId,
          stage: newStage,
          updated_by: 'user@example.com'
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

  const handleTaskDelete = () => {
    // In a real app, this would refetch tasks from the server
    console.log('Task deleted');
  };

  const handleSettingsClick = () => {
    navigate('/settings');
  };

  const handleAddTask = async () => {
    if (!taskForm.title.trim()) {
      setError('Task title is required');
      return;
    }

    if (!isConnected || !callTool) {
      setError('MCP not connected');
      return;
    }

    setIsCreatingTask(true);
    setError(null);

    try {
      const createTaskTool = tools.find(tool => tool.name === 'create_task');
      
      if (!createTaskTool) {
        throw new Error('create_task tool not available');
      }

      const result = await callTool('create_task', {
        title: taskForm.title,
        body: taskForm.body || undefined,
        stage: taskForm.stage,
        notes: taskForm.notes || undefined,
        taskList: taskForm.taskList || undefined,
        currentGoal: taskForm.currentGoal || undefined,
        created_by: 'user@example.com'
      });

      if (result && result.content) {
        console.log('Task created:', result.content);
        
        // Reset form
        setTaskForm({
          title: '',
          body: '',
          stage: 'draft' as const,
          notes: '',
          taskList: '',
          currentGoal: ''
        });
        
        // Close form
        setShowAddTaskForm(false);
        
        // Refresh tasks
        await fetchTasks();
      }
    } catch (err) {
      console.error('Error creating task:', err);
      setError(err instanceof Error ? err.message : 'Failed to create task');
    } finally {
      setIsCreatingTask(false);
    }
  };

  const handleCancelAddTask = () => {
    setShowAddTaskForm(false);
    setTaskForm({
      title: '',
      body: '',
      stage: 'draft' as const,
      notes: '',
      taskList: '',
      currentGoal: ''
    });
    setError(null);
  };

  return (
    <HeaderAndSidebarLayout
      handleSignOut={handleSignOut}
      onSettingsClick={handleSettingsClick}
    >
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Task Board</h1>
            <p className="text-sm text-muted-foreground">
              Manage your tasks with drag-and-drop kanban boards
              {!isConnected && (
                <span className="text-amber-600 ml-2">
                  (MCP not connected - using demo data)
                </span>
              )}
            </p>
          </div>
          <Button onClick={() => setShowAddTaskForm(true)} disabled={!isConnected}>
            <Plus className="h-4 w-4 mr-2" />
            Add Task
          </Button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-4">
            <p className="text-red-800 text-sm">{error}</p>
          </div>
        )}

        {showAddTaskForm && (
          <div className="bg-surface dark:bg-surface border border-border rounded-lg p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Create New Task</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCancelAddTask}
                disabled={isCreatingTask}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            
            <div className="space-y-4">
              <div>
                <Label htmlFor="title">Title *</Label>
                <Input
                  id="title"
                  value={taskForm.title}
                  onChange={(e) => setTaskForm(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Enter task title..."
                  disabled={isCreatingTask}
                />
              </div>
              
              <div>
                <Label htmlFor="body">Description</Label>
                <Textarea
                  id="body"
                  value={taskForm.body}
                  onChange={(e) => setTaskForm(prev => ({ ...prev, body: e.target.value }))}
                  placeholder="Enter task description..."
                  rows={3}
                  disabled={isCreatingTask}
                />
              </div>
              
              <div>
                <Label htmlFor="stage">Stage</Label>
                <Select
                  value={taskForm.stage}
                  onValueChange={(value) => setTaskForm(prev => ({ ...prev, stage: value as any }))}
                  disabled={isCreatingTask}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select stage" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="backlog">Backlog</SelectItem>
                    <SelectItem value="doing">Doing</SelectItem>
                    <SelectItem value="review">Review</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={taskForm.notes}
                  onChange={(e) => setTaskForm(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Additional notes or context..."
                  rows={2}
                  disabled={isCreatingTask}
                />
              </div>
              
              <div>
                <Label htmlFor="taskList">Task List</Label>
                <Textarea
                  id="taskList"
                  value={taskForm.taskList}
                  onChange={(e) => setTaskForm(prev => ({ ...prev, taskList: e.target.value }))}
                  placeholder="- [ ] Step 1&#10;- [ ] Step 2&#10;- [ ] Step 3"
                  rows={3}
                  disabled={isCreatingTask}
                />
              </div>
              
              <div>
                <Label htmlFor="currentGoal">Current Goal</Label>
                <Input
                  id="currentGoal"
                  value={taskForm.currentGoal}
                  onChange={(e) => setTaskForm(prev => ({ ...prev, currentGoal: e.target.value }))}
                  placeholder="What's the immediate next step?"
                  disabled={isCreatingTask}
                />
              </div>
              
              <div className="flex justify-end space-x-2 pt-4">
                <Button
                  variant="outline"
                  onClick={handleCancelAddTask}
                  disabled={isCreatingTask}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleAddTask}
                  disabled={isCreatingTask || !taskForm.title.trim()}
                >
                  {isCreatingTask ? 'Creating...' : 'Create Task'}
                </Button>
              </div>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">Loading tasks...</p>
            </div>
          </div>
        ) : (
          <TaskBoard
            tasks={tasks}
            setTasks={setTasks}
            onTaskUpdate={handleTaskUpdate}
            onTaskDelete={handleTaskDelete}
            projects={projects}
          />
        )}
      </div>
    </HeaderAndSidebarLayout>
  );
}
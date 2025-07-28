import React, { useState, useEffect } from 'react';
import { HeaderAndSidebarLayout } from '@/components/layout/HeaderAndSidebarLayout';
import { useNavigate } from 'react-router-dom';
import { Task } from '@/types/task';
import { Project } from '@/types/project';
import { TaskBoard } from '@/components/board/TaskBoard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MCPDisconnectedState, NoTasksState } from '@/components/ui/empty-state';
import { Plus, X, Filter } from 'lucide-react';
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
    stage: 'draft' as 'draft' | 'backlog' | 'doing' | 'review' | 'completed',
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
          const result = await callTool('list_tasks', {});
          if (result && result.content && result.content[0]) {
            console.log('List tasks result:', result.content);
            
            const contentText = result.content[0].text;
            
            // Parse the markdown table format
            const lines = contentText.split('\n').filter(line => line.trim());
            const taskRows = lines.slice(2); // Skip header and separator
            
            const parsedTasks = taskRows.map((row, index) => {
              const columns = row.split('|').map(col => col.trim()).filter(col => col);
              
              if (columns.length >= 4) {
                const id = parseInt(columns[0]) || index + 1;
                const title = columns[1] || 'Untitled Task';
                const summary = columns[2] || '';
                const stage = columns[3] || 'backlog';
                
                return {
                  id,
                  title,
                  body: summary,
                  stage: stage as 'draft' | 'backlog' | 'doing' | 'review' | 'completed',
                  project_id: 1,
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                  created_by: 'user@example.com',
                  updated_by: 'user@example.com'
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
    if (!isConnected) {
      // Clear tasks when disconnected
      setTasks([]);
      setIsLoading(false);
    } else {
      // Fetch tasks when connected
      fetchTasks();
    }
  }, [isConnected, tools]);

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
        Title: taskForm.title,
        Summary: taskForm.body || 'No description provided',
        Research: taskForm.notes || undefined,
        Items: taskForm.taskList || undefined
      });

      if (result && result.content) {
        console.log('Task created:', result.content);
        
        // Reset form
        setTaskForm({
          title: '',
          body: '',
          stage: 'draft' as 'draft' | 'backlog' | 'doing' | 'review' | 'completed',
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
      stage: 'draft' as 'draft' | 'backlog' | 'doing' | 'review' | 'completed',
      notes: '',
      taskList: '',
      currentGoal: ''
    });
    setError(null);
  };

  return (
    <HeaderAndSidebarLayout
      onSettingsClick={handleSettingsClick}
    >
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Task Board</h1>
            <p className="text-sm text-muted-foreground">
              Manage your tasks with drag-and-drop kanban boards
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate('/task-list')}>
              <Filter className="h-4 w-4 mr-2" />
              Task Manager
            </Button>
            <Button onClick={() => setShowAddTaskForm(true)} disabled={!isConnected}>
              <Plus className="h-4 w-4 mr-2" />
              Add Task
            </Button>
          </div>
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
                  onValueChange={(value) => setTaskForm(prev => ({ ...prev, stage: value as 'draft' | 'backlog' | 'doing' | 'review' | 'completed' }))}
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
            projects={projects}
          />
        )}
      </div>
    </HeaderAndSidebarLayout>
  );
}
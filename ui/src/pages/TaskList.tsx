import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { HeaderAndSidebarLayout } from '@/components/layout/HeaderAndSidebarLayout';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { useMCP } from '@/contexts/MCPContext';
import { Task, TaskStage } from '@/types/task';
import { MCPDisconnectedState } from '@/components/ui/empty-state';
import { FileText, Plus, Edit, ArrowRight, Filter } from 'lucide-react';

const DraftTasks = () => {
  const navigate = useNavigate();
  const { callTool, isConnected, tools } = useMCP();
  const [allTasks, setAllTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Filter state - default to draft only
  const [selectedStages, setSelectedStages] = useState<TaskStage[]>(['draft']);
  
  const stages: { key: TaskStage; title: string; color: string }[] = [
    { key: 'draft', title: 'Draft', color: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200' },
    { key: 'backlog', title: 'Backlog', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' },
    { key: 'doing', title: 'Doing', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' },
    { key: 'review', title: 'Review', color: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200' },
    { key: 'completed', title: 'Completed', color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' }
  ];

  // Get filtered tasks based on selected stages
  const filteredTasks = allTasks.filter(task => selectedStages.includes(task.stage));

  // Fetch all tasks from MCP
  const fetchAllTasks = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      if (isConnected && callTool && tools.length > 0) {
        const listTasksTool = tools.find(tool => tool.name === 'list_tasks');
        
        if (listTasksTool) {
          const result = await callTool('list_tasks', {});
          
          if (result && result.content && result.content[0]) {
            const contentText = result.content[0].text;
            
            // Check if there are any tasks
            if (contentText.includes('No tasks found')) {
              setAllTasks([]);
            } else {
              // Parse the markdown table format
              const lines = contentText.split('\n').filter(line => line.trim());
              const taskRows = lines.slice(2); // Skip header and separator
              
              const parsedTasks = taskRows.map((row, index) => {
                const columns = row.split('|').map(col => col.trim()).filter(col => col);
                
                if (columns.length >= 4) {
                  const id = parseInt(columns[0]) || index + 1;
                  const title = columns[1] || 'Untitled Task';
                  const summary = columns[2] || '';
                  const stage = columns[3] || 'draft';
                  
                  return {
                    id,
                    title,
                    body: summary,
                    stage: stage as TaskStage,
                    project_id: 1,
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

  useEffect(() => {
    fetchAllTasks();
  }, [isConnected, tools]);

  const handleStageToggle = (stage: TaskStage) => {
    setSelectedStages(prev => {
      if (prev.includes(stage)) {
        // Remove stage if already selected (but keep at least one selected)
        return prev.length > 1 ? prev.filter(s => s !== stage) : prev;
      } else {
        // Add stage if not selected
        return [...prev, stage];
      }
    });
  };

  const handleSelectAll = () => {
    setSelectedStages(stages.map(s => s.key));
  };

  const handleClearAll = () => {
    setSelectedStages(['draft']); // Reset to draft only
  };

  const handleTaskClick = async (taskId: number) => {
    try {
      const getTaskTool = tools.find(tool => tool.name === 'get_task');
      if (getTaskTool && isConnected && callTool) {
        const result = await callTool('get_task', { task_id: taskId });
        console.log('Task details:', result);
        // For now, just navigate to board - later could show task details modal
        navigate('/task-board');
      }
    } catch (err) {
      console.error('Error getting task details:', err);
    }
  };

  const handleMoveTask = async (taskId: number, newStage: TaskStage) => {
    try {
      const updateTaskTool = tools.find(tool => tool.name === 'update_task');
      if (updateTaskTool && isConnected && callTool) {
        await callTool('update_task', { task_id: taskId, stage: newStage });
        // Refresh the tasks list
        await fetchAllTasks();
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

  return (
    <HeaderAndSidebarLayout onSettingsClick={handleSettingsClick} fullWidth={true}>
      <div className="w-full px-[10%] space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Task Manager</h1>
            <p className="text-sm text-muted-foreground">
              Filter and manage your tasks by stage
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate('/task-board')}>
              <ArrowRight className="h-4 w-4 mr-2" />
              View Board
            </Button>
            <Button onClick={() => navigate('/task-board')}>
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
                      onClick={() => handleStageToggle(stage.key)}
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
              <Button variant="ghost" size="sm" onClick={handleSelectAll}>
                Select All
              </Button>
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
                const nextStage = getNextStage(task.stage);
                const canMoveForward = nextStage !== task.stage;
                
                return (
                  <Card key={task.id} className="card-hover w-full">
                    <CardContent className="p-4 w-full">
                      <div className="flex items-center justify-between w-full">
                        <div className="flex-1 min-w-0 pr-4">
                          <div className="flex items-center gap-3 mb-2">
                            <CardTitle className="text-lg font-semibold truncate">
                              {task.title}
                            </CardTitle>
                            <Badge variant="secondary" className={`flex-shrink-0 ${getStageColor(task.stage)}`}>
                              {stages.find(s => s.key === task.stage)?.title}
                            </Badge>
                          </div>
                          {task.body && (
                            <CardDescription className="line-clamp-2 text-sm">
                              {task.body}
                            </CardDescription>
                          )}
                        </div>
                        <div className="flex gap-2 flex-shrink-0">
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => handleTaskClick(task.id)}
                          >
                            <Edit className="h-3 w-3 mr-1" />
                            View
                          </Button>
                          {canMoveForward && (
                            <Button 
                              size="sm"
                              onClick={() => handleMoveTask(task.id, nextStage)}
                            >
                              <ArrowRight className="h-3 w-3 mr-1" />
                              To {stages.find(s => s.key === nextStage)?.title}
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </HeaderAndSidebarLayout>
  );
};

export default DraftTasks;
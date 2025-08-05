import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { X, Edit, Calendar, CheckCircle2 } from 'lucide-react';
import { useMCP } from '@/contexts/MCPContext';
import { Task, TaskStage } from '@/types/task';

interface TaskViewProps {
  taskId: number;
  isOpen: boolean;
  onClose: () => void;
  onEdit: () => void;
}

const TaskView: React.FC<TaskViewProps> = ({
  taskId,
  isOpen,
  onClose,
  onEdit
}) => {
  const { callTool, isConnected } = useMCP();
  const [markdownContent, setMarkdownContent] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [task, setTask] = useState<Task | null>(null);

  useEffect(() => {
    if (isOpen && taskId && isConnected) {
      fetchTaskDetails();
    }
  }, [taskId, isOpen, isConnected]);

  const fetchTaskDetails = async () => {
    setIsLoading(true);
    setError(null);

    try {
      if (!callTool) {
        throw new Error('MCP not connected');
      }

      const result = await callTool('get_task', {
        task_id: taskId,
        output_format: 'markdown'
      });

      if (result && result.content && result.content[0]) {
        setMarkdownContent(result.content[0].text);
        
        // Also try to get JSON format for task data
        const jsonResult = await callTool('get_task', {
          task_id: taskId,
          output_format: 'json'
        });
        
        if (jsonResult && jsonResult.content && jsonResult.content[0]) {
          try {
            const taskData = JSON.parse(jsonResult.content[0].text);
            setTask(taskData);
          } catch (e) {
            console.error('Error parsing task JSON:', e);
          }
        }
      } else {
        setError('Failed to fetch task details');
      }
    } catch (err) {
      console.error('Error fetching task:', err);
      setError('Error fetching task details');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 overflow-y-auto p-4">
      <Card className="w-full max-w-3xl mx-auto">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>
            {task ? `${task.title || task.Title || `Task #${taskId}`}` : `Task #${taskId}`}
          </CardTitle>
          <div className="flex gap-2">
            <Button variant="outline" size="icon" onClick={onEdit}>
              <Edit className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="max-h-[70vh] overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                <p className="text-muted-foreground">Loading task details...</p>
              </div>
            </div>
          ) : error ? (
            <div className="bg-red-50 border border-red-200 rounded-md p-4">
              <p className="text-red-800 text-sm">{error}</p>
            </div>
          ) : (
            <div>
              {task && (
                <div className="mb-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="outline" className="text-xs">
                      #{taskId}
                    </Badge>
                    {task.stage && (
                      <Badge 
                        className={`
                          ${task.stage === 'draft' ? 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200' : ''}
                          ${task.stage === 'backlog' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' : ''}
                          ${task.stage === 'doing' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' : ''}
                          ${task.stage === 'review' ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200' : ''}
                          ${task.stage === 'completed' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : ''}
                        `}
                      >
                        {task.stage.charAt(0).toUpperCase() + task.stage.slice(1)}
                      </Badge>
                    )}
                    {task.created_at && (
                      <div className="text-xs text-muted-foreground flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {new Date(task.created_at).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                </div>
              )}
              <div className="prose dark:prose-invert max-w-none prose-headings:font-semibold prose-headings:text-foreground prose-p:text-muted-foreground prose-strong:text-foreground prose-code:text-foreground prose-code:bg-muted prose-code:rounded prose-code:px-1 prose-code:py-0.5 prose-pre:bg-muted prose-pre:text-foreground prose-pre:rounded-md prose-a:text-primary prose-li:text-muted-foreground">
                <ReactMarkdown>{markdownContent}</ReactMarkdown>
              </div>
            </div>
          )}
        </CardContent>
        <CardFooter className="flex justify-end">
          <Button onClick={onEdit}>
            <Edit className="h-4 w-4 mr-2" />
            Edit Task
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
};

export default TaskView;

import React, { useState, useEffect } from 'react';
import MarkdownRenderer from '@/components/ui/MarkdownRenderer';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { X, Edit, Calendar } from 'lucide-react';
import { useMCP } from '@/contexts/MCPContext';
import { Task } from '@/types/task';

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
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [task, setTask] = useState<Task | null>(null);
  const [orderedProperties, setOrderedProperties] = useState<string[]>([]);

  useEffect(() => {
    if (isOpen && taskId && isConnected) {
      fetchTaskDetails();
      fetchTemplateProperties();
    }
  }, [taskId, isOpen, isConnected]);

  const fetchTemplateProperties = async () => {
    if (!callTool) return;

    try {
      // Assume template_id = 1 for tasks
      const result = await callTool('get_template_properties', { template_id: 1 });
      
      if (result?.content?.[0]?.text) {
        const properties: Record<string, { execution_order?: number }> = JSON.parse(result.content[0].text);
        
        // Sort properties by execution order
        const ordered = Object.entries(properties)
          .sort(([, a], [, b]) => (a.execution_order || 999) - (b.execution_order || 999))
          .map(([key]) => key);
        
        setOrderedProperties(ordered);
      }
    } catch (err) {
      console.error('Error fetching template properties:', err);
      // Fallback to common order if template properties fail
      setOrderedProperties(['Title', 'Description', 'Items', 'Notes']);
    }
  };

  const fetchTaskDetails = async () => {
    setIsLoading(true);
    setError(null);

    try {
      if (!callTool) {
        throw new Error('MCP not connected');
      }

      if (!taskId) {
        throw new Error('No task ID provided');
      }

      // Get task data in JSON format
      const result = await callTool('get_task', {
        task_id: taskId,
        output_format: 'json'
      });
      
      if (result && result.content && result.content[0]) {
        try {
          const taskData = JSON.parse(result.content[0].text);
          setTask(taskData);
        } catch (e) {
          console.error('Error parsing task JSON:', e);
          setError('Error parsing task data');
        }
      } else {
        throw new Error('Failed to fetch task details');
      }
    } catch (err) {
      console.error('Error fetching task:', err);
      setError(`Error: ${err instanceof Error ? err.message : 'Failed to fetch task details'}`);
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
                    {task.parent_name && (
                      <Badge variant="outline" className="text-xs">
                        Project: {task.parent_name}
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
              {task && (
                <div className="space-y-4">
                  {/* Render properties in execution order, skipping Title since it's already displayed in header */}
                  {orderedProperties
                    .filter(propertyName => propertyName !== 'Title' && task[propertyName])
                    .map((propertyName) => (
                      <div 
                        key={propertyName}
                        className="relative -mx-4 px-4 py-2 rounded"
                        style={{
                          border: '1px solid transparent',
                          transition: 'border-color 0.2s ease',
                        }}
                        onMouseEnter={(e) => {
                          const textColor = window.getComputedStyle(e.currentTarget).color;
                          e.currentTarget.style.borderColor = textColor;
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.borderColor = 'transparent';
                        }}
                      >
                        <h3 className="text-sm font-semibold mb-2">{propertyName}</h3>
                        <div className="prose dark:prose-invert max-w-none">
                          <MarkdownRenderer content={task[propertyName]} />
                        </div>
                      </div>
                    ))}
                  
                  {/* Project info has been moved to the top */}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default TaskView;

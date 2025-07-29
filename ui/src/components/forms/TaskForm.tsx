import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AutoTextarea } from '@/components/ui/auto-textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { X } from 'lucide-react';
import { useMCP } from '@/contexts/MCPContext';
import { Task, TaskStage } from '@/types/task';

interface TaskFormProps {
  mode: 'create' | 'edit';
  taskId?: number;
  templateId?: number;
  initialStage?: TaskStage;
  onSuccess?: (task: Task) => void;
  onCancel?: () => void;
  isOpen?: boolean;
}

interface TemplateProperty {
  type: string;
  description: string;
  dependencies?: string[];
  execution_order?: number;
  id?: number;
  template_id?: number;
  fixed?: boolean;
}

interface FormField {
  name: string;
  label: string;
  description: string;
  type: 'input' | 'textarea' | 'select';
  required: boolean;
  placeholder: string;
  order: number;
}

const TaskForm: React.FC<TaskFormProps> = ({
  mode,
  taskId,
  templateId = 1,
  initialStage = 'draft',
  onSuccess,
  onCancel,
  isOpen = true
}) => {
  const { callTool, isConnected, tools } = useMCP();
  const [formFields, setFormFields] = useState<FormField[]>([]);
  const [formData, setFormData] = useState<Record<string, any>>({
    stage: initialStage
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Infer the appropriate input type based on field name and property type
  const inferInputType = (fieldName: string, propertyType: string): 'input' | 'textarea' | 'select' => {
    // Stage is always a select
    if (fieldName.toLowerCase() === 'stage') return 'select';
    
    // Title is typically a single line input
    if (fieldName.toLowerCase() === 'title') return 'input';
    
    // Multi-line fields get textarea
    const multiLineFields = ['description', 'notes', 'items', 'summary', 'content', 'body'];
    if (multiLineFields.some(field => fieldName.toLowerCase().includes(field))) {
      return 'textarea';
    }
    
    // Default to input for string types, textarea for text types
    return propertyType === 'text' ? 'textarea' : 'input';
  };

  // Generate placeholder text based on field name and description
  const generatePlaceholder = (fieldName: string, description: string): string => {
    const fieldLower = fieldName.toLowerCase();
    
    if (fieldLower.includes('title')) {
      return 'Enter task title...';
    } else if (fieldLower.includes('description')) {
      return 'Enter task description...';
    } else if (fieldLower.includes('notes')) {
      return 'Additional notes or context...';
    } else if (fieldLower.includes('items')) {
      return '- [ ] Step 1\n- [ ] Step 2\n- [ ] Step 3';
    }
    
    // Use first sentence of description as placeholder
    const firstSentence = description.split('.')[0];
    return firstSentence.length > 60 ? `Enter ${fieldName.toLowerCase()}...` : firstSentence + '...';
  };

  // Fetch template properties and generate form fields
  const fetchTemplateProperties = useCallback(async () => {
    if (!isConnected || !callTool) {
      setError('Not connected to MCP server');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      console.log('Fetching template properties for templateId:', templateId);
      const result = await callTool('get_template_properties', { template_id: templateId });
      
      if (result?.content?.[0]?.text) {
        const properties: Record<string, TemplateProperty> = JSON.parse(result.content[0].text);
        console.log('Template properties:', properties);
        
        // Convert properties to form fields
        const fields: FormField[] = Object.entries(properties)
          .sort(([, a], [, b]) => (a.execution_order || 999) - (b.execution_order || 999))
          .map(([key, property]) => ({
            name: key,
            label: key,
            description: property.description || '',
            type: inferInputType(key, property.type),
            required: key === 'Title', // Title is always required
            placeholder: generatePlaceholder(key, property.description || ''),
            order: property.execution_order || 999
          }));

        // Add stage field if not present
        if (!fields.some(field => field.name.toLowerCase() === 'stage')) {
          fields.push({
            name: 'stage',
            label: 'Stage',
            description: 'Task stage in the workflow',
            type: 'select',
            required: true,
            placeholder: 'Select stage',
            order: 1000
          });
        }

        setFormFields(fields);
        console.log('Generated form fields:', fields);
        
        // Initialize form data with empty values
        const initialData: Record<string, any> = { stage: initialStage };
        fields.forEach(field => {
          if (field.name !== 'stage') {
            initialData[field.name] = '';
          }
        });
        setFormData(initialData);
        
      } else {
        throw new Error('No template properties found');
      }
    } catch (err) {
      console.error('Error fetching template properties:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch template properties');
    } finally {
      setIsLoading(false);
    }
  }, [isConnected, callTool, templateId, initialStage]);

  // Fetch existing task data for edit mode
  const fetchTaskData = useCallback(async () => {
    if (mode !== 'edit' || !taskId || !isConnected || !callTool) return;

    setIsLoading(true);
    setError(null);

    try {
      console.log('Fetching task data for taskId:', taskId);
      const result = await callTool('get_task', { task_id: taskId });
      
      if (result?.content?.[0]?.text) {
        // Parse the markdown response to extract task data
        const taskContent = result.content[0].text;
        console.log('Task content:', taskContent);
        
        // Extract task data from markdown format
        const taskData: Record<string, any> = { stage: 'draft' };
        
        // Extract title from the first line or task ID line
        const titleMatch = taskContent.match(/\*\*Title:\*\* (.+)/i) || 
                          taskContent.match(/^# Task[\s\S]*?\*\*Task ID:\*\* \d+[\s\S]*?\*\*Title:\*\* (.+)/m) ||
                          taskContent.match(/^(.+)$/m);
        if (titleMatch) {
          taskData.Title = titleMatch[1].trim();
        }
        
        // Parse the markdown to extract field values
        const lines = taskContent.split('\n');
        let currentSection = '';
        let sectionContent = '';
        
        for (const line of lines) {
          if (line.startsWith('**') && line.endsWith('**')) {
            // Save previous section
            if (currentSection && sectionContent.trim()) {
              const fieldName = currentSection.replace(':', '').trim();
              taskData[fieldName] = sectionContent.trim();
            }
            
            // Start new section
            currentSection = line.replace(/\*\*/g, '');
            sectionContent = '';
          } else if (line.startsWith('## ')) {
            // Save previous section
            if (currentSection && sectionContent.trim()) {
              const fieldName = currentSection.replace(':', '').trim();
              taskData[fieldName] = sectionContent.trim();
            }
            
            // Start new section
            currentSection = line.replace('## ', '');
            sectionContent = '';
          } else if (currentSection && line.trim()) {
            sectionContent += (sectionContent ? '\n' : '') + line;
          }
        }
        
        // Handle the last section
        if (currentSection && sectionContent.trim()) {
          const fieldName = currentSection.replace(':', '').trim();
          taskData[fieldName] = sectionContent.trim();
        }
        
        // Extract stage from the content if present
        const stageMatch = taskContent.match(/\*\*Stage:\*\* (\w+)/);
        if (stageMatch) {
          taskData.stage = stageMatch[1];
        }
        
        // Ensure Title is properly set if not found in markdown parsing
        if (!taskData.Title && taskData.title) {
          taskData.Title = taskData.title;
        }
        
        console.log('Parsed task data:', taskData);
        setFormData(taskData);
        
      } else {
        throw new Error('No task data found');
      }
    } catch (err) {
      console.error('Error fetching task data:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch task data');
    } finally {
      setIsLoading(false);
    }
  }, [mode, taskId, isConnected, callTool]);

  // Initialize form
  useEffect(() => {
    if (isConnected && isOpen) {
      fetchTemplateProperties();
    }
  }, [isConnected, isOpen, fetchTemplateProperties]);

  // Fetch task data for edit mode after template properties are loaded
  useEffect(() => {
    if (formFields.length > 0 && mode === 'edit') {
      fetchTaskData();
    }
  }, [formFields, mode, fetchTaskData]);

  // Handle form field changes
  const handleFieldChange = (fieldName: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [fieldName]: value
    }));
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isConnected || !callTool) {
      setError('Not connected to MCP server');
      return;
    }

    // Validate required fields
    const titleField = formFields.find(field => field.name === 'Title' || field.required);
    if (titleField && !formData[titleField.name]?.trim()) {
      setError(`${titleField.label} is required`);
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      let result;
      
      if (mode === 'create') {
        // Create new task
        const createData: Record<string, any> = {};
        formFields.forEach(field => {
          if (field.name !== 'stage' && formData[field.name]) {
            createData[field.name] = formData[field.name];
          }
        });
        
        console.log('Creating task with data:', createData);
        result = await callTool('create_task', createData);
        
      } else if (mode === 'edit' && taskId) {
        // Update existing task
        const updateData: Record<string, any> = { task_id: taskId };
        formFields.forEach(field => {
          if (formData[field.name] !== undefined) {
            updateData[field.name] = formData[field.name];
          }
        });
        
        console.log('Updating task with data:', updateData);
        result = await callTool('update_task', updateData);
      }

      if (result?.content) {
        console.log('Task operation successful:', result.content);
        
        // Create a mock task object for the callback
        const task: Task = {
          id: taskId || Date.now(),
          title: formData.Title || formData.title || 'Untitled Task',
          body: formData.Description || formData.description || formData.Summary || '',
          stage: formData.stage as TaskStage,
          project_id: 1,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          created_by: 'user@example.com',
          updated_by: 'user@example.com'
        };
        
        onSuccess?.(task);
      } else {
        throw new Error('No response from server');
      }
    } catch (err) {
      console.error('Error submitting form:', err);
      setError(err instanceof Error ? err.message : 'Failed to submit form');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle cancel
  const handleCancel = () => {
    onCancel?.();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-background rounded-lg shadow-xl w-[80%] max-w-4xl max-h-[90vh] flex flex-col">
        <div className="bg-background border-b border-border p-6 flex items-center justify-between rounded-t-lg flex-shrink-0">
          <div>
            <h3 className="text-lg font-semibold">
              {mode === 'create' ? 'Create New Task' : 'Edit Task'}
            </h3>
            {mode === 'edit' && taskId && (
              <p className="text-sm text-muted-foreground mt-1">
                Task ID: {taskId}
              </p>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleCancel}
              disabled={isSubmitting}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Cancel
            </button>
            <Button
              type="submit"
              form="task-form"
              disabled={isSubmitting || !formData.Title?.trim()}
            >
              {isSubmitting 
                ? (mode === 'create' ? 'Creating...' : 'Updating...') 
                : (mode === 'create' ? 'Create Task' : 'Update Task')
              }
            </Button>
          </div>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-4 mb-4">
              <p className="text-red-800 dark:text-red-200 text-sm">{error}</p>
            </div>
          )}

          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                <p className="text-muted-foreground">Loading form...</p>
              </div>
            </div>
          ) : (
            <form id="task-form" onSubmit={handleSubmit} className="space-y-4">
              {/* Stage field - render first */}
              {formFields.find(field => field.name.toLowerCase() === 'stage') && (
                <div>
                  <Label htmlFor="stage">
                    Stage *
                  </Label>
                  <Select
                    value={formData.stage || initialStage}
                    onValueChange={(value) => handleFieldChange('stage', value)}
                    disabled={isSubmitting}
                  >
                    <SelectTrigger className="w-full">
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
              )}
              
              {/* All other fields except stage */}
              {formFields.filter(field => field.name.toLowerCase() !== 'stage').map((field) => (
            <div key={field.name}>
              <Label htmlFor={field.name}>
                {field.label} {field.required && '*'}
              </Label>
              
              {field.type === 'input' && (
                <Input
                  id={field.name}
                  value={formData[field.name] || ''}
                  onChange={(e) => handleFieldChange(field.name, e.target.value)}
                  placeholder={field.placeholder}
                  disabled={isSubmitting}
                  className="w-full"
                />
              )}
              
              {field.type === 'textarea' && (
                <AutoTextarea
                  id={field.name}
                  value={formData[field.name] || ''}
                  onChange={(e) => handleFieldChange(field.name, e.target.value)}
                  placeholder={field.placeholder}
                  minRows={field.name.toLowerCase().includes('items') ? 3 : 2}
                  maxRows={field.name.toLowerCase().includes('items') ? 8 : 6}
                  disabled={isSubmitting}
                  className="w-full"
                />
              )}
              
              {field.type === 'select' && field.name.toLowerCase() !== 'stage' && (
                <Select
                  value={formData[field.name] || ''}
                  onValueChange={(value) => handleFieldChange(field.name, value)}
                  disabled={isSubmitting}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={field.placeholder} />
                  </SelectTrigger>
                  <SelectContent>
                    {/* Add options based on field configuration */}
                  </SelectContent>
                </Select>
              )}
              
              {field.description && (
                <p className="text-xs text-muted-foreground mt-1">
                  {field.description}
                </p>
              )}
            </div>
          ))}
          
        </form>
      )}
    </div>
      </div>
    </div>
  );
};

export default TaskForm;
import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AutoTextarea } from '@/components/ui/auto-textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';
import { Trash2 } from 'lucide-react';
import { useMCP } from '@/contexts/MCPContext';
import { useProject } from '@/contexts/ProjectContext';
import { TaskStage } from '@/types/task';
import { EpicStage } from '@/types/epic';

export type EntityType = 'task' | 'project' | 'epic';
export type FormMode = 'create' | 'edit';

interface UnifiedFormProps {
  entityType: EntityType;
  mode: FormMode;
  entityId?: number;
  templateId?: number;
  initialStage?: TaskStage | EpicStage;
  onSuccess?: (entity: any) => void;
  onCancel?: () => void;
  onDelete?: (entityId: number, entityTitle: string) => void;
  isOpen?: boolean;
}

interface TemplateProperty {
  id: number;
  template_id: number;
  key: string;
  type: string;
  description: string;
  dependencies: string[];
  execution_order: number;
  fixed: boolean;
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

const UnifiedForm: React.FC<UnifiedFormProps> = ({
  entityType,
  mode,
  entityId,
  templateId,
  initialStage = 'draft',
  onSuccess,
  onCancel,
  onDelete,
  isOpen = true
}) => {
  const { callTool, isConnected } = useMCP();
  const { selectedProjectId, projects, isLoadingProjects } = useProject();
  
  // Determine template ID based on entity type if not provided
  const effectiveTemplateId = templateId ?? (entityType === 'task' ? 1 : 2);
  
  const [formFields, setFormFields] = useState<FormField[]>([]);
  const [formData, setFormData] = useState<Record<string, any>>({
    stage: initialStage,
    project_id: entityType === 'task' ? selectedProjectId : undefined
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<{
    isOpen: boolean;
    entityId: number | null;
    entityTitle: string;
  }>({
    isOpen: false,
    entityId: null,
    entityTitle: '',
  });

  // Infer the appropriate input type based on property type and description
  const inferInputType = (fieldName: string, propertyType: string, description: string): 'input' | 'textarea' | 'select' => {
    // Stage is always a select for tasks
    if (fieldName.toLowerCase() === 'stage' && entityType === 'task') return 'select';
    
    // Use property type as primary indicator
    if (propertyType === 'text') {
      return 'textarea';
    }
    
    // For string types, check description for hints about expected content length
    if (propertyType === 'string') {
      const desc = description.toLowerCase();
      
      // Look for keywords that suggest multi-line content
      const multiLineIndicators = [
        'list', 'describe', 'outline', 'explain', 'detail', 'steps', 
        'multiple', 'several', 'examples', 'checklist', 'structure',
        'sections', 'points', 'items', 'features', 'functionalities'
      ];
      
      if (multiLineIndicators.some(indicator => desc.includes(indicator))) {
        return 'textarea';
      }
      
      // If description mentions short/brief content, use input
      if (desc.includes('brief') || desc.includes('short') || desc.includes('single') || desc.includes('name')) {
        return 'input';
      }
      
      // Default to input for string type
      return 'input';
    }
    
    // Default fallback
    return 'input';
  };

  // Generate placeholder text dynamically from template property description
  const generatePlaceholder = (fieldName: string, description: string): string => {
    if (!description || description.trim() === '') {
      return `Enter ${fieldName.toLowerCase()}...`;
    }
    
    // Extract the first sentence or meaningful phrase from description
    const cleanDescription = description.replace(/\*\*[^*]*\*\*/g, ''); // Remove markdown bold
    const firstSentence = cleanDescription.split(/[.!?]/)[0].trim();
    
    // If the first sentence is too long, create a generic placeholder
    if (firstSentence.length > 80) {
      return `Enter ${fieldName.toLowerCase()}...`;
    }
    
    // If the first sentence is too short or generic, try to make it more specific
    if (firstSentence.length < 10) {
      return `Enter ${fieldName.toLowerCase()}...`;
    }
    
    // Convert description to a placeholder by making it instruction-like
    let placeholder = firstSentence;
    
    // If it doesn't start with a verb, add "Enter" or "Describe"
    if (!placeholder.match(/^(Enter|Describe|List|Specify|Provide|Define|Generate|Create|Add|Include)/i)) {
      if (placeholder.toLowerCase().includes('what') || placeholder.toLowerCase().includes('who') || placeholder.toLowerCase().includes('how')) {
        placeholder = `Describe: ${placeholder}`;
      } else {
        placeholder = `Enter: ${placeholder}`;
      }
    }
    
    return `${placeholder}...`;
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
      console.log(`Fetching template properties for ${entityType} (templateId: ${effectiveTemplateId})`);
      const result = await callTool('list_properties', { template_id: effectiveTemplateId });
      
      if (result?.content?.[0]?.text) {
        const properties: TemplateProperty[] = JSON.parse(result.content[0].text);
        console.log('Template properties:', properties);
        
        // Convert properties to form fields
        const fields: FormField[] = properties
          .sort((a, b) => (a.execution_order || 999) - (b.execution_order || 999))
          .map((property) => ({
            name: property.key,
            label: property.key,
            description: property.description || '',
            type: inferInputType(property.key, property.type, property.description || ''),
            required: property.key === 'Title', // Title is always required
            placeholder: generatePlaceholder(property.key, property.description || ''),
            order: property.execution_order || 999
          }));

        // Add stage field if this is a task and not present
        if (entityType === 'task' && !fields.some(field => field.name.toLowerCase() === 'stage')) {
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
        const initialData: Record<string, any> = entityType === 'task' 
          ? { stage: initialStage, project_id: selectedProjectId }
          : {};
        
        fields.forEach(field => {
          if (field.name !== 'stage') {
            initialData[field.name] = '';
          }
        });
        
        // Ensure project_id is set for task create mode
        if (entityType === 'task' && mode === 'create' && selectedProjectId !== null) {
          initialData.project_id = selectedProjectId;
          console.log(`Setting initial project_id to ${selectedProjectId} for task create mode`);
        }
        
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
  }, [isConnected, callTool, effectiveTemplateId, entityType, initialStage, selectedProjectId, mode]);

  // Fetch existing entity data for edit mode
  const fetchEntityData = useCallback(async () => {
    if (mode !== 'edit' || !entityId || !isConnected || !callTool) return;

    setIsLoading(true);
    setError(null);

    try {
      console.log(`Fetching ${entityType} data for ${entityType}Id:`, entityId);
      const toolName = entityType === 'task' ? 'get_task' : 'get_project';
      const paramName = entityType === 'task' ? 'task_id' : 'project_id';
      const result = await callTool(toolName, { 
        [paramName]: entityId,
        ...(entityType === 'task' && { output_format: 'json' })
      });
      
      if (result?.content?.[0]?.text) {
        const responseContent = result.content[0].text;
        console.log('Raw response content:', responseContent.substring(0, 200));
        
        let entityData: Record<string, any> = entityType === 'task' 
          ? { stage: 'draft', project_id: null }
          : {};
        
        // Parse JSON response
        try {
          const jsonData = JSON.parse(responseContent);
          console.log(`Parsed JSON ${entityType} data:`, jsonData);
          
          // Map the JSON fields to form data
          if (entityType === 'task') {
            entityData = {
              stage: jsonData.stage || 'draft',
              project_id: jsonData.parent_id || null,
              // Copy properties from blocks object if it exists, otherwise from top level
              ...(jsonData.blocks || {}),
              // Also copy any top-level properties for backward compatibility
              ...jsonData
            };
            
            // Ensure proper field mapping for new blocks format
            if (jsonData.blocks) {
              Object.keys(jsonData.blocks).forEach(key => {
                entityData[key] = jsonData.blocks[key];
              });
            } else {
              // Fallback to old format for backward compatibility
              if (jsonData.title && !entityData.Title) {
                entityData.Title = jsonData.title;
              }
              if (jsonData.description && !entityData.Description) {
                entityData.Description = jsonData.description;
              }
            }
          } else {
            // Project data
            entityData = jsonData.blocks ? { ...jsonData.blocks } : {};
          }
          
        } catch (jsonError) {
          console.error('JSON parsing failed:', jsonError);
          throw new Error('Failed to parse JSON response from server');
        }
        
        console.log(`Final ${entityType} data:`, entityData);
        setFormData(prev => ({ ...prev, ...entityData }));
        
      } else {
        throw new Error(`No ${entityType} data found`);
      }
    } catch (err) {
      console.error(`Error fetching ${entityType} data:`, err);
      setError(err instanceof Error ? err.message : `Failed to fetch ${entityType} data`);
    } finally {
      setIsLoading(false);
    }
  }, [mode, entityId, entityType, isConnected, callTool]);

  // Initialize form
  useEffect(() => {
    if (isConnected && isOpen) {
      fetchTemplateProperties();
    }
  }, [isConnected, isOpen, fetchTemplateProperties]);

  // Fetch entity data for edit mode after template properties are loaded
  useEffect(() => {
    if (formFields.length > 0 && mode === 'edit') {
      fetchEntityData();
    }
  }, [formFields, mode, fetchEntityData]);

  // Update project_id when selectedProjectId changes for task create mode
  useEffect(() => {
    if (entityType === 'task' && mode === 'create' && selectedProjectId !== null && formData.project_id !== selectedProjectId) {
      console.log(`Setting project_id to ${selectedProjectId} for task create mode`);
      setFormData(prev => ({
        ...prev,
        project_id: selectedProjectId
      }));
    }
  }, [selectedProjectId, mode, entityType]);

  // Ensure project is set when projects finish loading (for task create mode)
  useEffect(() => {
    if (entityType === 'task' && mode === 'create' && !isLoadingProjects && selectedProjectId !== null && formData.project_id !== selectedProjectId) {
      console.log(`Projects loaded, ensuring project_id is set to ${selectedProjectId}`);
      setFormData(prev => ({
        ...prev,
        project_id: selectedProjectId
      }));
    }
  }, [isLoadingProjects, selectedProjectId, mode, entityType, formData.project_id]);

  // Handle form field changes
  const handleFieldChange = (fieldName: string, value: string | number | null) => {
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
      let result: any;
      
      if (mode === 'create') {
        // Create new entity
        const createData: Record<string, any> = {};
        formFields.forEach(field => {
          if (field.name !== 'stage' && formData[field.name]) {
            createData[field.name] = formData[field.name];
          }
        });
        
        // Add parent_id for tasks and epics (project_id becomes parent_id in the database)
        if ((entityType === 'task' || entityType === 'epic') && formData.project_id !== undefined && formData.project_id !== null) {
          createData.parent_id = formData.project_id;
        }
        
        // Add template_id for epic entities
        if (entityType === 'epic') {
          createData.template_id = templateId || 3;
        }
        
        console.log(`Creating ${entityType} with data:`, createData);
        const toolName = entityType === 'task' ? 'create_task' : 
                        entityType === 'project' ? 'create_project' : 'create_object';
        result = await callTool(toolName, createData);
        
      } else if (mode === 'edit' && entityId) {
        // Update existing entity
        const paramName = entityType === 'task' ? 'task_id' : 
                         entityType === 'project' ? 'project_id' : 'object_id';
        const updateData: Record<string, any> = { [paramName]: entityId };
        
        formFields.forEach(field => {
          if (formData[field.name] !== undefined) {
            updateData[field.name] = formData[field.name];
          }
        });
        
        // Add parent_id for tasks (project_id becomes parent_id in the database)
        if ((entityType === 'task' || entityType === 'epic') && formData.project_id !== undefined) {
          updateData.parent_id = formData.project_id;
        }
        
        // Add template_id for epic entities
        if (entityType === 'epic') {
          updateData.template_id = templateId || 3;
        }
        
        console.log(`Updating ${entityType} with data:`, updateData);
        const toolName = entityType === 'task' ? 'update_task' : 
                        entityType === 'project' ? 'update_project' : 'update_object';
        result = await callTool(toolName, updateData);
      }

      if (result?.content) {
        console.log(`${entityType} operation successful:`, result.content);
        
        // Create a mock entity object for the callback
        const entity = entityType === 'task' ? {
          id: entityId || Date.now(),
          title: formData.Title || formData.title || `Untitled ${entityType}`,
          body: formData.Description || formData.description || formData.Summary || '',
          stage: formData.stage as TaskStage,
          project_id: formData.project_id || null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          created_by: 'user@example.com',
          updated_by: 'user@example.com'
        } : {
          id: entityId || Date.now(),
          name: formData.Title || `Untitled ${entityType}`,
          description: formData.Description || '',
          ...formData
        };
        
        onSuccess?.(entity);
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

  // Handle delete entity request
  const handleDeleteRequest = () => {
    if (mode === 'edit' && entityId && formData.Title) {
      setDeleteDialog({
        isOpen: true,
        entityId,
        entityTitle: formData.Title || `${entityType} #${entityId}`,
      });
    }
  };

  // Confirm delete
  const confirmDelete = () => {
    if (deleteDialog.entityId && onDelete) {
      onDelete(deleteDialog.entityId, deleteDialog.entityTitle);
      setDeleteDialog({ isOpen: false, entityId: null, entityTitle: '' });
    }
  };

  // Cancel delete
  const cancelDelete = () => {
    setDeleteDialog({ isOpen: false, entityId: null, entityTitle: '' });
  };

  if (!isOpen) return null;

  const entityDisplayName = entityType === 'task' ? 'Task' : 'Project';

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-40">
      <div className="bg-background rounded-lg shadow-xl w-[80%] max-w-4xl max-h-[90vh] flex flex-col">
        <div className="bg-background border-b border-border p-6 flex items-center justify-between rounded-t-lg flex-shrink-0">
          <div>
            <h3 className="text-lg font-semibold">
              {mode === 'create' ? `Create New ${entityDisplayName}` : `Edit ${entityDisplayName}`}
            </h3>
            {mode === 'edit' && entityId && (
              <p className="text-sm text-muted-foreground mt-1">
                {entityDisplayName} ID: {entityId}
              </p>
            )}
          </div>
          <div className="flex items-center gap-3">
            {mode === 'edit' && onDelete && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleDeleteRequest}
                disabled={isSubmitting}
                className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700 hover:border-red-300"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </Button>
            )}
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
              form="unified-form"
              disabled={isSubmitting || !formData.Title?.trim()}
            >
              {isSubmitting 
                ? (mode === 'create' ? 'Creating...' : 'Updating...') 
                : (mode === 'create' ? `Create ${entityDisplayName}` : `Update ${entityDisplayName}`)
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
            <form id="unified-form" onSubmit={handleSubmit} className="space-y-4">
              {/* Stage field - render first for tasks only */}
              {entityType === 'task' && formFields.find(field => field.name.toLowerCase() === 'stage') && (
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

              {/* Project selector for tasks only */}
              {entityType === 'task' && (
                <div>
                  <Label htmlFor="project_id">
                    Project
                  </Label>
                  <Select
                    value={formData.project_id !== null && formData.project_id !== undefined ? formData.project_id.toString() : 'none'}
                    onValueChange={(value) => handleFieldChange('project_id', value === 'none' ? null : parseInt(value))}
                    disabled={isSubmitting || isLoadingProjects}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select project (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No Project</SelectItem>
                      {projects.map((project) => (
                        <SelectItem key={project.id} value={project.id.toString()}>
                          <div className="flex items-center gap-2">
                            <div 
                              className="w-3 h-3 rounded-sm" 
                              style={{ backgroundColor: project.color }}
                            />
                            <span>{project.name}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">
                    Assign this task to a specific project
                  </p>
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

        <ConfirmationDialog
          isOpen={deleteDialog.isOpen}
          onClose={cancelDelete}
          onConfirm={confirmDelete}
          title={`Delete ${entityDisplayName}`}
          description={`Are you sure you want to delete "${deleteDialog.entityTitle}"? This action cannot be undone.`}
          confirmText="Delete"
          cancelText="Cancel"
          variant="destructive"
        />
      </div>
    </div>
  );
};

export default UnifiedForm;
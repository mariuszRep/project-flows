import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AutoTextarea } from '@/components/ui/auto-textarea';
import { Label } from '@/components/ui/label';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';
import { X, Trash2, Save } from 'lucide-react';
import { useMCP } from '@/contexts/MCPContext';

interface ProjectEditFormProps {
  mode: 'create' | 'edit';
  projectId?: number;
  onSuccess?: (project: any) => void;
  onCancel?: () => void;
  onDelete?: (projectId: number, projectTitle: string) => void;
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
  type: 'input' | 'textarea';
  required: boolean;
  placeholder: string;
  order: number;
}

const ProjectEditForm: React.FC<ProjectEditFormProps> = ({
  mode,
  projectId,
  onSuccess,
  onCancel,
  onDelete,
  isOpen = true
}) => {
  const { callTool, isConnected, tools } = useMCP();
  const [formFields, setFormFields] = useState<FormField[]>([]);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<{
    isOpen: boolean;
    projectId: number | null;
    projectTitle: string;
  }>({
    isOpen: false,
    projectId: null,
    projectTitle: '',
  });

  // Infer the appropriate input type based on field name and property type
  const inferInputType = (fieldName: string, propertyType: string): 'input' | 'textarea' => {
    // Title is typically a single line input
    if (fieldName.toLowerCase() === 'title') return 'input';
    
    // Multi-line fields get textarea
    const multiLineFields = ['description', 'notes', 'items', 'summary', 'content'];
    if (multiLineFields.some(field => fieldName.toLowerCase().includes(field))) {
      return 'textarea';
    }
    
    // Default to textarea for text types, input for others
    return propertyType === 'text' ? 'textarea' : 'input';
  };

  // Generate placeholder text based on field name and description
  const generatePlaceholder = (fieldName: string, description: string): string => {
    const fieldLower = fieldName.toLowerCase();
    
    if (fieldLower.includes('title')) {
      return 'Enter project name...';
    } else if (fieldLower.includes('description')) {
      return 'Enter project description...';
    } else if (fieldLower.includes('notes')) {
      return 'Enter project notes...';
    } else if (fieldLower.includes('items')) {
      return 'Enter project milestones and deliverables...';
    }
    
    return `Enter ${fieldName.toLowerCase()}...`;
  };

  // Fetch template properties for projects (template_id = 2)
  const fetchTemplateProperties = useCallback(async () => {
    if (!isConnected || !callTool) return;

    setIsLoading(true);
    setError(null);

    try {
      console.log('Fetching template properties for project template (ID: 2)');
      const result = await callTool('get_template_properties', { template_id: 2 });
      
      if (result?.content?.[0]?.text) {
        const responseContent = result.content[0].text;
        console.log('Template properties response:', responseContent);
        
        let properties: Record<string, TemplateProperty> = {};
        
        // Try to parse as JSON
        if (responseContent.trim().startsWith('{')) {
          properties = JSON.parse(responseContent);
        } else {
          // Parse as text if needed
          console.warn('Expected JSON response for template properties');
          throw new Error('Invalid template properties response format');
        }

        // Convert properties to form fields
        const fields: FormField[] = Object.entries(properties)
          .map(([key, prop]) => ({
            name: key,
            label: key,
            description: prop.description || '',
            type: inferInputType(key, prop.type),
            required: prop.fixed || key === 'Title',
            placeholder: generatePlaceholder(key, prop.description || ''),
            order: prop.execution_order || 0
          }))
          .sort((a, b) => a.order - b.order);

        setFormFields(fields);
        console.log('Generated form fields:', fields);
        
        // Initialize form data with empty values
        const initialData: Record<string, any> = {};
        fields.forEach(field => {
          initialData[field.name] = '';
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
  }, [isConnected, callTool]);

  // Fetch existing project data for edit mode
  const fetchProjectData = useCallback(async () => {
    if (mode !== 'edit' || !projectId || !isConnected || !callTool) return;

    setIsLoading(true);
    setError(null);

    try {
      console.log('Fetching project data for projectId:', projectId);
      const result = await callTool('get_task', { task_id: projectId, output_format: 'json' });
      
      if (result?.content?.[0]?.text) {
        const responseContent = result.content[0].text;
        console.log('Raw project response content:', responseContent.substring(0, 200));
        
        let projectData: Record<string, any> = {};
        
        // Try to parse as JSON first
        if (responseContent.trim().startsWith('{')) {
          try {
            const jsonData = JSON.parse(responseContent);
            console.log('Parsed JSON project data:', jsonData);
            
            // Map the JSON fields to form data - handle blocks structure
            if (jsonData.blocks) {
              // Use blocks data as primary source for new format
              projectData = { ...jsonData.blocks };
            } else {
              // Fallback to old format for backward compatibility
              projectData = { ...jsonData };
            }
            
          } catch (jsonError) {
            console.error('JSON parsing failed:', jsonError);
            throw new Error('Failed to parse JSON response from server');
          }
        } else {
          // Fall back to markdown parsing if needed
          console.log('Falling back to markdown parsing');
          const projectContent = responseContent;
          
          // Parse ** fields (single line format)
          const titleMatch = projectContent.match(/\*\*Title:\*\* (.+)/i);
          if (titleMatch) {
            projectData.Title = titleMatch[1].trim();
          }
          
          // Parse ## sections (multi-line format)
          const sections = projectContent.split('## ');
          sections.forEach(section => {
            const lines = section.split('\n');
            const headerLine = lines[0].trim();
            const content = lines.slice(1).join('\n').trim();
            
            if (headerLine && content) {
              projectData[headerLine] = content;
            }
          });
        }
        
        console.log('Final project data:', projectData);
        setFormData(prev => ({ ...prev, ...projectData }));
        
      } else {
        throw new Error('No project data found');
      }
    } catch (err) {
      console.error('Error fetching project data:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch project data');
    } finally {
      setIsLoading(false);
    }
  }, [mode, projectId, isConnected, callTool]);

  // Load template properties when component mounts or connection changes
  useEffect(() => {
    if (isConnected && isOpen) {
      fetchTemplateProperties();
    }
  }, [isConnected, isOpen, fetchTemplateProperties]);

  // Fetch project data for edit mode after template properties are loaded
  useEffect(() => {
    if (formFields.length > 0 && mode === 'edit') {
      fetchProjectData();
    }
  }, [formFields, mode, fetchProjectData]);

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
    const titleField = formFields.find(field => field.name === 'Title');
    if (titleField && !formData[titleField.name]?.trim()) {
      setError(`${titleField.label} is required`);
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      let result;
      
      if (mode === 'create') {
        // Create new project
        const createData: Record<string, any> = { type: 'project' };
        formFields.forEach(field => {
          if (formData[field.name]) {
            createData[field.name] = formData[field.name];
          }
        });
        
        console.log('Creating project with data:', createData);
        result = await callTool('create_task', createData);
        
      } else if (mode === 'edit' && projectId) {
        // Update existing project
        const updateData: Record<string, any> = { task_id: projectId };
        formFields.forEach(field => {
          if (formData[field.name] !== undefined) {
            updateData[field.name] = formData[field.name];
          }
        });
        
        console.log('Updating project with data:', updateData);
        result = await callTool('update_task', updateData);
      }

      if (result?.content) {
        console.log('Project operation successful:', result.content);
        
        // Create a project object for the callback
        const projectResult = {
          id: projectId || Date.now(),
          name: formData.Title || 'Untitled Project',
          description: formData.Description || '',
          ...formData
        };
        
        onSuccess?.(projectResult);
        
        // Reset form for create mode
        if (mode === 'create') {
          const resetData: Record<string, any> = {};
          formFields.forEach(field => {
            resetData[field.name] = '';
          });
          setFormData(resetData);
        }
      }
    } catch (err) {
      console.error('Error submitting project:', err);
      setError(err instanceof Error ? err.message : `Failed to ${mode} project`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle delete button click
  const handleDeleteClick = () => {
    if (projectId && formData.Title) {
      setDeleteDialog({
        isOpen: true,
        projectId,
        projectTitle: formData.Title,
      });
    }
  };

  // Handle delete confirmation
  const handleDeleteConfirm = async () => {
    if (deleteDialog.projectId) {
      onDelete?.(deleteDialog.projectId, deleteDialog.projectTitle);
    }
    setDeleteDialog({ isOpen: false, projectId: null, projectTitle: '' });
  };

  // Handle cancel
  const handleCancel = () => {
    setError(null);
    onCancel?.();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-background rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div>
            <h2 className="text-xl font-semibold">
              {mode === 'create' ? 'Create Project' : 'Edit Project'}
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              {mode === 'create' 
                ? 'Create a new project to organize your tasks' 
                : 'Update project details and information'
              }
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={handleCancel}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto max-h-[calc(90vh-140px)]">
          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-md p-4">
                <p className="text-red-800 text-sm">{error}</p>
              </div>
            )}

            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                <span className="ml-3 text-muted-foreground">Loading project form...</span>
              </div>
            ) : (
              <div className="space-y-4">
                {formFields.map((field) => (
                  <div key={field.name} className="space-y-2">
                    <Label htmlFor={field.name} className="text-sm font-medium">
                      {field.label}
                      {field.required && <span className="text-red-500 ml-1">*</span>}
                    </Label>
                    <p className="text-xs text-muted-foreground mb-2">{field.description}</p>
                    
                    {field.type === 'textarea' ? (
                      <AutoTextarea
                        id={field.name}
                        value={formData[field.name] || ''}
                        onChange={(e) => handleFieldChange(field.name, e.target.value)}
                        placeholder={field.placeholder}
                        disabled={isSubmitting}
                        className="min-h-[80px]"
                        maxRows={10}
                      />
                    ) : (
                      <Input
                        id={field.name}
                        type="text"
                        value={formData[field.name] || ''}
                        onChange={(e) => handleFieldChange(field.name, e.target.value)}
                        placeholder={field.placeholder}
                        disabled={isSubmitting}
                        required={field.required}
                      />
                    )}
                  </div>
                ))}
              </div>
            )}
          </form>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t bg-muted/20">
          <div className="flex gap-2">
            {mode === 'edit' && projectId && (
              <Button
                type="button"
                variant="destructive"
                onClick={handleDeleteClick}
                disabled={isSubmitting}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleCancel}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              onClick={handleSubmit}
              disabled={isSubmitting || isLoading || !formFields.length}
            >
              {isSubmitting ? (
                <div className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  {mode === 'create' ? 'Creating...' : 'Updating...'}
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Save className="h-4 w-4" />
                  {mode === 'create' ? 'Create Project' : 'Update Project'}
                </div>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <ConfirmationDialog
        isOpen={deleteDialog.isOpen}
        onClose={() => setDeleteDialog({ isOpen: false, projectId: null, projectTitle: '' })}
        onConfirm={handleDeleteConfirm}
        title="Delete Project"
        description={`Are you sure you want to delete "${deleteDialog.projectTitle}"? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        variant="destructive"
      />
    </div>
  );
};

export default ProjectEditForm;
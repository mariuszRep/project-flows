import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { DragDropContext, Droppable, Draggable, DropResult } from 'react-beautiful-dnd';
import MarkdownRenderer from '@/components/ui/MarkdownRenderer';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { AutoTextarea } from '@/components/ui/auto-textarea';
import { X, Edit, GripVertical, Trash2, Plus, Save, XCircle, Info } from 'lucide-react';
import { useMCP } from '@/contexts/MCPContext';
import { useToast } from '@/hooks/use-toast';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface NewTemplateFormProps {
  isOpen: boolean;
  onClose: () => void;
  templateId?: number | null;
}

interface TemplateProperty {
  id?: number;
  key: string;
  type: string;
  description: string;
  dependencies?: string[];
  execution_order: number;
  fixed?: boolean;
  template_id?: number;
  created_by?: string;
  updated_by?: string;
  created_at?: string;
  updated_at?: string;
}

type ViewMode = 'view' | 'edit-property' | 'create-property';

const NewTemplateForm: React.FC<NewTemplateFormProps> = ({ isOpen, onClose, templateId }) => {
  const { callTool, isConnected } = useMCP();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [properties, setProperties] = useState<TemplateProperty[]>([]);
  const [originalProperties, setOriginalProperties] = useState<TemplateProperty[]>([]);
  const [mode, setMode] = useState<ViewMode>('view');
  const [editingProperty, setEditingProperty] = useState<TemplateProperty | null>(null);
  const [editValues, setEditValues] = useState<Partial<TemplateProperty>>({});
  const [isProjectTemplate, setIsProjectTemplate] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const firstInputRef = useRef<HTMLInputElement>(null);
  const firstTextareaRef = useRef<HTMLTextAreaElement>(null);

  // Fetch template properties
  const fetchTemplateProperties = useCallback(async () => {
    if (!isConnected || !templateId) {
      setError('Not connected to MCP server or no template selected');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const result = await callTool('list_properties', { template_id: templateId });

      if (result?.content?.[0]?.text) {
        const propertiesData = JSON.parse(result.content[0].text);

        if (Array.isArray(propertiesData)) {
          // Sort by execution_order, then by key name
          const sortedProperties = propertiesData.sort((a, b) => {
            const orderA = a.execution_order || 999;
            const orderB = b.execution_order || 999;
            if (orderA !== orderB) return orderA - orderB;
            return (a.key || '').localeCompare(b.key || '');
          });

          setProperties(sortedProperties);
          setOriginalProperties(JSON.parse(JSON.stringify(sortedProperties)));
        }
      } else {
        setProperties([]);
        setOriginalProperties([]);
      }
    } catch (err) {
      console.error('Error fetching template properties:', err);
      setError('Failed to fetch template properties');
    } finally {
      setIsLoading(false);
    }
  }, [isConnected, templateId, callTool]);

  // Determine template type
  useEffect(() => {
    const checkTemplateType = async () => {
      if (!templateId || !isConnected) return;

      try {
        const result = await callTool('list_templates');
        if (result?.content?.[0]?.text) {
          const templates = JSON.parse(result.content[0].text);
          const template = templates.find((t: any) => t.id === templateId);
          const isProject = template?.name?.toLowerCase() === 'project';
          setIsProjectTemplate(isProject);
          setTemplateName(template?.name || 'Template');
        }
      } catch (err) {
        console.error('Error determining template type:', err);
      }
    };

    checkTemplateType();
  }, [templateId, isConnected, callTool]);

  // Fetch properties when template changes
  useEffect(() => {
    if (isOpen && templateId && isConnected) {
      fetchTemplateProperties();
    }
  }, [isOpen, templateId, isConnected, fetchTemplateProperties]);

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;

    const sourceIndex = result.source.index;
    const destinationIndex = result.destination.index;

    if (sourceIndex === destinationIndex) return;

    const reorderedProperties = Array.from(properties);
    const [movedProperty] = reorderedProperties.splice(sourceIndex, 1);
    reorderedProperties.splice(destinationIndex, 0, movedProperty);

    // Update execution_order for all properties
    const updatedProperties = reorderedProperties.map((prop, index) => ({
      ...prop,
      execution_order: index + 1
    }));

    setProperties(updatedProperties);

    // Save the new order
    saveReorderedProperties(updatedProperties);
  };

  const saveReorderedProperties = async (reorderedProperties: TemplateProperty[]) => {
    try {
      // Update each property's execution_order
      for (const prop of reorderedProperties) {
        if (prop.id) {
          await callTool('update_property', {
            property_id: prop.id,
            execution_order: prop.execution_order
          });
        }
      }

      toast({
        title: "Success",
        description: "Property order updated successfully",
      });

      // Refresh properties
      await fetchTemplateProperties();
    } catch (err) {
      console.error('Error saving property order:', err);
      toast({
        title: "Error",
        description: "Failed to update property order",
        variant: "destructive",
      });
      // Revert to original order
      setProperties([...originalProperties]);
    }
  };

  const enterEditMode = (property: TemplateProperty) => {
    setEditingProperty(property);
    setEditValues({
      key: property.key,
      type: property.type,
      description: property.description,
      dependencies: property.dependencies || [],
      fixed: property.fixed || false
    });
    setMode('edit-property');
  };

  const enterCreateMode = () => {
    setEditingProperty(null);
    setEditValues({
      key: '',
      type: 'string',
      description: '',
      dependencies: [],
      execution_order: properties.length + 1,
      fixed: false
    });
    setMode('create-property');

    // Focus first input after state update
    setTimeout(() => {
      if (firstInputRef.current) {
        firstInputRef.current.focus();
      }
    }, 0);
  };

  const exitEditMode = () => {
    setMode('view');
    setEditingProperty(null);
    setEditValues({});
  };

  const handleInputChange = (field: keyof TemplateProperty, value: string | string[] | boolean | number) => {
    setEditValues(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSaveProperty = async () => {
    if (!templateId || !callTool) return;

    // Validate required fields
    if (!editValues.key?.trim()) {
      setError('Property key is required');
      return;
    }
    if (!editValues.type?.trim()) {
      setError('Property type is required');
      return;
    }
    if (!editValues.description?.trim()) {
      setError('Property description is required');
      return;
    }

    try {
      setError(null);

      if (mode === 'create-property') {
        // Create new property
        const result = await callTool('create_property', {
          template_id: templateId,
          key: editValues.key!,
          type: editValues.type!,
          description: editValues.description!,
          dependencies: editValues.dependencies || [],
          execution_order: editValues.execution_order || properties.length + 1,
          fixed: editValues.fixed || false
        });

        if (result?.content?.[0]?.text?.startsWith('Error:')) {
          throw new Error(result.content[0].text);
        }

        toast({
          title: "Success",
          description: `Property "${editValues.key}" created successfully`,
        });
      } else if (mode === 'edit-property' && editingProperty?.id) {
        // Update existing property
        const result = await callTool('update_property', {
          property_id: editingProperty.id,
          key: editValues.key!,
          type: editValues.type!,
          description: editValues.description!,
          dependencies: editValues.dependencies || [],
          fixed: editValues.fixed || false
        });

        if (result?.content?.[0]?.text?.startsWith('Error:')) {
          throw new Error(result.content[0].text);
        }

        toast({
          title: "Success",
          description: `Property "${editValues.key}" updated successfully`,
        });
      }

      // Refresh properties and exit edit mode
      await fetchTemplateProperties();
      exitEditMode();
    } catch (err) {
      console.error('Error saving property:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(`Failed to save property: ${errorMessage}`);
      toast({
        title: "Error",
        description: `Failed to save property: ${errorMessage}`,
        variant: "destructive",
      });
    }
  };

  const handleDeleteProperty = async (property: TemplateProperty) => {
    if (!property.id || !callTool) return;

    if (property.fixed) {
      toast({
        title: "Cannot Delete",
        description: "This property is fixed and cannot be deleted",
        variant: "destructive",
      });
      return;
    }

    try {
      const result = await callTool('delete_property', {
        property_id: property.id
      });

      if (result?.content?.[0]?.text?.startsWith('Error:')) {
        throw new Error(result.content[0].text);
      }

      toast({
        title: "Success",
        description: `Property "${property.key}" deleted successfully`,
      });

      // Refresh properties
      await fetchTemplateProperties();
    } catch (err) {
      console.error('Error deleting property:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      toast({
        title: "Error",
        description: `Failed to delete property: ${errorMessage}`,
        variant: "destructive",
      });
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black bg-opacity-50 overflow-y-auto p-4">
      <Card className="w-full max-w-3xl mx-auto">
        <div className="sticky top-0 bg-background border-b border-border p-6 flex items-center justify-between rounded-t-lg">
          <h2 className="text-2xl font-semibold">
            {templateName} Template Properties
          </h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="p-6 max-h-[70vh] overflow-y-auto">
          {/* Loading State */}
          {isLoading && (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                <p className="text-muted-foreground">Loading template properties...</p>
              </div>
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-4 mb-4">
              <p className="text-red-800 dark:text-red-300 text-sm">{error}</p>
            </div>
          )}

          {/* Properties List */}
          {!isLoading && (
            <div className="space-y-4">
              {properties.length === 0 && mode === 'view' && (
                <div className="text-center py-8 border-2 border-dashed border-border rounded-lg">
                  <p className="text-muted-foreground mb-4">
                    No properties found for this template.
                  </p>
                  <Button variant="outline" onClick={enterCreateMode}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add First Property
                  </Button>
                </div>
              )}

              {/* Create/Edit Form */}
              {(mode === 'create-property' || mode === 'edit-property') && (
                <div className="border rounded-xl border-border bg-muted/10 p-4 space-y-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-semibold">
                      {mode === 'create-property' ? 'Create New Property' : 'Edit Property'}
                    </h3>
                    <div className="flex gap-2">
                      <Button variant="default" size="sm" onClick={handleSaveProperty}>
                        <Save className="h-4 w-4 mr-2" />
                        Save
                      </Button>
                      <Button variant="outline" size="sm" onClick={exitEditMode}>
                        <XCircle className="h-4 w-4 mr-2" />
                        Cancel
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1 block">
                        Key (Property Name)
                      </label>
                      <Input
                        ref={firstInputRef}
                        value={editValues.key || ''}
                        onChange={(e) => handleInputChange('key', e.target.value)}
                        placeholder="e.g., Description, Items, Analysis"
                        className="w-full"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1 block">
                        Type
                      </label>
                      <Input
                        value={editValues.type || ''}
                        onChange={(e) => handleInputChange('type', e.target.value)}
                        placeholder="e.g., string, text, number"
                        className="w-full"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1 block">
                        Description
                      </label>
                      <AutoTextarea
                        ref={firstTextareaRef}
                        value={editValues.description || ''}
                        onChange={(e) => handleInputChange('description', e.target.value)}
                        placeholder="Describe the purpose of this property..."
                        minRows={2}
                        maxRows={6}
                        className="w-full"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1 block">
                        Dependencies (comma-separated)
                      </label>
                      <Input
                        value={Array.isArray(editValues.dependencies) ? editValues.dependencies.join(', ') : ''}
                        onChange={(e) => handleInputChange('dependencies', e.target.value.split(',').map(dep => dep.trim()).filter(Boolean))}
                        placeholder="e.g., Title, Description"
                        className="w-full"
                      />
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="fixed-checkbox"
                        checked={editValues.fixed || false}
                        onChange={(e) => handleInputChange('fixed', e.target.checked)}
                        className="h-4 w-4 rounded border-gray-300"
                      />
                      <label htmlFor="fixed-checkbox" className="text-xs font-medium text-muted-foreground">
                        Fixed (cannot be deleted)
                      </label>
                    </div>
                  </div>
                </div>
              )}

              {/* Draggable Properties List */}
              {mode === 'view' && properties.length > 0 && (
                <DragDropContext onDragEnd={handleDragEnd}>
                  <Droppable droppableId="properties">
                    {(provided, snapshot) => (
                      <div
                        {...provided.droppableProps}
                        ref={provided.innerRef}
                        className={`space-y-3 ${snapshot.isDraggingOver ? 'bg-muted/50 rounded-lg p-2' : ''}`}
                      >
                        {properties.map((property, index) => (
                          <Draggable
                            key={property.id || `property-${index}`}
                            draggableId={String(property.id || `property-${index}`)}
                            index={index}
                          >
                            {(provided, snapshot) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                className={`group relative border rounded-xl transition-all ${
                                  snapshot.isDragging
                                    ? 'shadow-lg ring-2 ring-primary/20 bg-background border-border'
                                    : 'border-transparent hover:border-border'
                                } p-4`}
                              >
                                <div
                                  {...provided.dragHandleProps}
                                  className="absolute left-2 top-1/2 transform -translate-y-1/2 cursor-grab active:cursor-grabbing"
                                >
                                  <GripVertical className="h-4 w-4 text-muted-foreground" />
                                </div>

                                <div className="pl-8">
                                  <div className="flex items-start justify-between mb-2">
                                    <div className="flex-1">
                                      <h3 className="text-sm font-semibold flex items-center gap-2">
                                        {property.key}
                                        {property.fixed && (
                                          <Badge variant="secondary" className="text-xs">
                                            Fixed
                                          </Badge>
                                        )}
                                      </h3>
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6"
                                        onClick={() => enterEditMode(property)}
                                        title="Edit property"
                                      >
                                        <Edit className="h-3 w-3" />
                                      </Button>
                                      {!property.fixed && (
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6 text-red-600 hover:text-red-700"
                                          onClick={() => handleDeleteProperty(property)}
                                          title="Delete property"
                                        >
                                          <Trash2 className="h-3 w-3" />
                                        </Button>
                                      )}
                                      <TooltipProvider>
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <button className="opacity-0 group-hover:opacity-100 hover:opacity-100 transition-opacity duration-200 p-1 rounded-md hover:bg-muted/50">
                                              <Info className="h-3 w-3 text-muted-foreground" />
                                            </button>
                                          </TooltipTrigger>
                                          <TooltipContent className="bg-surface border-border max-w-xs">
                                            <p className="text-xs">{property.description}</p>
                                          </TooltipContent>
                                        </Tooltip>
                                      </TooltipProvider>
                                    </div>
                                  </div>

                                  <div className="prose dark:prose-invert max-w-none text-sm text-muted-foreground">
                                    <MarkdownRenderer content={property.description || 'No description'} />
                                  </div>

                                  {(property.type || property.dependencies?.length) && (
                                    <div className="flex flex-wrap gap-2 mt-2">
                                      {property.type && (
                                        <Badge variant="outline" className="text-xs">
                                          Type: {property.type}
                                        </Badge>
                                      )}
                                      {property.dependencies && property.dependencies.length > 0 && (
                                        <Badge variant="outline" className="text-xs">
                                          Depends: {property.dependencies.join(', ')}
                                        </Badge>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                </DragDropContext>
              )}

              {/* Add New Property Button */}
              {mode === 'view' && properties.length > 0 && (
                <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
                  <Button variant="ghost" onClick={enterCreateMode}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add New Property
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </Card>
    </div>,
    document.body
  );
};

export default NewTemplateForm;
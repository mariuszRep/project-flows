import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { X, GripVertical, Edit, Trash2, Plus, Save } from 'lucide-react';
import { useMCP } from '@/contexts/MCPContext';
import { DragDropContext, Droppable, Draggable, DropResult } from 'react-beautiful-dnd';


interface TemplateFormProps {
  isOpen: boolean;
  onClose: () => void;
  templateId?: number | null;
}

interface TemplateProperty {
  type: string;
  description: string;
  dependencies?: string[];
  execution_order?: number;
  created_by?: string;
  updated_by?: string;
  created_at?: string;
  updated_at?: string;
  id?: number;
  template_id?: number;
  fixed?: boolean;
}

export const TemplateForm: React.FC<TemplateFormProps> = ({ isOpen, onClose, templateId }) => {
  const { callTool, isConnected } = useMCP();
  const [expandedBlocks, setExpandedBlocks] = useState<number[]>([]);
  const [properties, setProperties] = useState<Record<string, TemplateProperty>>({});
  const [originalProperties, setOriginalProperties] = useState<Record<string, TemplateProperty>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    title: 'Task',
    template: 'Task',
    stage: 'backlog',
    blocks: [] as Array<{
      title: string;
      describe: string;
      order: number;
      type?: string;
      dependencies?: string[];
    }>
  });
  
  // State to track if this is a project template or task template
  const [isProjectTemplate, setIsProjectTemplate] = useState(false);

  // Function to fetch template properties
  const fetchTemplateProperties = useCallback(async (templateId: number) => {
    if (!isConnected) {
      setError('Not connected to MCP server');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      console.log('Fetching template properties for templateId:', templateId);
      const result = await callTool('get_template_properties', { template_id: templateId });
      console.log('MCP tool result:', result);
      
      if (result.content && result.content[0] && result.content[0].text) {
        const propertiesData = JSON.parse(result.content[0].text);
        console.log('Parsed properties data:', propertiesData);
        setProperties(propertiesData);
        setOriginalProperties(JSON.parse(JSON.stringify(propertiesData))); // Deep copy for comparison
        
        // Convert properties to blocks - handle both object and array formats
        let blocks = [];
        if (Array.isArray(propertiesData)) {
          // If propertiesData is an array of property objects
          blocks = propertiesData
            .sort((a, b) => (a.execution_order || 999) - (b.execution_order || 999))
            .map((property, index) => ({
              title: property.key || property.name || `Property ${index + 1}`,
              describe: property.description || '',
              order: property.execution_order || index + 1,
              type: property.type || 'string',
              dependencies: property.dependencies || []
            }));
        } else {
          // If propertiesData is an object with property keys
          blocks = Object.entries(propertiesData)
            .sort(([, a], [, b]) => ((a as TemplateProperty).execution_order || 999) - ((b as TemplateProperty).execution_order || 999))
            .map(([key, property], index) => {
              const typedProperty = property as TemplateProperty;
              return {
                title: key,
                describe: typedProperty.description || '',
                order: typedProperty.execution_order || index + 1,
                type: typedProperty.type || 'string',
                dependencies: typedProperty.dependencies || []
              };
            });
        }
        
        console.log('Converted blocks:', blocks);
        setFormData(prevData => ({
          ...prevData,
          blocks
        }));
      } else {
        console.log('No content in MCP result or result is empty');
        setProperties({});
        setOriginalProperties({});
        // Set empty blocks if no properties found
        setFormData(prevData => ({
          ...prevData,
          blocks: []
        }));
      }
    } catch (error) {
      console.error('Error fetching template properties:', error);
      setError('Failed to fetch template properties');
    } finally {
      setLoading(false);
    }
  }, [isConnected, callTool]);

  // Effect to fetch template properties when templateId changes
  useEffect(() => {
    if (templateId && isConnected) {
      fetchTemplateProperties(templateId);
      
      // Determine if this is a project template based on the template ID
      // This is a simplified check - you may need to adjust based on your actual data
      const checkTemplateType = async () => {
        try {
          const result = await callTool('get_template_properties', { template_id: templateId });
          if (result.content && result.content[0] && result.content[0].text) {
            const data = JSON.parse(result.content[0].text) as Record<string, TemplateProperty>;
            // Check if any property or the template name indicates this is a project template
            // This logic should be adjusted based on your actual data structure
            const isProject = Object.values(data).some((prop: TemplateProperty) => 
              prop.type?.toLowerCase().includes('project') || 
              prop.description?.toLowerCase().includes('project')
            );
            setIsProjectTemplate(isProject);
            
            // Update the title based on template type
            setFormData(prevData => ({
              ...prevData,
              title: isProject ? 'Project' : 'Task'
            }));
          }
        } catch (error) {
          console.error('Error determining template type:', error);
        }
      };
      
      checkTemplateType();
    } else if (!templateId) {
      // Reset to empty state when no template is selected
      setFormData(prevData => ({
        ...prevData,
        blocks: []
      }));
      setProperties({});
      setOriginalProperties({});
      setError(null);
      setLoading(false);
    }
  }, [templateId, isConnected, fetchTemplateProperties]);

  const handleBlockUpdate = (index: number, field: 'title' | 'describe' | 'type' | 'dependencies', value: string | string[]) => {
    const updatedBlocks = [...formData.blocks];
    updatedBlocks[index] = {
      ...updatedBlocks[index],
      [field]: value
    };
    setFormData({ ...formData, blocks: updatedBlocks });
  };

  const toggleBlockExpanded = (index: number) => {
    setExpandedBlocks(prev => 
      prev.includes(index) 
        ? prev.filter(i => i !== index)
        : [...prev, index]
    );
  };

  const addNewBlock = () => {
    const newBlock = {
      title: '',
      describe: '',
      order: formData.blocks.length + 1,
      type: 'string',
      dependencies: []
    };
    setFormData({
      ...formData,
      blocks: [...formData.blocks, newBlock]
    });
    setExpandedBlocks([...expandedBlocks, formData.blocks.length]);
  };

  const deleteBlock = (index: number) => {
    const updatedBlocks = formData.blocks.filter((_, i) => i !== index);
    setFormData({ ...formData, blocks: updatedBlocks });
    setExpandedBlocks(expandedBlocks.filter(i => i !== index).map(i => i > index ? i - 1 : i));
  };

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) {
      return;
    }

    const sourceIndex = result.source.index;
    const destinationIndex = result.destination.index;

    if (sourceIndex === destinationIndex) {
      return;
    }

    const updatedBlocks = [...formData.blocks];
    const [reorderedItem] = updatedBlocks.splice(sourceIndex, 1);
    updatedBlocks.splice(destinationIndex, 0, reorderedItem);

    // Update order property for all blocks based on their new position
    const reorderedBlocks = updatedBlocks.map((block, index) => ({
      ...block,
      order: index + 1
    }));

    setFormData({ ...formData, blocks: reorderedBlocks });

    // Update expanded blocks indices
    const updatedExpandedBlocks = expandedBlocks.map(expandedIndex => {
      if (expandedIndex === sourceIndex) {
        return destinationIndex;
      } else if (sourceIndex < destinationIndex && expandedIndex > sourceIndex && expandedIndex <= destinationIndex) {
        return expandedIndex - 1;
      } else if (sourceIndex > destinationIndex && expandedIndex >= destinationIndex && expandedIndex < sourceIndex) {
        return expandedIndex + 1;
      }
      return expandedIndex;
    });
    setExpandedBlocks(updatedExpandedBlocks);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!templateId || !isConnected) {
      setError('Template ID or MCP connection is missing');
      return;
    }
    
    // Basic validation - no longer checking for title since it was removed from the UI
    
    // Validate blocks
    for (let i = 0; i < formData.blocks.length; i++) {
      const block = formData.blocks[i];
      if (!block.title.trim()) {
        setError(`Please enter a title for Block ${i + 1}`);
        return;
      }
      if (!block.describe.trim()) {
        setError(`Please enter a description for Block ${i + 1}`);
        return;
      }
      if (!block.type.trim()) {
        setError(`Please enter a type for Block ${i + 1}`);
        return;
      }
    }
    
    setSaving(true);
    setError(null);
    
    try {
      // Convert current blocks to properties format
      const currentProperties: Record<string, TemplateProperty> = {};
      formData.blocks.forEach(block => {
        currentProperties[block.title] = {
          type: block.type || 'string',
          description: block.describe || '',
          dependencies: block.dependencies || [],
          execution_order: block.order || 0,
          id: properties[block.title]?.id,
          template_id: templateId,
          fixed: properties[block.title]?.fixed || false
        };
      });
      
      // Find properties to create, update, and delete
      const toCreate: Array<{ key: string; property: TemplateProperty }> = [];
      const toUpdate: Array<{ key: string; property: TemplateProperty; id: number }> = [];
      const toDelete: Array<{ key: string; id: number }> = [];
      
      // Find properties to create or update
      Object.entries(currentProperties).forEach(([key, property]) => {
        if (!originalProperties[key]) {
          // New property - create
          toCreate.push({ key, property });
        } else {
          // Existing property - check if it changed
          const original = originalProperties[key];
          if (
            property.type !== original.type ||
            property.description !== original.description ||
            JSON.stringify(property.dependencies) !== JSON.stringify(original.dependencies) ||
            property.execution_order !== original.execution_order ||
            property.fixed !== original.fixed
          ) {
            toUpdate.push({ key, property, id: property.id! });
          }
        }
      });
      
      // Find properties to delete (but skip fixed properties)
      Object.entries(originalProperties).forEach(([key, original]) => {
        if (!currentProperties[key] && original.id && !original.fixed) {
          toDelete.push({ key, id: original.id });
        }
      });
      
      console.log('Property changes:', { toCreate, toUpdate, toDelete });
      
      // Execute property operations
      const errors: string[] = [];
      
      // Create new properties
      for (const { key, property } of toCreate) {
        try {
          const result = await callTool('create_property', {
            template_id: templateId,
            key,
            type: property.type,
            description: property.description,
            dependencies: property.dependencies,
            execution_order: property.execution_order,
            fixed: property.fixed
          });
          console.log(`Created property ${key}:`, result);
          
          // Check if the result indicates an error
          if (result?.content?.[0]?.text?.startsWith('Error:')) {
            console.error(`MCP error creating property ${key}:`, result.content[0].text);
            errors.push(`Failed to create property "${key}": ${result.content[0].text}`);
          } else {
            console.log(`Successfully created property ${key}`);
          }
        } catch (error) {
          console.error(`JavaScript error creating property ${key}:`, error);
          errors.push(`Failed to create property "${key}": ${error.message || 'Unknown error'}`);
        }
      }
      
      // Update existing properties
      for (const { key, property, id } of toUpdate) {
        try {
          const result = await callTool('update_property', {
            property_id: id,
            key,
            type: property.type,
            description: property.description,
            dependencies: property.dependencies,
            execution_order: property.execution_order,
            fixed: property.fixed
          });
          console.log(`Updated property ${key}:`, result);
          
          // Check if the result indicates an error
          if (result?.content?.[0]?.text?.startsWith('Error:')) {
            console.error(`MCP error updating property ${key}:`, result.content[0].text);
            errors.push(`Failed to update property "${key}": ${result.content[0].text}`);
          } else {
            console.log(`Successfully updated property ${key}`);
          }
        } catch (error) {
          console.error(`JavaScript error updating property ${key}:`, error);
          errors.push(`Failed to update property "${key}": ${error.message || 'Unknown error'}`);
        }
      }
      
      // Delete removed properties
      for (const { key, id } of toDelete) {
        try {
          const result = await callTool('delete_property', {
            property_id: id
          });
          console.log(`Deleted property ${key}:`, result);
          
          // Check if the result indicates an error
          if (result?.content?.[0]?.text?.startsWith('Error:')) {
            console.error(`MCP error deleting property ${key}:`, result.content[0].text);
            errors.push(`Failed to delete property "${key}": ${result.content[0].text}`);
          } else {
            console.log(`Successfully deleted property ${key}`);
          }
        } catch (error) {
          console.error(`JavaScript error deleting property ${key}:`, error);
          errors.push(`Failed to delete property "${key}": ${error.message || 'Unknown error'}`);
        }
      }
      
      if (errors.length > 0) {
        setError(`Some operations failed: ${errors.join(', ')}`);
        return;
      }
      
      // Success - refresh the properties to reflect changes
      await fetchTemplateProperties(templateId);
      
      // Show success message briefly before closing
      alert('Properties saved successfully!');
      onClose();
      
    } catch (error) {
      console.error('Error saving properties:', error);
      setError('Failed to save properties');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div style={{ width: '80vw', margin: '0 auto' }} className="bg-background rounded-lg shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-background border-b border-border p-6 flex items-center justify-between">
          <h2 className="text-2xl font-semibold">{isProjectTemplate ? "Project Template" : "Task Template"}</h2>
          <div className="flex items-center gap-2">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={handleSubmit}
              disabled={saving || loading}
              title={saving ? "Saving..." : "Save changes"}
            >
              <Save className={`h-4 w-4 ${saving ? 'animate-pulse' : ''}`} />
            </Button>
            <Button variant="ghost" size="icon" onClick={onClose} disabled={saving}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6 w-full">
          {/* Loading State */}
          {loading && (
            <div className="text-center p-4">
              <p>Loading template properties...</p>
            </div>
          )}
          
          {/* Saving State */}
          {saving && (
            <div className="text-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <p className="text-blue-700 dark:text-blue-300">Saving property changes...</p>
            </div>
          )}
          
          {/* Error State */}
          {error && (
            <div className="text-center text-red-500 p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
              <p>{error}</p>
            </div>
          )}
          
          {/* Form Blocks */}
          <div className="space-y-4 w-full">
            {formData.blocks.length === 0 && !loading && (
              <div className="text-center py-8 border-2 border-dashed border-border rounded-lg">
                <p className="text-muted-foreground mb-4">
                  {templateId ? "No properties found for this template." : "No template selected."}
                </p>
                <Button 
                  variant="outline" 
                  onClick={addNewBlock}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add First Block
                </Button>
              </div>
            )}
            <DragDropContext onDragEnd={handleDragEnd}>
              <Droppable droppableId="blocks">
                {(provided, snapshot) => (
                  <div
                    {...provided.droppableProps}
                    ref={provided.innerRef}
                    className={`space-y-4 ${snapshot.isDraggingOver ? 'bg-muted/50 rounded-lg p-2' : ''}`}
                  >
                    {formData.blocks.map((block, index) => {
                      const isExpanded = expandedBlocks.includes(index);
                      return (
                        <Draggable key={`block-${index}`} draggableId={`block-${index}`} index={index}>
                          {(provided, snapshot) => (
                            <Card 
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              className={`bg-surface border border-border w-full max-w-none relative transition-all ${
                                snapshot.isDragging ? 'shadow-lg ring-2 ring-primary/20 bg-background' : ''
                              }`}
                            >
                              <div 
                                {...provided.dragHandleProps}
                                className="absolute left-2 top-1/2 z-10 flex flex-col items-center cursor-grab active:cursor-grabbing"
                              >
                                <GripVertical className="h-4 w-4 text-muted-foreground transform -translate-y-1/2" />
                                <span className="text-xs text-muted-foreground">{block.order}</span>
                              </div>
                  <div className="absolute right-2 top-2 z-10 flex items-center gap-2">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8"
                      onClick={(e) => {
                        e.preventDefault();
                        toggleBlockExpanded(index);
                      }}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    {isExpanded && (
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8"
                        onClick={() => deleteBlock(index)}
                        disabled={properties[block.title]?.fixed}
                        title={properties[block.title]?.fixed ? "This property is fixed and cannot be deleted" : "Delete block"}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  <CardHeader className="pb-3 pl-10 pr-12">
                    {isExpanded ? (
                      <div className="flex-1">
                        <Input
                          value={block.title}
                          onChange={(e) => handleBlockUpdate(index, 'title', e.target.value)}
                          placeholder="Block title"
                          className="text-base font-semibold border-0 px-0 shadow-none focus-visible:ring-0 bg-transparent"
                        />
                      </div>
                    ) : (
                      <CardTitle className="text-base flex items-center gap-2">
                        {block.title}
                        {properties[block.title]?.fixed && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-xs bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200">
                            Fixed
                          </span>
                        )}
                      </CardTitle>
                    )}
                  </CardHeader>
                  
                  {isExpanded && (
                    <CardContent className="pt-0 pl-10">
                      <div className="space-y-4">
                        <div>
                          <label className="text-xs font-medium text-muted-foreground mb-1 block">Description</label>
                          <Textarea
                            value={block.describe}
                            onChange={(e) => handleBlockUpdate(index, 'describe', e.target.value)}
                            placeholder="Block description"
                            rows={3}
                            className="text-sm border-0 px-0 shadow-none focus-visible:ring-0 bg-transparent resize-none w-full"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="text-xs font-medium text-muted-foreground mb-1 block">Type</label>
                            <Input
                              value={block.type || ''}
                              onChange={(e) => handleBlockUpdate(index, 'type', e.target.value)}
                              placeholder="e.g., string, text, number"
                              className="text-sm border-0 px-0 shadow-none focus-visible:ring-0 bg-transparent"
                            />
                          </div>
                          <div>
                            <label className="text-xs font-medium text-muted-foreground mb-1 block">Dependencies</label>
                            <Input
                              value={block.dependencies?.join(', ') || ''}
                              onChange={(e) => handleBlockUpdate(index, 'dependencies', e.target.value.split(',').map(dep => dep.trim()).filter(Boolean))}
                              placeholder="e.g., Summary, Research"
                              className="text-sm border-0 px-0 shadow-none focus-visible:ring-0 bg-transparent"
                            />
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  )}
                  
                  {!isExpanded && (
                    <CardContent className="pt-0 pl-10">
                      <div className="space-y-2">
                        <p className="text-sm text-muted-foreground">
                          {block.describe || 'No description provided'}
                        </p>
                        {(block.type || block.dependencies?.length) && (
                          <div className="flex flex-wrap gap-2 mt-2">
                            {block.type && (
                              <span className="inline-flex items-center px-2 py-1 rounded-md text-xs bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                                Type: {block.type}
                              </span>
                            )}
                            {block.dependencies && block.dependencies.length > 0 && (
                              <span className="inline-flex items-center px-2 py-1 rounded-md text-xs bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">
                                Depends: {block.dependencies.join(', ')}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </CardContent>
                  )}
                            </Card>
                          )}
                        </Draggable>
                      );
                    })}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </DragDropContext>
            
            {/* Add New Block Button - only show when there are existing blocks */}
            {formData.blocks.length > 0 && (
              <div className="border-2 border-dashed border-border rounded-lg p-8 text-center w-full">
                <Button 
                  variant="ghost" 
                  onClick={addNewBlock}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add New Block
                </Button>
              </div>
            )}
          </div>

        </form>
      </div>
    </div>
  );
};
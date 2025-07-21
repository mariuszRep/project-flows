import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { X, GripVertical, Edit, Trash2, Plus, Save } from 'lucide-react';
import { useMCP } from '@/contexts/MCPContext';


interface TaskFormProps {
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

export const TaskForm: React.FC<TaskFormProps> = ({ isOpen, onClose, templateId }) => {
  const { callTool, isConnected } = useMCP();
  const [expandedBlocks, setExpandedBlocks] = useState<number[]>([]);
  const [properties, setProperties] = useState<Record<string, TemplateProperty>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
            .sort(([, a], [, b]) => (a.execution_order || 999) - (b.execution_order || 999))
            .map(([key, property], index) => ({
              title: key,
              describe: property.description || '',
              order: property.execution_order || index + 1,
              type: property.type || 'string',
              dependencies: property.dependencies || []
            }));
        }
        
        console.log('Converted blocks:', blocks);
        setFormData(prevData => ({
          ...prevData,
          blocks
        }));
      } else {
        console.log('No content in MCP result or result is empty');
        setProperties({});
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
    } else if (!templateId) {
      // Reset to empty state when no template is selected
      setFormData(prevData => ({
        ...prevData,
        blocks: []
      }));
      setProperties({});
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Basic validation
    if (!formData.title.trim()) {
      alert('Please enter a title');
      return;
    }
    
    // Validate blocks
    for (let i = 0; i < formData.blocks.length; i++) {
      const block = formData.blocks[i];
      if (!block.title.trim()) {
        alert(`Please enter a title for Block ${i + 1}`);
        return;
      }
    }
    
    console.log('Form submitted:', formData);
    // Here you would typically send the data to your backend
    // For now, just close the modal
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-background rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-background border-b border-border p-6 flex items-center justify-between">
          <h2 className="text-2xl font-semibold">Task Template</h2>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={handleSubmit}>
              <Save className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={onClose}>
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
          
          {/* Error State */}
          {error && (
            <div className="text-center text-red-500 p-4">
              <p>{error}</p>
            </div>
          )}
          
          {/* Template Header */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Title</label>
              <Input
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Template title"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Stage</label>
              <Input
                value={formData.stage}
                onChange={(e) => setFormData({ ...formData, stage: e.target.value })}
                placeholder="Stage"
              />
            </div>
          </div>

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
            {formData.blocks.map((block, index) => {
              const isExpanded = expandedBlocks.includes(index);
              return (
                <Card key={index} className="bg-surface border border-border w-full max-w-none relative">
                  <div className="absolute left-2 top-1/2 z-10 flex flex-col items-center">
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
                      <CardTitle className="text-base">{block.title}</CardTitle>
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
              );
            })}
            
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
import React, { useState, useEffect, useRef, useCallback } from 'react';
import MarkdownRenderer from '@/components/ui/MarkdownRenderer';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EntityPillMenu } from '@/components/ui/entity-pill-menu';
import { Input } from '@/components/ui/input';
import { AutoTextarea } from '@/components/ui/auto-textarea';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { X, Edit, MoreHorizontal, ArrowRight, Trash2, Copy, Save, XCircle, Info } from 'lucide-react';
import { useMCP } from '@/contexts/MCPContext';
import { useToast } from '@/hooks/use-toast';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

/**
 * Template ID constants for entity types
 */
export const TEMPLATE_ID = {
  TASK: 1,
  PROJECT: 2,
  EPIC: 3,
} as const;

/**
 * Entity type discriminated union
 */
export type EntityType = 'task' | 'project' | 'epic';

/**
 * Base props interface for ObjectView component
 */
interface BaseObjectViewProps {
  /** Unique identifier of the entity */
  entityId: number;
  /** Whether the modal is open/visible */
  isOpen: boolean;
  /** Callback when the modal is closed */
  onClose: () => void;
  /** Optional callback for entity deletion */
  onDelete?: (entityId: number, entityTitle: string) => void;
}

/**
 * Task-specific props interface
 */
interface TaskObjectViewProps extends BaseObjectViewProps {
  entityType: 'task';
  templateId?: typeof TEMPLATE_ID.TASK;
  /** Optional callback for task stage updates */
  onTaskUpdate?: (taskId: number, newStage: string) => void;
}

/**
 * Project-specific props interface
 */
interface ProjectObjectViewProps extends BaseObjectViewProps {
  entityType: 'project';
  templateId?: typeof TEMPLATE_ID.PROJECT;
  onTaskUpdate?: never;
}

/**
 * Epic-specific props interface
 */
interface EpicObjectViewProps extends BaseObjectViewProps {
  entityType: 'epic';
  templateId?: typeof TEMPLATE_ID.EPIC;
  onTaskUpdate?: never;
}

/**
 * Discriminated union for ObjectView props
 */
export type ObjectViewProps = TaskObjectViewProps | ProjectObjectViewProps | EpicObjectViewProps;

/**
 * View mode type for the ObjectView component
 */
type ViewMode = 'view' | 'global-edit' | 'property-edit';

interface Entity {
  id: number;
  stage?: string;
  template_id?: number;
  parent_id?: number;
  parent_name?: string;
  parent_type?: string;
  created_at?: string;
  updated_at?: string;
  created_by?: string;
  updated_by?: string;
  blocks?: Record<string, unknown>;
  title?: string;
  Title?: string;
  description?: string;
  type?: string;
  project_id?: string;
  [key: string]: unknown;
}

/**
 * ObjectView - A unified view component for tasks, projects, and epics
 * 
 * This component provides a consistent viewing experience for all entity types,
 * using template-driven property ordering and dynamic data fetching. It centralizes
 * MCP calls and provides strong TypeScript typing through discriminated unions.
 * 
 * Key Features:
 * - Template-driven rendering: Uses database templates to determine property display order
 * - Universal entity type handling: Supports tasks, projects, and epics with unified logic
 * - Centralized MCP integration: All get_object, list_properties, and list_templates calls
 * - Strong TypeScript typing: Discriminated unions prevent invalid prop combinations
 * - Epic-specific styling: Maintains epic color schemes and labels
 * - Graceful error handling: Handles missing properties, templates, and network issues
 * - Backward compatibility: API matches existing TaskView/ProjectView patterns
 * 
 * Data Flow:
 * 1. Fetches entity data via get_object with template-aware parameters
 * 2. Resolves template ID from entity data, props, or defaults
 * 3. Fetches template properties via list_properties for ordering
 * 4. Renders properties excluding meta fields, using MarkdownRenderer
 * 
 * Template ID Resolution Priority:
 * 1. entity.template_id (from fetched data)
 * 2. templateId prop (passed as parameter)
 * 3. TEMPLATE_ID constants based on entityType
 * 
 * @component
 * @example
 * ```tsx
 * // Task view
 * <ObjectView 
 *   entityType="task" 
 *   entityId={123} 
 *   isOpen={true} 
 *   onClose={handleClose} 
 *   onTaskUpdate={handleTaskUpdate}
 * />
 * 
 * // Project view
 * <ObjectView 
 *   entityType="project" 
 *   entityId={456} 
 *   isOpen={true} 
 *   onClose={handleClose} 
 * />
 * 
 * // Epic view
 * <ObjectView 
 *   entityType="epic" 
 *   entityId={789} 
 *   isOpen={true} 
 *   onClose={handleClose} 
 * />
 * ```
 */
const ObjectView: React.FC<ObjectViewProps> = ({
  entityType,
  entityId,
  isOpen,
  onClose,
  templateId: propTemplateId,
  onTaskUpdate,
  onDelete
}) => {
  const { callTool, isConnected } = useMCP();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [entity, setEntity] = useState<Entity | null>(null);
  const [orderedProperties, setOrderedProperties] = useState<string[]>([]);
  const [propertyDescriptions, setPropertyDescriptions] = useState<Record<string, string>>({});
  const [templateId, setTemplateId] = useState<number | null>(propTemplateId || null);
  const [mode, setMode] = useState<ViewMode>('view');
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const [originalValues, setOriginalValues] = useState<Record<string, string>>({});
  const [editingProperty, setEditingProperty] = useState<string | null>(null);
  const firstInputRef = useRef<HTMLInputElement>(null);
  const firstTextareaRef = useRef<HTMLTextAreaElement>(null);

  // Meta fields to exclude from rendering in body
  const META_KEYS = [
    'id', 'stage', 'parent_id', 'parent_name', 'parent_type', 'template_id',
    'created_at', 'updated_at', 'created_by', 'updated_by', 'blocks',
    'title', 'body', 'project_id', 'description', 'type', 'Title'
  ];

  // Define functions first before useEffect hooks
  const fetchTemplateProperties = useCallback(async () => {
    if (!callTool || !templateId) return;

    try {
      const result = await callTool('list_properties', { template_id: templateId });
      
      if (result?.content?.[0]?.text) {
        const properties = JSON.parse(result.content[0].text);
        
        if (Array.isArray(properties)) {
          const ordered = properties
            .sort((a, b) => {
              const orderA = a.execution_order || 999;
              const orderB = b.execution_order || 999;
              if (orderA !== orderB) return orderA - orderB;
              return (a.key || '').localeCompare(b.key || '');
            })
            .map(property => property.key);
          
          // Store property descriptions mapped by key
          const descriptions: Record<string, string> = {};
          properties.forEach(property => {
            if (property.key && property.description) {
              descriptions[property.key] = property.description;
            }
          });
          
          setOrderedProperties(ordered);
          setPropertyDescriptions(descriptions);
        }
      }
    } catch (err) {
      console.error('Error fetching template properties:', err);
      // Continue without ordered properties
    }
  }, [callTool, templateId]);

  const fetchEntityDetails = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      if (!callTool) {
        throw new Error('MCP not connected');
      }

      if (!entityId) {
        throw new Error(`No entity ID provided`);
      }

      // Determine template_id first - prioritize propTemplateId
      let effectiveTemplateId = propTemplateId || templateId;
      if (!effectiveTemplateId) {
        effectiveTemplateId = getDefaultTemplateId(entityType);
      }

      console.log(`ObjectView DEBUG: entityType=${entityType}, entityId=${entityId}, templateId=${templateId}, propTemplateId=${propTemplateId}, effectiveTemplateId=${effectiveTemplateId}`);

      // Use unified get_object tool
      const result = await callTool('get_object', {
        object_id: entityId
      });
      
      if (result && result.content && result.content[0]) {
        try {
          console.log('ObjectView DEBUG: raw result:', result.content[0].text);
          const entityData = JSON.parse(result.content[0].text);
          console.log('ObjectView DEBUG: parsed entityData:', entityData);
          setEntity(entityData);

          // Update template ID if the entity data provides one
          const derivedTemplateId = await deriveTemplateId(entityData);
          console.log('ObjectView DEBUG: derivedTemplateId:', derivedTemplateId);
          setTemplateId(derivedTemplateId);
        } catch (e) {
          console.error(`Error parsing entity JSON:`, e, 'Raw text:', result.content[0].text);
          setError(`Error parsing entity data`);
        }
      } else {
        throw new Error(`Failed to fetch entity details`);
      }
    } catch (err) {
      console.error(`Error fetching entity:`, err);
      setError(`Error: ${err instanceof Error ? err.message : `Failed to fetch entity details`}`);
    } finally {
      setIsLoading(false);
    }
  }, [callTool, entityId, entityType, propTemplateId, templateId]);

  useEffect(() => {
    if (isOpen && entityId && isConnected) {
      fetchEntityDetails();
    }
  }, [entityId, isOpen, isConnected, fetchEntityDetails]);

  useEffect(() => {
    if (entity && templateId) {
      fetchTemplateProperties();
    }
  }, [entity, templateId, fetchTemplateProperties]);

  const getDefaultTemplateId = (entityType: EntityType): number => {
    switch (entityType) {
      case 'task':
        return TEMPLATE_ID.TASK;
      case 'project':
        return TEMPLATE_ID.PROJECT;
      case 'epic':
        return TEMPLATE_ID.EPIC;
      default:
        return TEMPLATE_ID.TASK;
    }
  };

  const deriveTemplateId = async (entityData: Entity): Promise<number> => {
    // First preference: use template_id from entity data
    if (entityData.template_id) {
      return entityData.template_id;
    }

    // Second preference: use prop templateId
    if (propTemplateId) {
      return propTemplateId;
    }

    // Third preference: attempt to lookup via list_templates
    try {
      if (callTool) {
        const result = await callTool('list_templates', {});
        if (result?.content?.[0]?.text) {
          const templates = JSON.parse(result.content[0].text);
          const template = templates.find((t: { name?: string; id?: number }) => 
            t.name?.toLowerCase() === entityType.toLowerCase()
          );
          if (template?.id) {
            return template.id;
          }
        }
      }
    } catch (err) {
      console.error('Error fetching templates for fallback:', err);
    }

    // Final fallback: use constants
    return getDefaultTemplateId(entityType);
  };

  if (!isOpen) return null;

  const getEntityTitle = (): string => {
    if (!entity) return `${entityType.charAt(0).toUpperCase() + entityType.slice(1)} #${entityId}`;
    
    // Priority: blocks.Title, title, Title, fallback
    return entity.blocks?.Title || entity.title || entity.Title || `${entityType.charAt(0).toUpperCase() + entityType.slice(1)} #${entityId}`;
  };

  const getPropertiesToRender = (): string[] => {
    if (!entity) return [];

    // Get all available property names from blocks and direct properties
    const blocksProperties = entity.blocks ? Object.keys(entity.blocks) : [];
    const directProperties = Object.keys(entity).filter(key => 
      !META_KEYS.includes(key)
    );
    
    // Use ordered properties if available, otherwise use all available properties
    const propertiesToRender = orderedProperties.length > 0 
      ? orderedProperties 
      : [...new Set([...blocksProperties, ...directProperties])];
    
    return propertiesToRender.filter(propertyName => {
      // Always exclude Title and project_id from body
      if (propertyName === 'Title' || propertyName === 'project_id') return false;
      
      const blockValue = entity.blocks?.[propertyName];
      const directValue = entity[propertyName];
      return blockValue || directValue;
    });
  };

  const handleStageMove = async (newStage: string) => {
    if (!entity || !callTool) return;
    
    try {
      // Use the appropriate update tool based on entity type
      let toolName = 'update_task';
      if (entityType === 'project') {
        toolName = 'update_project';
      } else if (entityType === 'epic') {
        toolName = 'update_epic';
      }
      
      const toolPayload = {
        [`${entityType}_id`]: entity.id,
        stage: newStage
      };
      
      const result = await callTool(toolName, toolPayload);
      
      if (result) {
        toast({
          title: "Success",
          description: `${entityType.charAt(0).toUpperCase() + entityType.slice(1)} moved to ${newStage}`,
        });
        
        // For tasks, use the callback if available
        if (entityType === 'task' && onTaskUpdate) {
          onTaskUpdate(entity.id, newStage);
        } else {
          // For other entity types, refresh the data
          await fetchEntityDetails();
        }
      } else {
        toast({
          title: "Error",
          description: "Failed to update stage",
          variant: "destructive",
        });
      }
    } catch (err) {
      console.error('Error updating stage:', err);
      toast({
        title: "Error",
        description: `Failed to update stage: ${err instanceof Error ? err.message : 'Unknown error'}`,
        variant: "destructive",
      });
    }
  };

  const handleDelete = () => {
    if (onDelete && entity) {
      const entityTitle = getEntityTitle();
      onDelete(entity.id, entityTitle);
    }
  };

  const handleCopyCommand = async () => {
    // Generate appropriate command based on entity type
    let command: string;
    switch (entityType) {
      case 'task':
        command = `execute task ${entityId}`;
        break;
      case 'epic':
        command = `initiate object ${entityId}`;
        break;
      case 'project':
        command = `initiate object ${entityId}`;
        break;
      default:
        command = `execute task ${entityId}`;
    }
    
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(command);
        toast({
          title: "Copied!",
          description: `"${command}" copied to clipboard`,
        });
      } else {
        // Fallback for browsers without clipboard API
        const textArea = document.createElement('textarea');
        textArea.value = command;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        textArea.remove();
        toast({
          title: "Copied!",
          description: `"${command}" copied to clipboard`,
        });
      }
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
      toast({
        title: "Copy failed",
        description: "Failed to copy to clipboard",
        variant: "destructive",
      });
    }
  };


  const enterPropertyEditMode = (propertyName: string) => {
    if (!entity) return;

    const value = String(entity.blocks?.[propertyName] || entity[propertyName] || '');
    setEditingProperty(propertyName);
    setEditValues({ [propertyName]: value });
    setOriginalValues({ [propertyName]: value });
    setMode('property-edit');
  };

  const savePropertyEdit = async (propertyName: string) => {
    if (!entity || !callTool) return;

    try {
      const value = editValues[propertyName];
      const originalValue = originalValues[propertyName];

      if (value === originalValue) {
        // No changes to save
        exitPropertyEditMode();
        return;
      }

      // Use the appropriate update tool based on entity type
      let toolName = 'update_task';
      if (entityType === 'project') {
        toolName = 'update_project';
      } else if (entityType === 'epic') {
        toolName = 'update_epic';
      }

      const toolPayload = {
        [`${entityType}_id`]: entity.id,
        [propertyName]: value
      };

      const result = await callTool(toolName, toolPayload);

      if (result) {
        toast({
          title: "Success",
          description: `${propertyName} updated successfully`,
        });

        // Refresh the entity data
        await fetchEntityDetails();
        exitPropertyEditMode();
      } else {
        toast({
          title: "Error",
          description: "No response from update operation",
          variant: "destructive",
        });
      }
    } catch (err) {
      console.error('Error saving property change:', err);
      toast({
        title: "Error",
        description: `Failed to save changes: ${err instanceof Error ? err.message : 'Unknown error'}`,
        variant: "destructive",
      });
    }
  };

  const cancelPropertyEdit = () => {
    exitPropertyEditMode();
  };

  const exitPropertyEditMode = () => {
    setMode('view');
    setEditingProperty(null);
    setEditValues({});
    setOriginalValues({});
  };

  const enterEditMode = () => {
    if (!entity) return;
    
    const propertiesToEdit = getPropertiesToRender();
    const values: Record<string, string> = {};
    
    // Include title in edit values
    const titleValue = String(entity.blocks?.Title || entity.title || entity.Title || '');
    values['Title'] = titleValue;
    
    propertiesToEdit.forEach(propertyName => {
      const value = String(entity.blocks?.[propertyName] || entity[propertyName] || '');
      values[propertyName] = value;
    });
    
    setOriginalValues({ ...values });
    setEditValues({ ...values });
    setMode('global-edit');
    
    // Focus the first input after state update
    setTimeout(() => {
      if (firstInputRef.current) {
        firstInputRef.current.focus();
      } else if (firstTextareaRef.current) {
        firstTextareaRef.current.focus();
      }
    }, 0);
  };

  const exitEditMode = () => {
    setMode('view');
    setEditValues({});
    setOriginalValues({});
  };

  const handleCancel = () => {
    setEditValues({ ...originalValues });
    exitEditMode();
  };

  const handleSave = async () => {
    if (!entity || !callTool) return;
    
    try {
      // Prepare the update payload - only include changed values
      const updatePayload: Record<string, string> = {};
      
      Object.keys(editValues).forEach(key => {
        if (editValues[key] !== originalValues[key]) {
          updatePayload[key] = editValues[key];
        }
      });
      
      console.log('ObjectView DEBUG: Save attempt');
      console.log('  entityType:', entityType);
      console.log('  entityId:', entity.id);
      console.log('  originalValues:', originalValues);
      console.log('  editValues:', editValues);
      console.log('  updatePayload:', updatePayload);
      console.log('  hasChanges:', Object.keys(updatePayload).length > 0);
      
      if (Object.keys(updatePayload).length === 0) {
        console.log('ObjectView DEBUG: No changes to save, exiting edit mode');
        // No changes to save
        exitEditMode();
        return;
      }
      
      // Use the appropriate update tool based on entity type
      let toolName = 'update_task';
      if (entityType === 'project') {
        toolName = 'update_project';
      } else if (entityType === 'epic') {
        toolName = 'update_epic';
      }
      
      const toolPayload = {
        [`${entityType}_id`]: entity.id,
        ...updatePayload
      };
      
      console.log('ObjectView DEBUG: Calling tool');
      console.log('  toolName:', toolName);
      console.log('  toolPayload:', toolPayload);
      
      const result = await callTool(toolName, toolPayload);
      
      console.log('ObjectView DEBUG: Tool result', result);
      
      if (result && result.content && result.content[0]) {
        try {
          const toolResponse = JSON.parse(result.content[0].text);
          console.log('ObjectView DEBUG: Parsed tool response', toolResponse);
        } catch (e) {
          console.log('ObjectView DEBUG: Tool response not JSON:', result.content[0].text);
        }
      }
      
      if (result) {
        toast({
          title: "Success",
          description: `${entityType.charAt(0).toUpperCase() + entityType.slice(1)} updated successfully`,
        });
        
        // Refresh the entity data
        await fetchEntityDetails();
        exitEditMode();
      } else {
        console.error('ObjectView DEBUG: No result from tool call');
        toast({
          title: "Error",
          description: "No response from update operation",
          variant: "destructive",
        });
      }
    } catch (err) {
      console.error('ObjectView DEBUG: Error saving changes:', err);
      toast({
        title: "Error",
        description: `Failed to save changes: ${err instanceof Error ? err.message : 'Unknown error'}`,
        variant: "destructive",
      });
    }
  };

  const handleInputChange = (propertyName: string, value: string) => {
    setEditValues(prev => ({
      ...prev,
      [propertyName]: value
    }));
  };

  const renderPropertyContent = (propertyName: string, index: number) => {
    if (mode === 'global-edit' || (mode === 'property-edit' && editingProperty === propertyName)) {
      const value = editValues[propertyName] || '';
      const isLongContent = value.length > 100 || value.includes('\n');

      if (isLongContent) {
        return (
          <AutoTextarea
            ref={index === 0 && mode === 'global-edit' ? firstTextareaRef : undefined}
            value={value}
            onChange={(e) => handleInputChange(propertyName, e.target.value)}
            placeholder={`Enter ${propertyName.toLowerCase()}...`}
            minRows={2}
            className="w-full"
          />
        );
      } else {
        return (
          <Input
            ref={index === 0 && mode === 'global-edit' ? firstInputRef : undefined}
            value={value}
            onChange={(e) => handleInputChange(propertyName, e.target.value)}
            placeholder={`Enter ${propertyName.toLowerCase()}...`}
            className="w-full"
          />
        );
      }
    } else {
      return (
        <div className="prose dark:prose-invert max-w-none">
          <MarkdownRenderer content={String(entity?.blocks?.[propertyName] || entity?.[propertyName] || '')} />
        </div>
      );
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 overflow-y-auto p-4">
      <Card className="w-full max-w-3xl mx-auto">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between mb-2">
            {entity && (
              <div className="flex-1">
                <EntityPillMenu 
                  entity={entity}
                  entityType={entityType}
                  entityId={entityId}
                  templateId={templateId}
                />
              </div>
            )}
            <div className="flex gap-2 ml-4">
            {mode === 'global-edit' ? (
              <>
                <Button variant="default" size="sm" onClick={handleSave}>
                  <Save className="h-4 w-4 mr-2" />
                  Save
                </Button>
                <Button variant="outline" size="sm" onClick={handleCancel}>
                  <XCircle className="h-4 w-4 mr-2" />
                  Cancel
                </Button>
              </>
            ) : (
              <Button variant="outline" size="icon" onClick={enterEditMode} title="Edit all properties">
                <Edit className="h-4 w-4" />
              </Button>
            )}
            <Button 
              variant="outline" 
              size="icon" 
              onClick={handleCopyCommand}
              title={`Copy ${entityType === 'task' ? 'execute task' : 'initiate object'} command`}
              aria-label={`Copy ${entityType === 'task' ? 'execute task' : 'initiate object'} command`}
            >
              <Copy className="h-4 w-4" />
            </Button>
            {(entity?.stage || onDelete) && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {entity && entity.stage && (
                    <>
                      {entity.stage !== 'doing' && (
                        <DropdownMenuItem onClick={() => handleStageMove('doing')}>
                          <ArrowRight className="h-4 w-4 mr-2" />
                          Move to Doing
                        </DropdownMenuItem>
                      )}
                      {entity.stage !== 'review' && (
                        <DropdownMenuItem onClick={() => handleStageMove('review')}>
                          <ArrowRight className="h-4 w-4 mr-2" />
                          Move to Review
                        </DropdownMenuItem>
                      )}
                      {entity.stage !== 'completed' && (
                        <DropdownMenuItem onClick={() => handleStageMove('completed')}>
                          <ArrowRight className="h-4 w-4 mr-2" />
                          Move to Completed
                        </DropdownMenuItem>
                      )}
                      {entity.stage !== 'backlog' && (
                        <DropdownMenuItem onClick={() => handleStageMove('backlog')}>
                          <ArrowRight className="h-4 w-4 mr-2" />
                          Move to Backlog
                        </DropdownMenuItem>
                      )}
                    </>
                  )}
                  {onDelete && (
                    <DropdownMenuItem onClick={handleDelete} className="text-red-600">
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            <Button variant="outline" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
            </div>
          </div>
          <div 
            className={`mt-2 group relative -mx-4 px-4 py-2 border rounded-xl transition-colors duration-200 ${
              mode === 'global-edit' 
                ? 'border-border bg-muted/10' 
                : 'border-transparent hover:border-border'
            }`}
          >
            {mode === 'global-edit' ? (
              <AutoTextarea
                value={editValues['Title'] || ''}
                onChange={(e) => handleInputChange('Title', e.target.value)}
                placeholder="Enter title..."
                className="w-full text-xl font-semibold"
                minRows={1}
              />
            ) : (
              <CardTitle className="text-xl">
                {getEntityTitle()}
              </CardTitle>
            )}
          </div>
        </CardHeader>
        <CardContent className="max-h-[70vh] overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                <p className="text-muted-foreground">Loading {entityType} details...</p>
              </div>
            </div>
          ) : error ? (
            <div className="bg-red-50 border border-red-200 rounded-md p-4">
              <p className="text-red-800 text-sm">{error}</p>
            </div>
          ) : (
            <div>
              {entity && (
                <div className="space-y-4">
                  {getPropertiesToRender().map((propertyName, index) => (
                    <div
                      key={propertyName}
                      className={`group relative -mx-4 px-4 py-2 border rounded-xl transition-colors duration-200 ${
                        mode === 'global-edit' || (mode === 'property-edit' && editingProperty === propertyName)
                          ? 'border-border bg-muted/10'
                          : 'border-transparent hover:border-border'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="text-sm font-semibold">{propertyName}</h3>
                        <div className="flex items-center gap-1">
                          {mode === 'view' && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6"
                              onClick={() => enterPropertyEditMode(propertyName)}
                              title={`Edit ${propertyName}`}
                            >
                              <Edit className="h-3 w-3" />
                            </Button>
                          )}
                          {propertyDescriptions[propertyName] && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <button className="opacity-0 group-hover:opacity-100 hover:opacity-100 transition-opacity duration-200 p-1 rounded-md hover:bg-muted/50">
                                    <Info className="h-3 w-3 text-muted-foreground" />
                                  </button>
                                </TooltipTrigger>
                                <TooltipContent className="bg-surface border-border">
                                  <p className="max-w-xs text-xs">{propertyDescriptions[propertyName]}</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                        </div>
                      </div>
                      {renderPropertyContent(propertyName, index)}
                      {mode === 'property-edit' && editingProperty === propertyName && (
                        <div className="flex justify-end gap-2 mt-2">
                          <Button variant="default" size="sm" onClick={() => savePropertyEdit(propertyName)}>
                            <Save className="h-3 w-3 mr-1" />
                            Save
                          </Button>
                          <Button variant="outline" size="sm" onClick={cancelPropertyEdit}>
                            <XCircle className="h-3 w-3 mr-1" />
                            Cancel
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ObjectView;
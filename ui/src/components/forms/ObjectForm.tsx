import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import MarkdownRenderer from '@/components/ui/MarkdownRenderer';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EntityPillMenu } from '@/components/ui/entity-pill-menu';
import { Input } from '@/components/ui/input';
import { AutoTextarea } from '@/components/ui/auto-textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { X, Edit, MoreHorizontal, ArrowRight, Trash2, Copy, Save, XCircle, Info } from 'lucide-react';
import { useMCP } from '@/contexts/MCPContext';
import { useProject } from '@/contexts/ProjectContext';
import { useToast } from '@/hooks/use-toast';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

/**
 * Template ID constants for entity types
 */
export const TEMPLATE_ID = {
  TASK: 1,
  PROJECT: 2,
  EPIC: 3,
  RULE: 4,
} as const;

/**
 * Entity type discriminated union
 */
export type EntityType = 'task' | 'project' | 'epic' | 'rule';

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
 * Base props interface for ObjectView create mode
 */
interface BaseCreateObjectViewProps {
  /** Whether the modal is open/visible */
  isOpen: boolean;
  /** Callback when the modal is closed */
  onClose: () => void;
  /** Callback for successful entity creation */
  onSuccess?: (entity: any) => void;
  /** Create mode flag - when true, skips entity fetch and loads template properties */
  createMode: true;
  /** Optional initial stage for tasks */
  initialStage?: string;
}

/**
 * Task-specific props interface for view mode
 */
interface TaskObjectViewProps extends BaseObjectViewProps {
  entityType: 'task';
  templateId?: typeof TEMPLATE_ID.TASK;
  /** Optional callback for task stage updates */
  onTaskUpdate?: (taskId: number, newStage: string) => void;
  createMode?: never;
}

/**
 * Task-specific props interface for create mode
 */
interface TaskCreateObjectViewProps extends BaseCreateObjectViewProps {
  entityType: 'task';
  templateId?: typeof TEMPLATE_ID.TASK;
  /** Optional callback for task stage updates */
  onTaskUpdate?: (taskId: number, newStage: string) => void;
  entityId?: never;
}

/**
 * Project-specific props interface for view mode
 */
interface ProjectObjectViewProps extends BaseObjectViewProps {
  entityType: 'project';
  templateId?: typeof TEMPLATE_ID.PROJECT;
  onTaskUpdate?: never;
  createMode?: never;
}

/**
 * Project-specific props interface for create mode
 */
interface ProjectCreateObjectViewProps extends BaseCreateObjectViewProps {
  entityType: 'project';
  templateId?: typeof TEMPLATE_ID.PROJECT;
  onTaskUpdate?: never;
  entityId?: never;
}

/**
 * Epic-specific props interface for view mode
 */
interface EpicObjectViewProps extends BaseObjectViewProps {
  entityType: 'epic';
  templateId?: typeof TEMPLATE_ID.EPIC;
  onTaskUpdate?: never;
  createMode?: never;
}

/**
 * Epic-specific props interface for create mode
 */
interface EpicCreateObjectViewProps extends BaseCreateObjectViewProps {
  entityType: 'epic';
  templateId?: typeof TEMPLATE_ID.EPIC;
  onTaskUpdate?: never;
  entityId?: never;
}

/**
 * Rule-specific props interface for view mode
 */
interface RuleObjectViewProps extends BaseObjectViewProps {
  entityType: 'rule';
  templateId?: typeof TEMPLATE_ID.RULE;
  onTaskUpdate?: never;
  createMode?: never;
}

/**
 * Rule-specific props interface for create mode
 */
interface RuleCreateObjectViewProps extends BaseCreateObjectViewProps {
  entityType: 'rule';
  templateId?: typeof TEMPLATE_ID.RULE;
  onTaskUpdate?: never;
  entityId?: never;
}

/**
 * Discriminated union for ObjectView props
 */
export type ObjectViewProps =
  | TaskObjectViewProps
  | TaskCreateObjectViewProps
  | ProjectObjectViewProps
  | ProjectCreateObjectViewProps
  | EpicObjectViewProps
  | EpicCreateObjectViewProps
  | RuleObjectViewProps
  | RuleCreateObjectViewProps;

/**
 * View mode type for the ObjectView component
 */
type ViewMode = 'view' | 'global-edit' | 'property-edit' | 'create';

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
 * ObjectView - A unified view and create component for tasks, projects, and epics
 *
 * This component provides both viewing and creation experiences for all entity types,
 * using template-driven property ordering and dynamic data fetching. It centralizes
 * MCP calls and provides strong TypeScript typing through discriminated unions.
 *
 * Key Features:
 * - Template-driven rendering: Uses database templates to determine property display order
 * - Universal entity type handling: Supports tasks, projects, and epics with unified logic
 * - Create and view modes: Unified component for both viewing existing entities and creating new ones
 * - Centralized MCP integration: All get_object, list_properties, create_*, and update_* calls
 * - Strong TypeScript typing: Discriminated unions prevent invalid prop combinations
 * - Project selection: Task creation includes project assignment capabilities
 * - Dynamic validation: Validation based on template property definitions
 * - Graceful error handling: Handles missing properties, templates, and network issues
 *
 * Data Flow (View Mode):
 * 1. Fetches entity data via get_object with template-aware parameters
 * 2. Resolves template ID from entity data, props, or defaults
 * 3. Fetches template properties via list_properties for ordering
 * 4. Renders properties excluding meta fields, using MarkdownRenderer
 *
 * Data Flow (Create Mode):
 * 1. Skips entity fetch, uses template ID from props or defaults
 * 2. Fetches template properties via list_properties for dynamic form generation
 * 3. Initializes empty form values with defaults (stage, project_id)
 * 4. On save, calls create_task/create_project/create_epic with template-driven payload
 *
 * Template ID Resolution Priority:
 * 1. entity.template_id (from fetched data, view mode only)
 * 2. templateId prop (passed as parameter)
 * 3. TEMPLATE_ID constants based on entityType
 *
 * @component
 * @example
 * ```tsx
 * // Task view mode
 * <ObjectView
 *   entityType="task"
 *   entityId={123}
 *   isOpen={true}
 *   onClose={handleClose}
 *   onTaskUpdate={handleTaskUpdate}
 * />
 *
 * // Task create mode
 * <ObjectView
 *   entityType="task"
 *   createMode={true}
 *   isOpen={true}
 *   onClose={handleClose}
 *   onSuccess={handleTaskCreated}
 *   initialStage="draft"
 * />
 *
 * // Project create mode
 * <ObjectView
 *   entityType="project"
 *   createMode={true}
 *   isOpen={true}
 *   onClose={handleClose}
 *   onSuccess={handleProjectCreated}
 * />
 * ```
 */
const ObjectView: React.FC<ObjectViewProps> = (props) => {
  const {
    entityType,
    isOpen,
    onClose,
    templateId: propTemplateId,
    onTaskUpdate
  } = props;

  // Destructure specific props based on mode
  const entityId = 'entityId' in props ? props.entityId : undefined;
  const createMode = 'createMode' in props ? props.createMode : false;
  const onSuccess = 'onSuccess' in props ? props.onSuccess : undefined;
  const onDelete = 'onDelete' in props ? props.onDelete : undefined;
  const initialStage = 'initialStage' in props ? props.initialStage : 'draft';
  const { callTool, isConnected } = useMCP();
  const { selectedProjectId, projects, isLoadingProjects } = useProject();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [entity, setEntity] = useState<Entity | null>(null);
  const [orderedProperties, setOrderedProperties] = useState<string[]>([]);
  const [propertyDescriptions, setPropertyDescriptions] = useState<Record<string, string>>({});
  const [templateId, setTemplateId] = useState<number | null>(propTemplateId || null);
  const [mode, setMode] = useState<ViewMode>(createMode ? 'create' : 'view');
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
    if (isOpen && isConnected) {
      if (createMode) {
        // In create mode, skip entity fetch and initialize template properties
        const effectiveTemplateId = propTemplateId || getDefaultTemplateId(entityType);
        setTemplateId(effectiveTemplateId);
        setEntity(null); // No entity in create mode
      } else if (entityId) {
        fetchEntityDetails();
      }
    }
  }, [entityId, isOpen, isConnected, createMode, propTemplateId, entityType, fetchEntityDetails]);

  useEffect(() => {
    if (templateId && (entity || createMode)) {
      fetchTemplateProperties();
    }
  }, [entity, templateId, createMode, fetchTemplateProperties]);

  // Initialize create mode values after template properties are loaded
  useEffect(() => {
    if (createMode && orderedProperties.length > 0) {
      const initialValues: Record<string, string> = {};

      // Initialize all template properties with empty values
      orderedProperties.forEach(propName => {
        initialValues[propName] = '';
      });

      // Set default values for specific fields
      if (entityType === 'task') {
        // Set initial stage for tasks
        initialValues['stage'] = initialStage;
        // Set project_id from selected project if available
        if (selectedProjectId !== null) {
          initialValues['project_id'] = selectedProjectId.toString();
        }
      }

      setEditValues(initialValues);
      setOriginalValues({ ...initialValues });

      // Focus the first input after initialization
      setTimeout(() => {
        if (firstInputRef.current) {
          firstInputRef.current.focus();
        } else if (firstTextareaRef.current) {
          firstTextareaRef.current.focus();
        }
      }, 0);
    }
  }, [createMode, orderedProperties, entityType, initialStage, selectedProjectId]);

  const getDefaultTemplateId = (entityType: EntityType): number => {
    switch (entityType) {
      case 'task':
        return TEMPLATE_ID.TASK;
      case 'project':
        return TEMPLATE_ID.PROJECT;
      case 'epic':
        return TEMPLATE_ID.EPIC;
      case 'rule':
        return TEMPLATE_ID.RULE;
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
    if (createMode) {
      return editValues['Title'] || `New ${entityType.charAt(0).toUpperCase() + entityType.slice(1)}`;
    }

    if (!entity) return `${entityType.charAt(0).toUpperCase() + entityType.slice(1)} #${entityId}`;

    // Priority: blocks.Title, title, Title, fallback
    return entity.blocks?.Title || entity.title || entity.Title || `${entityType.charAt(0).toUpperCase() + entityType.slice(1)} #${entityId}`;
  };

  const getPropertiesToRender = (): string[] => {
    if (createMode) {
      // In create mode, use ordered properties from template
      return orderedProperties.filter(propertyName => {
        // Always exclude Title and project_id from body (handled separately)
        if (propertyName === 'Title' || propertyName === 'project_id') return false;

        // In create mode, show stage only for tasks (handled separately)
        if (propertyName === 'stage' && entityType === 'task') return false;

        return true;
      });
    }

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
      return blockValue !== undefined && blockValue !== null && blockValue !== '' ||
             directValue !== undefined && directValue !== null && directValue !== '';
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
      } else if (entityType === 'rule') {
        toolName = 'update_rule';
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
      case 'rule':
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
      } else if (entityType === 'rule') {
        toolName = 'update_rule';
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
    if (createMode) {
      onClose();
    } else {
      setEditValues({ ...originalValues });
      exitEditMode();
    }
  };

  const handleCreate = async () => {
    if (!callTool) return;

    try {
      // Validate required fields - Title is always required
      if (!editValues['Title']?.trim()) {
        setError('Title is required');
        return;
      }

      // Prepare the create payload from edit values
      const createPayload: Record<string, any> = {};

      // Add all template properties to the payload
      orderedProperties.forEach(propName => {
        const value = editValues[propName];
        if (value !== undefined && value !== '') {
          // Skip meta fields that are handled separately
          if (propName !== 'stage' && propName !== 'project_id') {
            createPayload[propName] = value;
          }
        }
      });

      // Handle task-specific fields
      if (entityType === 'task') {
        // Map project_id to parent_id for tasks as expected by MCP tools
        if (editValues['project_id'] && editValues['project_id'] !== '') {
          createPayload.parent_id = parseInt(editValues['project_id']);
        }
      }

      console.log(`Creating ${entityType} with data:`, createPayload);

      let result: any;
      if (entityType === 'task') {
        result = await callTool('create_task', createPayload);
      } else if (entityType === 'project') {
        result = await callTool('create_project', createPayload);
      } else if (entityType === 'epic') {
        result = await callTool('create_epic', createPayload);
      } else if (entityType === 'rule') {
        result = await callTool('create_rule', createPayload);
      }

      if (result?.content?.[0]?.text) {
        try {
          const responseData = JSON.parse(result.content[0].text);
          console.log(`${entityType} creation response:`, responseData);

          if (responseData.success) {
            toast({
              title: "Success",
              description: `${entityType.charAt(0).toUpperCase() + entityType.slice(1)} created successfully`,
            });

            // Call success callback with created entity data
            if (onSuccess) {
              const createdEntity = {
                id: responseData[`${entityType}_id`] || responseData.id,
                title: createPayload.Title,
                ...createPayload,
                stage: entityType === 'task' ? initialStage : undefined,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              };
              onSuccess(createdEntity);
            }

            onClose();
          } else {
            throw new Error(responseData.message || 'Creation failed');
          }
        } catch (parseError) {
          console.error('Error parsing create response:', parseError);
          throw new Error('Invalid response from server');
        }
      } else {
        throw new Error('No response from server');
      }
    } catch (err) {
      console.error(`Error creating ${entityType}:`, err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(`Failed to create ${entityType}: ${errorMessage}`);
      toast({
        title: "Error",
        description: `Failed to create ${entityType}: ${errorMessage}`,
        variant: "destructive",
      });
    }
  };

  const handleSave = async () => {
    if (!callTool) return;

    if (createMode) {
      return await handleCreate();
    }

    if (!entity) return;

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
      } else if (entityType === 'rule') {
        toolName = 'update_rule';
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

  // Infer the appropriate input type based on property name and description
  const inferInputType = (propertyName: string, description: string): 'input' | 'textarea' => {
    if (!description) {
      // Fallback based on common field names
      const textareaFields = ['description', 'summary', 'analysis', 'items', 'details', 'content', 'body', 'notes'];
      return textareaFields.some(field => propertyName.toLowerCase().includes(field.toLowerCase())) ? 'textarea' : 'input';
    }

    const desc = description.toLowerCase();

    // Look for keywords that suggest multi-line content
    const multiLineIndicators = [
      'list', 'describe', 'outline', 'explain', 'detail', 'steps',
      'multiple', 'several', 'examples', 'checklist', 'structure',
      'sections', 'points', 'items', 'features', 'functionalities',
      'analysis', 'summary', 'content', 'body', 'notes'
    ];

    if (multiLineIndicators.some(indicator => desc.includes(indicator))) {
      return 'textarea';
    }

    // If description mentions short/brief content, use input
    if (desc.includes('brief') || desc.includes('short') || desc.includes('single') || desc.includes('name') || desc.includes('title')) {
      return 'input';
    }

    // Default to input for short fields
    return 'input';
  };

  const renderPropertyContent = (propertyName: string, index: number) => {
    if (mode === 'create' || mode === 'global-edit' || (mode === 'property-edit' && editingProperty === propertyName)) {
      const value = editValues[propertyName] || '';

      // Determine input type based on property metadata, not current content
      const inputType = inferInputType(propertyName, propertyDescriptions[propertyName] || '');

      // Generate placeholder from property description or use default
      const placeholder = propertyDescriptions[propertyName]
        ? `Enter ${propertyDescriptions[propertyName].toLowerCase()}...`
        : `Enter ${propertyName.toLowerCase()}...`;

      if (inputType === 'textarea') {
        return (
          <AutoTextarea
            ref={index === 0 && (mode === 'create' || mode === 'global-edit') ? firstTextareaRef : undefined}
            value={value}
            onChange={(e) => handleInputChange(propertyName, e.target.value)}
            placeholder={placeholder}
            minRows={propertyName.toLowerCase().includes('items') ? 3 : 2}
            maxRows={propertyName.toLowerCase().includes('items') ? 8 : 6}
            className="w-full"
          />
        );
      } else {
        return (
          <Input
            ref={index === 0 && (mode === 'create' || mode === 'global-edit') ? firstInputRef : undefined}
            value={value}
            onChange={(e) => handleInputChange(propertyName, e.target.value)}
            placeholder={placeholder}
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

  return createPortal(
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black bg-opacity-50 overflow-y-auto p-4">
      <Card className="w-full max-w-3xl mx-auto">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between mb-2">
            {!createMode && entity && (
              <div className="flex-1">
                <EntityPillMenu
                  entity={entity}
                  entityType={entityType}
                  entityId={entityId}
                  templateId={templateId}
                />
              </div>
            )}
            {createMode && (
              <div className="flex-1">
                <h3 className="text-lg font-semibold">
                  Create New {entityType.charAt(0).toUpperCase() + entityType.slice(1)}
                </h3>
              </div>
            )}
            <div className="flex gap-2 ml-4">
            {mode === 'create' ? (
              <>
                <Button variant="default" size="sm" onClick={handleSave} disabled={!editValues['Title']?.trim()}>
                  <Save className="h-4 w-4 mr-2" />
                  Create
                </Button>
                <Button variant="outline" size="sm" onClick={handleCancel}>
                  <XCircle className="h-4 w-4 mr-2" />
                  Cancel
                </Button>
              </>
            ) : mode === 'global-edit' ? (
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
              <>
                <Button variant="outline" size="icon" onClick={enterEditMode} title="Edit all properties">
                  <Edit className="h-4 w-4" />
                </Button>
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
              </>
            )}
            <Button variant="outline" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
            </div>
          </div>
          <div
            className={`mt-2 group relative -mx-4 px-4 py-2 border rounded-xl transition-colors duration-200 ${
              mode === 'create' || mode === 'global-edit'
                ? 'border-border bg-muted/10'
                : 'border-transparent hover:border-border'
            }`}
          >
            {mode === 'create' || mode === 'global-edit' ? (
              <AutoTextarea
                value={editValues['Title'] || ''}
                onChange={(e) => handleInputChange('Title', e.target.value)}
                placeholder={createMode ? "Enter title for new " + entityType : "Enter title..."}
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
              {/* Task-specific selectors for create mode */}
              {createMode && entityType === 'task' && (
                <div className="space-y-4 mb-6">
                  {/* Stage Selector */}
                  <div className="group relative -mx-4 px-4 py-2 border rounded-xl border-border bg-muted/10">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-sm font-semibold">Stage</h3>
                    </div>
                    <Select
                      value={editValues['stage'] || initialStage}
                      onValueChange={(value) => handleInputChange('stage', value)}
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

                  {/* Project Selector */}
                  <div className="group relative -mx-4 px-4 py-2 border rounded-xl border-border bg-muted/10">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-sm font-semibold">Project</h3>
                    </div>
                    <Select
                      value={editValues['project_id'] || 'none'}
                      onValueChange={(value) => handleInputChange('project_id', value === 'none' ? '' : value)}
                      disabled={isLoadingProjects}
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
                  </div>
                </div>
              )}

              {(entity || createMode) && (
                <div className="space-y-4">
                  {getPropertiesToRender().map((propertyName, index) => (
                    <div
                      key={propertyName}
                      className={`group relative -mx-4 px-4 py-2 border rounded-xl transition-colors duration-200 ${
                        mode === 'create' || mode === 'global-edit' || (mode === 'property-edit' && editingProperty === propertyName)
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
                          {mode === 'property-edit' && editingProperty === propertyName && (
                            <>
                              <Button variant="default" size="sm" onClick={() => savePropertyEdit(propertyName)} className="h-6">
                                <Save className="h-3 w-3 mr-1" />
                                Save
                              </Button>
                              <Button variant="outline" size="sm" onClick={cancelPropertyEdit} className="h-6">
                                <XCircle className="h-3 w-3 mr-1" />
                                Cancel
                              </Button>
                            </>
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
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>,
    document.body
  );
};

export default ObjectView;
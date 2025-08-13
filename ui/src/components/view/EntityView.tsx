import React, { useState, useEffect } from 'react';
import MarkdownRenderer from '@/components/ui/MarkdownRenderer';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { X, Edit, Calendar } from 'lucide-react';
import { useMCP } from '@/contexts/MCPContext';

/**
 * Props interface for EntityView component
 */
interface EntityViewProps {
  /** Type of entity to display - either 'task' or 'project' */
  entityType: 'task' | 'project';
  /** Unique identifier of the entity */
  entityId: number;
  /** Whether the modal is open/visible */
  isOpen: boolean;
  /** Callback when the modal is closed */
  onClose: () => void;
  /** Callback when the edit button is clicked */
  onEdit: () => void;
  /** Optional template ID override. If not provided, will be derived from entity data or defaults */
  templateId?: number;
}

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
  blocks?: Record<string, any>;
  title?: string;
  Title?: string;
  description?: string;
  type?: string;
  project_id?: string;
  [key: string]: any;
}


/**
 * EntityView - A unified read-only viewer component for both tasks and projects
 * 
 * This component provides a consistent viewing experience for both task and project entities,
 * using template-driven property ordering and dynamic data fetching. It serves as the core
 * viewer that both TaskView and ProjectView wrapper components utilize.
 * 
 * Key Features:
 * - Template-driven rendering: Uses database templates to determine property display order
 * - Dynamic entity type handling: Adapts UI elements based on task vs project
 * - Intelligent template ID resolution: Prefers entity data, falls back to MCP lookup or defaults
 * - Graceful error handling: Handles missing properties, templates, and network issues
 * - Consistent UI/UX: Same modal layout, hover effects, and interaction patterns for both entity types
 * 
 * Data Flow:
 * 1. Fetches entity data via get_task or get_project based on entityType
 * 2. Derives template ID from entity data or uses fallback logic
 * 3. Fetches template properties via list_properties for ordering
 * 4. Renders properties excluding meta fields, using MarkdownRenderer
 * 
 * Template ID Resolution Priority:
 * 1. entity.template_id (from fetched data)
 * 2. propTemplateId (passed as prop)
 * 3. list_templates lookup by entity type name
 * 4. Hardcoded fallback: task=1, project=2
 * 
 * @component
 * @example
 * ```tsx
 * // Used via TaskView wrapper
 * <TaskView taskId={123} isOpen={true} onClose={handleClose} onEdit={handleEdit} />
 * 
 * // Used via ProjectView wrapper  
 * <ProjectView projectId={456} isOpen={true} onClose={handleClose} onEdit={handleEdit} />
 * 
 * // Direct usage (not recommended - use wrappers instead)
 * <EntityView 
 *   entityType="task" 
 *   entityId={123} 
 *   isOpen={true} 
 *   onClose={handleClose} 
 *   onEdit={handleEdit}
 *   templateId={1} 
 * />
 * ```
 */
const EntityView: React.FC<EntityViewProps> = ({
  entityType,
  entityId,
  isOpen,
  onClose,
  onEdit,
  templateId: propTemplateId
}) => {
  const { callTool, isConnected } = useMCP();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [entity, setEntity] = useState<Entity | null>(null);
  const [orderedProperties, setOrderedProperties] = useState<string[]>([]);
  const [templateId, setTemplateId] = useState<number | null>(propTemplateId || null);

  // Meta fields to exclude from rendering in body
  const META_KEYS = [
    'id', 'stage', 'parent_id', 'parent_name', 'parent_type', 'template_id',
    'created_at', 'updated_at', 'created_by', 'updated_by', 'blocks',
    'title', 'body', 'project_id', 'description', 'type', 'Title'
  ];

  useEffect(() => {
    if (isOpen && entityId && isConnected) {
      fetchEntityDetails();
    }
  }, [entityId, isOpen, isConnected]);

  useEffect(() => {
    if (entity && templateId) {
      fetchTemplateProperties();
    }
  }, [entity, templateId]);

  const deriveTemplateId = async (entityData: Entity): Promise<number> => {
    // First preference: use template_id from entity data
    if (entityData.template_id) {
      return entityData.template_id;
    }

    // Second preference: use prop templateId
    if (propTemplateId) {
      return propTemplateId;
    }

    // Fallback: determine by entity type - attempt to lookup via list_templates
    try {
      if (callTool) {
        const result = await callTool('list_templates', {});
        if (result?.content?.[0]?.text) {
          const templates = JSON.parse(result.content[0].text);
          const template = templates.find((t: any) => 
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

    // Final fallback: hardcoded mapping
    return entityType === 'task' ? 1 : 2;
  };

  const fetchTemplateProperties = async () => {
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
          
          setOrderedProperties(ordered);
        }
      }
    } catch (err) {
      console.error('Error fetching template properties:', err);
      // Continue without ordered properties
    }
  };

  const fetchEntityDetails = async () => {
    setIsLoading(true);
    setError(null);

    try {
      if (!callTool) {
        throw new Error('MCP not connected');
      }

      if (!entityId) {
        throw new Error(`No ${entityType} ID provided`);
      }

      // Get entity data based on type
      const toolName = entityType === 'task' ? 'get_task' : 'get_project';
      const paramKey = entityType === 'task' ? 'task_id' : 'project_id';
      
      const result = await callTool(toolName, {
        [paramKey]: entityId
      });
      
      if (result && result.content && result.content[0]) {
        try {
          const entityData = JSON.parse(result.content[0].text);
          setEntity(entityData);

          // Derive template ID for this entity
          const derivedTemplateId = await deriveTemplateId(entityData);
          setTemplateId(derivedTemplateId);
        } catch (e) {
          console.error(`Error parsing ${entityType} JSON:`, e);
          setError(`Error parsing ${entityType} data`);
        }
      } else {
        throw new Error(`Failed to fetch ${entityType} details`);
      }
    } catch (err) {
      console.error(`Error fetching ${entityType}:`, err);
      setError(`Error: ${err instanceof Error ? err.message : `Failed to fetch ${entityType} details`}`);
    } finally {
      setIsLoading(false);
    }
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 overflow-y-auto p-4">
      <Card className="w-full max-w-3xl mx-auto">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>
            {getEntityTitle()}
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
                <div className="mb-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="outline" className="text-xs">
                      #{entityId}
                    </Badge>
                    {/* Stage badge only for tasks */}
                    {entityType === 'task' && entity.stage && (
                      <Badge 
                        className={`
                          ${entity.stage === 'draft' ? 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200' : ''}
                          ${entity.stage === 'backlog' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' : ''}
                          ${entity.stage === 'doing' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' : ''}
                          ${entity.stage === 'review' ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200' : ''}
                          ${entity.stage === 'completed' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : ''}
                        `}
                      >
                        {entity.stage.charAt(0).toUpperCase() + entity.stage.slice(1)}
                      </Badge>
                    )}
                    {/* Project badge for tasks */}
                    {entityType === 'task' && entity.parent_name && (
                      <Badge variant="outline" className="text-xs">
                        Project: {entity.parent_name}
                      </Badge>
                    )}
                    {/* Entity type badge for projects */}
                    {entityType === 'project' && (
                      <Badge variant="outline" className="text-xs bg-green-50 text-green-700 dark:bg-green-900 dark:text-green-300">
                        Project
                      </Badge>
                    )}
                    {entity.created_at && (
                      <div className="text-xs text-muted-foreground flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {new Date(entity.created_at).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                </div>
              )}
              {entity && (
                <div className="space-y-4">
                  {getPropertiesToRender().map((propertyName) => (
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
                        <MarkdownRenderer content={String(entity.blocks?.[propertyName] || entity[propertyName] || '')} />
                      </div>
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

export default EntityView;
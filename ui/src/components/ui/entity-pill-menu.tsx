import React from 'react';
import { KeyValuePill } from '@/components/ui/key-value-pill';

interface Entity {
  id: number;
  stage?: string;
  template_id?: number;
  parent_id?: number;
  parent_name?: string;
  parent_type?: string;
  created_at?: string;
  updated_at?: string;
  type?: string;
  [key: string]: any;
}

interface EntityPillMenuProps {
  entity: Entity;
  entityType: 'task' | 'project' | 'epic';
  entityId: number;
  templateId?: number | null;
  stages?: { key: string; title: string; color: string }[];
}

const TEMPLATE_ID = {
  TASK: 1,
  PROJECT: 2,
  EPIC: 3,
} as const;

export const EntityPillMenu: React.FC<EntityPillMenuProps> = ({
  entity,
  entityType,
  entityId,
  templateId,
  stages
}) => {
  const getDefaultTemplateId = (entityType: 'task' | 'project' | 'epic'): number => {
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

  const effectiveTemplateId = templateId || getDefaultTemplateId(entityType);
  
  // Default stage colors if not provided
  const defaultStages = [
    { key: 'draft', title: 'Draft', color: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200' },
    { key: 'backlog', title: 'Backlog', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' },
    { key: 'doing', title: 'Doing', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' },
    { key: 'review', title: 'Review', color: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200' },
    { key: 'completed', title: 'Completed', color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' }
  ];

  const effectiveStages = stages || defaultStages;

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {(() => {
        // Assign distinct gradient-derived colors for entity type pill
        // This matches exactly the implementation from unified-entity-card.tsx lines 213-220
        let typePrimary: string | undefined;
        if (effectiveTemplateId === TEMPLATE_ID.TASK || entity?.type === 'Task') {
          typePrimary = 'hsl(var(--gradient-from))';
        } else if (effectiveTemplateId === TEMPLATE_ID.PROJECT || entity?.type === 'Project') {
          typePrimary = 'hsl(var(--gradient-via))';
        } else if (effectiveTemplateId === TEMPLATE_ID.EPIC || entity?.type === 'Epic') {
          typePrimary = 'hsl(var(--gradient-to))';
        }
        
        // Determine entity type label
        let typeLabel = 'Entity';
        if (effectiveTemplateId === TEMPLATE_ID.TASK || entity?.type === 'Task') {
          typeLabel = 'Task';
        } else if (effectiveTemplateId === TEMPLATE_ID.PROJECT || entity?.type === 'Project') {
          typeLabel = 'Project';
        } else if (effectiveTemplateId === TEMPLATE_ID.EPIC || entity?.type === 'Epic') {
          typeLabel = 'Epic';
        }
        
        return (
          <KeyValuePill 
            keyName={typeLabel} 
            value={`${entityId}`} 
            size="sm" 
            primaryColor={typePrimary}
            secondaryColor={'hsl(var(--surface))'}
          />
        );
      })()}
      {entity.stage && (
        <KeyValuePill 
          keyName="Stage" 
          value={effectiveStages.find(s => s.key === entity.stage)?.title || entity.stage} 
          size="sm" 
        />
      )}
      {entity.parent_id && (
        <KeyValuePill 
          keyName="parent" 
          value={`${entity.parent_id}`} 
          size="sm" 
        />
      )}
      {entity.created_at && (
        <KeyValuePill 
          keyName="created" 
          value={new Date(entity.created_at).toLocaleDateString()} 
          size="sm" 
        />
      )}
    </div>
  );
};
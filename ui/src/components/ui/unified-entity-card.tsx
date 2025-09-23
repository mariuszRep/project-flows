import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { KeyValuePill } from '@/components/ui/key-value-pill';
import { TaskStage } from '@/types/task';
import { UnifiedEntity } from '@/types/unified-entity';
import MarkdownRenderer from '@/components/ui/MarkdownRenderer';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { useSlidable } from '@/hooks/use-slidable';
import { useDraggable, UseDraggableConfig } from '@/hooks/use-draggable';


interface UnifiedEntityCardProps {
  entity: UnifiedEntity;
  onStageChange?: (entityId: number, newStage: TaskStage) => void;
  onDoubleClick?: (entityId?: number) => void;
  getStageColor?: (stage: TaskStage) => string;
  stages?: { key: TaskStage; title: string; color: string }[];
  getPreviousStage?: (currentStage: TaskStage) => TaskStage;
  getNextStage?: (currentStage: TaskStage) => TaskStage;
  enableSliding?: boolean;
  selectedStages?: TaskStage[];
  onTaskDoubleClick?: (taskId: number) => void;
  level?: number;
  enableDragging?: boolean;
  dragConfig?: UseDraggableConfig;
}

export const UnifiedEntityCard: React.FC<UnifiedEntityCardProps> = ({
  entity,
  onStageChange,
  onDoubleClick,
  getStageColor,
  stages,
  getPreviousStage,
  getNextStage,
  enableSliding = false,
  selectedStages = [],
  onTaskDoubleClick,
  level = 0,
  enableDragging = false,
  dragConfig,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  // Use the dragging functionality hook if enabled
  const draggable = enableDragging && dragConfig ? useDraggable(dragConfig) : null;
  
  // Use the sliding functionality hook
  const slidable = useSlidable({
    onStageChange,
    getPreviousStage,
    getNextStage,
    entityId: entity.id,
    currentStage: entity.stage,
    threshold: 100,
    enableSliding: enableSliding && !enableDragging, // Disable sliding when dragging is enabled
    getStageColor,
    stages
  });

  // Default stage colors if not provided
  const defaultStageColor = (stage: TaskStage) => {
    switch (stage) {
      case 'draft':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
      case 'backlog':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'doing':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'review':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
      case 'completed':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const defaultStages = [
    { key: 'draft' as TaskStage, title: 'Draft', color: defaultStageColor('draft') },
    { key: 'backlog' as TaskStage, title: 'Backlog', color: defaultStageColor('backlog') },
    { key: 'doing' as TaskStage, title: 'Doing', color: defaultStageColor('doing') },
    { key: 'review' as TaskStage, title: 'Review', color: defaultStageColor('review') },
    { key: 'completed' as TaskStage, title: 'Completed', color: defaultStageColor('completed') }
  ];

  const effectiveStages = stages || defaultStages;

  // Filter children: apply stage filter to tasks, always include Epics/Projects
  const filteredChildren = (entity.children || []).filter(child => {
    if (child.type === 'Task' && child.stage && selectedStages.length > 0) {
      return selectedStages.includes(child.stage);
    }
    return true;
  });

  // Calculate progress for Epic/Project cards
  const childTasks = (entity.children || []).filter(child => child.type === 'Task');
  const completedChildTasks = childTasks.filter(task => task.stage === 'completed');
  const totalChildTasks = childTasks.length;
  const progress = totalChildTasks > 0 ? (completedChildTasks.length / totalChildTasks) * 100 : 0;

  // Unified appearance - no visual distinction between entity types
  const getCardVariantClasses = () => {
    return ''; // All entities have identical appearance
  };

  const hasChildren = entity.children && entity.children.length > 0;
  const showExpandToggle = (entity.type === 'Epic' || entity.type === 'Project') && hasChildren;

  // Helper function to render the slide indicator
  const renderSlideIndicator = () => {
    const indicator = slidable.getSlideIndicator();
    if (!indicator) return null;

    const isRight = indicator.direction === 'right';
    const positionClass = isRight ? 'right-2' : 'left-2';
    const opacityClass = indicator.willTrigger ? 'opacity-100' : 'opacity-50';
    const arrow = isRight ? '→' : '←';

    return (
      <div className={`absolute ${positionClass} top-1/2 transform -translate-y-1/2 transition-opacity duration-200 ${opacityClass}`}>
        <Badge className={`${indicator.className} text-xs`}>
          {arrow} {indicator.stageTitle}
        </Badge>
      </div>
    );
  };

  // Determine if we're using drag or slide mode
  const isDragMode = enableDragging && draggable;
  const isSlideMode = !enableDragging;

  return (
    <div 
      ref={isDragMode ? draggable.innerRef : undefined}
      {...(isDragMode ? draggable.draggableProps : {})}
      {...(isDragMode ? draggable.dragHandleProps : {})}
      className={`relative ${isDragMode ? draggable.dragClassName : ''}`}
      style={{
        ...(isDragMode ? draggable.dragStyle : {}),
        ...(isSlideMode ? slidable.styles : {}),
        marginLeft: level > 0 ? level * 12 : 0,
        marginRight: level > 0 ? level * 12 : 0,
      }}
      onMouseDown={isSlideMode ? slidable.handleMouseDown : undefined}
      onTouchStart={isSlideMode ? slidable.handleTouchStart : undefined}
      onTouchMove={isSlideMode ? slidable.handleTouchMove : undefined}
      onTouchEnd={isSlideMode ? slidable.handleTouchEnd : undefined}
    >
      <Card 
        className={`card-hover w-full select-none cursor-grab active:cursor-grabbing ${
          slidable.isUpdating ? 'opacity-60' : ''
        } ${slidable.isSliding ? 'shadow-lg' : ''} ${isDragMode && draggable?.isDragging ? 'shadow-xl ring-2 ring-primary ring-opacity-50' : ''} ${getCardVariantClasses()}`}
      >
        <CardContent 
          className="p-4 w-full cursor-pointer"
          onDoubleClick={() => {
            if (entity.type === 'Task' && onTaskDoubleClick) {
              onTaskDoubleClick(entity.id);
            } else if (onDoubleClick) {
              onDoubleClick(entity.id);
            }
          }}
        >
          <div className="flex items-center justify-between w-full">
            <div className="flex-1 min-w-0">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold mb-2">
                    {entity.title}
                  </h3>
                  {entity.summary && (
                    <div className="line-clamp-2 text-sm text-muted-foreground prose dark:prose-invert max-w-none prose-p:mb-0 prose-headings:mb-0 prose-headings:mt-0 prose-lists:mb-0">
                      <MarkdownRenderer content={entity.summary} />
                    </div>
                  )}
                </div>
              </div>
              
              {/* Progress bar for Epic/Project cards - always show if has child tasks */}
              {(entity.type === 'Epic' || entity.type === 'Project') && totalChildTasks > 0 && (
                <div className="mt-4">
                  <div className="w-full bg-border rounded-full h-1.5">
                    <div 
                      className="h-1.5 rounded-full transition-all duration-300 bg-gradient-to-r from-[hsl(var(--gradient-from))] via-[hsl(var(--gradient-via))] to-[hsl(var(--gradient-to))]" 
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              )}
              
              <div className="flex items-center gap-2 mt-4 flex-wrap">
                {(() => {
                  // Assign distinct gradient-derived colors for entity type pill
                  let typePrimary: string | undefined;
                  if (entity.type === 'Task') {
                    typePrimary = 'hsl(var(--gradient-from))';
                  } else if (entity.type === 'Project') {
                    typePrimary = 'hsl(var(--gradient-via))';
                  } else if (entity.type === 'Epic') {
                    typePrimary = 'hsl(var(--gradient-to))';
                  }
                  return (
                    <KeyValuePill 
                      keyName={entity.type} 
                      value={`${entity.id}`} 
                      size="sm" 
                      primaryColor={typePrimary}
                      secondaryColor={'hsl(var(--surface))'}
                    />
                  );
                })()}
                {entity.stage && (
                  <KeyValuePill keyName="Stage" value={effectiveStages.find(s => s.key === entity.stage)?.title || entity.stage} size="sm" />
                )}
                {entity.parent_id && (
                  <KeyValuePill keyName="parent" value={`${entity.parent_id}`} size="sm" />
                )}
                {entity.created_at && (
                  <KeyValuePill keyName="created" value={new Date(entity.created_at).toLocaleDateString()} size="sm" />
                )}
                {entity.updated_at && (
                  <KeyValuePill keyName="updated" value={new Date(entity.updated_at).toLocaleDateString()} size="sm" />
                )}
                <div className="flex-1"></div>
                {showExpandToggle && (
                  <button 
                    className="flex items-center gap-1 px-2 py-1 text-xs bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground rounded-md transition-colors"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsExpanded(!isExpanded);
                    }}
                  >
                    <span>{completedChildTasks.length} / {totalChildTasks}</span>
                    {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  </button>
                )}
              </div>
            </div>
          </div>
        </CardContent>
        
        {/* Expanded children section */}
        {isExpanded && showExpandToggle && (
          <div className="bg-muted/30">
            <div className="border-t border-border mx-4"></div>
            <div className="px-4 py-3 space-y-2">
              {filteredChildren.length > 0 ? (
                filteredChildren.map(child => {
                  // Render all children using UnifiedEntityCard recursively
                  return (
                    <UnifiedEntityCard
                      key={`child-entity-${child.id}`}
                      entity={child}
                      onStageChange={onStageChange}
                      onDoubleClick={onDoubleClick}
                      getStageColor={getStageColor}
                      stages={stages}
                      getPreviousStage={getPreviousStage}
                      getNextStage={getNextStage}
                      enableSliding={false}
                      selectedStages={selectedStages}
                      onTaskDoubleClick={onTaskDoubleClick}
                      level={level + 1}
                    />
                  );
                })
              ) : (
                <p className="text-center text-muted-foreground py-2 text-sm">
                  No child tasks match the current filters.
                </p>
              )}
            </div>
          </div>
        )}
        
        {/* Slide indicator overlay */}
        {!enableDragging && slidable.isSliding && renderSlideIndicator()}
      </Card>
      
      {/* Loading overlay */}
      {slidable.isUpdating && (
        <div className="absolute inset-0 bg-background/50 flex items-center justify-center rounded-lg">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
        </div>
      )}
    </div>
  );
};

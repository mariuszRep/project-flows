import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { KeyValuePill } from '@/components/ui/key-value-pill';
import { TaskStage } from '@/types/task';
import { UnifiedEntity } from '@/types/unified-entity';
import MarkdownRenderer from '@/components/ui/MarkdownRenderer';
import { ChevronDown, ChevronRight } from 'lucide-react';


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
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isSliding, setIsSliding] = useState(false);
  const [slideX, setSlideX] = useState(0);
  const [isUpdating, setIsUpdating] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const startX = useRef(0);
  const currentX = useRef(0);
  const isDragging = useRef(false);

  const THRESHOLD = 100; // Minimum pixels to trigger stage change

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
  const effectiveGetStageColor = getStageColor || defaultStageColor;

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

  // Sliding logic - enabled for any entity that has a stage
  const canSlide = !!(
    enableSliding &&
    entity.stage &&
    onStageChange &&
    getPreviousStage &&
    getNextStage
  );

  const handleStart = (clientX: number) => {
    if (!canSlide || isUpdating) return;
    startX.current = clientX;
    currentX.current = clientX;
    isDragging.current = true;
    setIsSliding(true);
  };

  const handleMove = (clientX: number) => {
    if (!isDragging.current || isUpdating || !canSlide) return;
    
    currentX.current = clientX;
    const deltaX = clientX - startX.current;
    setSlideX(deltaX);
  };

  const handleEnd = async () => {
    if (!isDragging.current || isUpdating || !canSlide || !entity.stage) return;
    
    const deltaX = currentX.current - startX.current;
    const absDistance = Math.abs(deltaX);
    
    if (absDistance > THRESHOLD && onStageChange) {
      setIsUpdating(true);
      
      try {
        if (deltaX > 0) {
          // Slide right - next stage
          const nextStage = getNextStage!(entity.stage);
          if (nextStage !== entity.stage) {
            await onStageChange(entity.id, nextStage);
          }
        } else {
          // Slide left - previous stage
          const prevStage = getPreviousStage!(entity.stage);
          if (prevStage !== entity.stage) {
            await onStageChange(entity.id, prevStage);
          }
        }
      } catch (error) {
        console.error('Error updating entity stage:', error);
      } finally {
        setIsUpdating(false);
      }
    }
    
    // Reset state
    isDragging.current = false;
    setIsSliding(false);
    setSlideX(0);
  };

  // Mouse events
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!canSlide) return;
    e.preventDefault();
    handleStart(e.clientX);
  };

  const handleMouseMove = (e: MouseEvent) => {
    handleMove(e.clientX);
  };

  const handleMouseUp = () => {
    handleEnd();
  };

  // Touch events
  const handleTouchStart = (e: React.TouchEvent) => {
    if (!canSlide || e.touches.length !== 1) return;
    handleStart(e.touches[0].clientX);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!canSlide || e.touches.length !== 1) return;
    handleMove(e.touches[0].clientX);
  };

  const handleTouchEnd = () => {
    handleEnd();
  };

  // Effect to handle mouse events on document
  useEffect(() => {
    if (isDragging.current) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isSliding]);

  // Calculate visual feedback for sliding
  const getSlideDirection = () => {
    if (Math.abs(slideX) < 20) return null;
    return slideX > 0 ? 'right' : 'left';
  };

  const getSlideOpacity = () => {
    const distance = Math.abs(slideX);
    if (distance < 20) return 1;
    return Math.max(0.7, 1 - (distance / 200));
  };

  const getSlideIndicator = () => {
    const direction = getSlideDirection();
    if (!direction || Math.abs(slideX) < 30 || !entity.stage || !getPreviousStage || !getNextStage) return null;
    
    const willTrigger = Math.abs(slideX) > THRESHOLD;
    
    if (direction === 'right') {
      const nextStage = getNextStage(entity.stage);
      if (nextStage === entity.stage) return null;
      
      return (
        <div className={`absolute right-2 top-1/2 transform -translate-y-1/2 transition-opacity duration-200 ${
          willTrigger ? 'opacity-100' : 'opacity-50'
        }`}>
          <Badge className={`${effectiveGetStageColor(nextStage)} text-xs`}>
            → {effectiveStages.find(s => s.key === nextStage)?.title}
          </Badge>
        </div>
      );
    } else {
      const prevStage = getPreviousStage(entity.stage);
      if (prevStage === entity.stage) return null;
      
      return (
        <div className={`absolute left-2 top-1/2 transform -translate-y-1/2 transition-opacity duration-200 ${
          willTrigger ? 'opacity-100' : 'opacity-50'
        }`}>
          <Badge className={`${effectiveGetStageColor(prevStage)} text-xs`}>
            ← {effectiveStages.find(s => s.key === prevStage)?.title}
          </Badge>
        </div>
      );
    }
  };

  const hasChildren = entity.children && entity.children.length > 0;
  const showExpandToggle = (entity.type === 'Epic' || entity.type === 'Project') && hasChildren;

  return (
    <div 
      ref={cardRef}
      className="relative"
      style={{
        transform: isSliding ? `translateX(${slideX}px)` : 'translateX(0)',
        opacity: isSliding ? getSlideOpacity() : 1,
        transition: isSliding ? 'none' : 'transform 0.2s ease-out, opacity 0.2s ease-out',
        marginLeft: level > 0 ? level * 12 : 0,
      }}
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <Card 
        className={`card-hover w-full select-none ${
          isUpdating ? 'opacity-60' : ''
        } ${isSliding ? 'shadow-lg' : ''} ${getCardVariantClasses()}`}
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
            <div className="flex-1 min-w-0 pr-4">
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
                {showExpandToggle && (
                  <div className="flex items-center space-x-4 ml-4">
                    <span className="text-sm text-muted-foreground whitespace-nowrap">
                      {completedChildTasks.length} / {totalChildTasks} tasks
                    </span>
                    <button 
                      className="text-muted-foreground hover:text-foreground transition-colors"
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsExpanded(!isExpanded);
                      }}
                    >
                      {isExpanded ? <ChevronDown className="h-6 w-6" /> : <ChevronRight className="h-6 w-6" />}
                    </button>
                  </div>
                )}
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
              </div>
            </div>
          </div>
        </CardContent>
        
        {/* Expanded children section */}
        {isExpanded && showExpandToggle && (
          <div className="bg-muted/30 border-t border-border">
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
        {isSliding && getSlideIndicator()}
      </Card>
      
      {/* Loading overlay */}
      {isUpdating && (
        <div className="absolute inset-0 bg-background/50 flex items-center justify-center rounded-lg">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
        </div>
      )}
    </div>
  );
};

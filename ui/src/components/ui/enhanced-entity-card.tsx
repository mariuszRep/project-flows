import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { KeyValuePill } from '@/components/ui/key-value-pill';
import { Button } from '@/components/ui/button';
import { TaskStage } from '@/types/task';
import { UnifiedEntity } from '@/types/unified-entity';
import MarkdownRenderer from '@/components/ui/MarkdownRenderer';
import { TaskItem } from '@/components/ui/task-item';
import { ChevronDown, ChevronRight } from 'lucide-react';

interface EnhancedEntityCardProps {
  entity: UnifiedEntity;
  onStageChange?: (entityId: number, newStage: TaskStage) => void;
  onDoubleClick?: (entityId: number) => void;
  getStageColor?: (stage: TaskStage) => string;
  stages?: { key: TaskStage; title: string; color: string }[];
  getPreviousStage?: (currentStage: TaskStage) => TaskStage;
  getNextStage?: (currentStage: TaskStage) => TaskStage;
  enableSliding?: boolean;
  selectedStages?: TaskStage[];
  onTaskDoubleClick?: (taskId: number) => void;
  level?: number;
}

export const EnhancedEntityCard: React.FC<EnhancedEntityCardProps> = ({
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

  const THRESHOLD = 100;

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

  // Visual distinction for Epics/Projects vs Tasks
  const getCardVariantClasses = () => {
    switch (entity.type) {
      case 'Epic':
        return 'border-l-4 border-violet-500/70 dark:border-violet-400/70 bg-violet-50/40 dark:bg-violet-950/20';
      case 'Project':
        return 'border-l-4 border-emerald-500/70 dark:border-emerald-400/70 bg-emerald-50/40 dark:bg-emerald-950/20';
      default:
        return '';
    }
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
          const nextStage = getNextStage!(entity.stage);
          if (nextStage !== entity.stage) {
            await onStageChange(entity.id, nextStage);
          }
        } else {
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
    
    isDragging.current = false;
    setIsSliding(false);
    setSlideX(0);
  };

  // Mouse and touch events (same as UnifiedEntityCard)
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

  useEffect(() => {
    if (isDragging.current) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isSliding, handleMouseMove, handleMouseUp]);

  // Get type pill color - Epic and Project use same color for consistency
  const getTypePillColor = () => {
    switch (entity.type) {
      case 'Task':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'Project':
      case 'Epic':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  // Get slide direction and opacity (same as UnifiedEntityCard)
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
          onDoubleClick={() => onDoubleClick && onDoubleClick(entity.id)}
        >
          <div className="flex items-center justify-between w-full">
            <div className="flex-1 min-w-0 pr-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="flex items-center gap-2">
                  <KeyValuePill keyName={entity.type.toLowerCase()} value={`${entity.id}`} size="sm" />
                </div>
                {/* Stage badge only shown if entity has a stage */}
                {entity.stage && (
                  <Badge variant="secondary" className={`flex-shrink-0 ${effectiveGetStageColor(entity.stage)}`}>
                    {effectiveStages.find(s => s.key === entity.stage)?.title || entity.stage}
                  </Badge>
                )}
              </div>
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
                  <div className="w-full bg-muted rounded-full h-1.5">
                    <div 
                      className="bg-primary h-1.5 rounded-full transition-all duration-300" 
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </CardContent>
        
        {/* Expanded children section */}
        {isExpanded && showExpandToggle && (
          <div className="bg-muted/30 border-t border-border">
            <div className="px-4 py-3 space-y-2">
              {filteredChildren.length > 0 ? (
                filteredChildren.map(child => {
                  if (child.type === 'Task') {
                    return (
                      <TaskItem
                        key={`child-task-${child.id}`}
                        task={child}
                        getStageColor={effectiveGetStageColor}
                        stages={effectiveStages}
                        onDoubleClick={() => onTaskDoubleClick && onTaskDoubleClick(child.id)}
                      />
                    );
                  }
                  // Render nested Epic/Project cards recursively
                  return (
                    <EnhancedEntityCard
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

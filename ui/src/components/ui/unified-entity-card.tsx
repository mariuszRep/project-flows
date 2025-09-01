import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TaskStage } from '@/types/task';
import MarkdownRenderer from '@/components/ui/MarkdownRenderer';

interface UnifiedEntity {
  id: number;
  title: string;
  summary?: string;
  stage?: TaskStage;
  type: 'Task' | 'Project' | 'Epic';
  template_id?: number;
  parent_id?: number;
  created_at?: string;
  updated_at?: string;
}

interface UnifiedEntityCardProps {
  entity: UnifiedEntity;
  onStageChange?: (entityId: number, newStage: TaskStage) => void;
  onDoubleClick: () => void;
  getStageColor?: (stage: TaskStage) => string;
  stages?: { key: TaskStage; title: string; color: string }[];
  getPreviousStage?: (currentStage: TaskStage) => TaskStage;
  getNextStage?: (currentStage: TaskStage) => TaskStage;
  enableSliding?: boolean;
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
}) => {
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

  return (
    <div 
      ref={cardRef}
      className="relative"
      style={{
        transform: isSliding ? `translateX(${slideX}px)` : 'translateX(0)',
        opacity: isSliding ? getSlideOpacity() : 1,
        transition: isSliding ? 'none' : 'transform 0.2s ease-out, opacity 0.2s ease-out',
      }}
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <Card 
        className={`card-hover w-full cursor-pointer select-none ${
          isUpdating ? 'opacity-60' : ''
        } ${isSliding ? 'shadow-lg' : ''}`}
        onDoubleClick={onDoubleClick}
      >
        <CardContent className="p-4 w-full">
          <div className="flex items-center justify-between w-full">
            <div className="flex-1 min-w-0 pr-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground text-sm">#{entity.id}</span>
                  <Badge variant="outline" className={`text-xs ${getTypePillColor()}`}>
                    {entity.type}
                  </Badge>
                </div>
                {/* Stage badge only shown if entity has a stage */}
                {entity.stage && (
                  <Badge variant="secondary" className={`flex-shrink-0 ${effectiveGetStageColor(entity.stage)}`}>
                    {effectiveStages.find(s => s.key === entity.stage)?.title || entity.stage}
                  </Badge>
                )}
              </div>
              <h3 className="text-lg font-semibold truncate mb-2">
                {entity.title}
              </h3>
              {entity.summary && (
                <div className="line-clamp-2 text-sm text-muted-foreground prose dark:prose-invert max-w-none prose-p:mb-0 prose-headings:mb-0 prose-headings:mt-0 prose-lists:mb-0">
                  <MarkdownRenderer content={entity.summary} />
                </div>
              )}
            </div>
          </div>
        </CardContent>
        
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

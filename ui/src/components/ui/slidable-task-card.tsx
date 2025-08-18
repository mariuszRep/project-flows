import React, { useState, useRef, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Task, TaskStage } from '@/types/task';
import MarkdownRenderer from '@/components/ui/MarkdownRenderer';

interface SlidableTaskCardProps {
  task: Task;
  onStageChange: (taskId: number, newStage: TaskStage) => void;
  onDoubleClick: () => void;
  getStageColor: (stage: TaskStage) => string;
  stages: { key: TaskStage; title: string; color: string }[];
  getPreviousStage: (currentStage: TaskStage) => TaskStage;
  getNextStage: (currentStage: TaskStage) => TaskStage;
}

export const SlidableTaskCard: React.FC<SlidableTaskCardProps> = ({
  task,
  onStageChange,
  onDoubleClick,
  getStageColor,
  stages,
  getPreviousStage,
  getNextStage,
}) => {
  const [isSliding, setIsSliding] = useState(false);
  const [slideX, setSlideX] = useState(0);
  const [isUpdating, setIsUpdating] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const startX = useRef(0);
  const currentX = useRef(0);
  const isDragging = useRef(false);

  const THRESHOLD = 100; // Minimum pixels to trigger stage change

  const handleStart = (clientX: number) => {
    if (isUpdating) return;
    startX.current = clientX;
    currentX.current = clientX;
    isDragging.current = true;
    setIsSliding(true);
  };

  const handleMove = (clientX: number) => {
    if (!isDragging.current || isUpdating) return;
    
    currentX.current = clientX;
    const deltaX = clientX - startX.current;
    setSlideX(deltaX);
  };

  const handleEnd = async () => {
    if (!isDragging.current || isUpdating) return;
    
    const deltaX = currentX.current - startX.current;
    const absDistance = Math.abs(deltaX);
    
    if (absDistance > THRESHOLD) {
      setIsUpdating(true);
      
      try {
        if (deltaX > 0) {
          // Slide right - next stage
          const nextStage = getNextStage(task.stage);
          if (nextStage !== task.stage) {
            await onStageChange(task.id, nextStage);
          }
        } else {
          // Slide left - previous stage
          const prevStage = getPreviousStage(task.stage);
          if (prevStage !== task.stage) {
            await onStageChange(task.id, prevStage);
          }
        }
      } catch (error) {
        console.error('Error updating task stage:', error);
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
    if (e.touches.length === 1) {
      handleStart(e.touches[0].clientX);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      handleMove(e.touches[0].clientX);
    }
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

  // Calculate visual feedback
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
    if (!direction || Math.abs(slideX) < 30) return null;
    
    const willTrigger = Math.abs(slideX) > THRESHOLD;
    
    if (direction === 'right') {
      const nextStage = getNextStage(task.stage);
      if (nextStage === task.stage) return null;
      
      return (
        <div className={`absolute right-2 top-1/2 transform -translate-y-1/2 transition-opacity duration-200 ${
          willTrigger ? 'opacity-100' : 'opacity-50'
        }`}>
          <Badge className={`${getStageColor(nextStage)} text-xs`}>
            → {stages.find(s => s.key === nextStage)?.title}
          </Badge>
        </div>
      );
    } else {
      const prevStage = getPreviousStage(task.stage);
      if (prevStage === task.stage) return null;
      
      return (
        <div className={`absolute left-2 top-1/2 transform -translate-y-1/2 transition-opacity duration-200 ${
          willTrigger ? 'opacity-100' : 'opacity-50'
        }`}>
          <Badge className={`${getStageColor(prevStage)} text-xs`}>
            ← {stages.find(s => s.key === prevStage)?.title}
          </Badge>
        </div>
      );
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
                <CardTitle className="text-lg font-semibold truncate">
                  <span className="text-muted-foreground">#{task.id}</span> {task.title}
                </CardTitle>
                <Badge variant="secondary" className={`flex-shrink-0 ${getStageColor(task.stage)}`}>
                  {stages.find(s => s.key === task.stage)?.title}
                </Badge>
              </div>
              {task.body && (
                <div className="line-clamp-2 text-sm text-muted-foreground prose dark:prose-invert max-w-none prose-p:mb-0 prose-headings:mb-0 prose-headings:mt-0 prose-lists:mb-0">
                  <MarkdownRenderer content={task.body} />
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
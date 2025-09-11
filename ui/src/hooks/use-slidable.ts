import { useState, useRef, useEffect } from 'react';
import { TaskStage } from '@/types/task';

export interface SlidableConfig {
  onStageChange?: (entityId: number, newStage: TaskStage) => void;
  getPreviousStage?: (currentStage: TaskStage) => TaskStage;
  getNextStage?: (currentStage: TaskStage) => TaskStage;
  entityId: number;
  currentStage?: TaskStage;
  threshold?: number;
  enableSliding?: boolean;
  getStageColor?: (stage: TaskStage) => string;
  stages?: { key: TaskStage; title: string; color: string }[];
}

export interface SlidableState {
  isSliding: boolean;
  slideX: number;
  isUpdating: boolean;
}

export interface SlidableHandlers {
  handleMouseDown: (e: React.MouseEvent) => void;
  handleTouchStart: (e: React.TouchEvent) => void;
  handleTouchMove: (e: React.TouchEvent) => void;
  handleTouchEnd: () => void;
}

export interface SlidableIndicator {
  direction: 'left' | 'right';
  stage: TaskStage;
  stageTitle: string;
  className: string;
  willTrigger: boolean;
}

export interface SlidableHelpers {
  getSlideDirection: () => 'left' | 'right' | null;
  getSlideOpacity: () => number;
  getSlideIndicator: () => SlidableIndicator | null;
}

export interface SlidableStyles {
  transform: string;
  opacity: number;
  transition: string;
}

export interface SlidableReturn extends SlidableState, SlidableHandlers, SlidableHelpers {
  canSlide: boolean;
  styles: SlidableStyles;
}

export const useSlidable = (config: SlidableConfig): SlidableReturn => {
  const {
    onStageChange,
    getPreviousStage,
    getNextStage,
    entityId,
    currentStage,
    threshold = 100,
    enableSliding = false,
    getStageColor,
    stages = []
  } = config;

  const [isSliding, setIsSliding] = useState(false);
  const [slideX, setSlideX] = useState(0);
  const [isUpdating, setIsUpdating] = useState(false);
  
  const startX = useRef(0);
  const currentX = useRef(0);
  const isDragging = useRef(false);

  // Determine if sliding is possible
  const canSlide = !!(
    enableSliding &&
    currentStage &&
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
    if (!isDragging.current || isUpdating || !canSlide || !currentStage) return;
    
    const deltaX = currentX.current - startX.current;
    const absDistance = Math.abs(deltaX);
    
    if (absDistance > threshold && onStageChange) {
      setIsUpdating(true);
      
      try {
        if (deltaX > 0) {
          // Slide right - next stage
          const nextStage = getNextStage!(currentStage);
          if (nextStage !== currentStage) {
            await onStageChange(entityId, nextStage);
          }
        } else {
          // Slide left - previous stage
          const prevStage = getPreviousStage!(currentStage);
          if (prevStage !== currentStage) {
            await onStageChange(entityId, prevStage);
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

  // Helper functions
  const getSlideDirection = (): 'left' | 'right' | null => {
    if (Math.abs(slideX) < 20) return null;
    return slideX > 0 ? 'right' : 'left';
  };

  const getSlideOpacity = (): number => {
    const distance = Math.abs(slideX);
    if (distance < 20) return 1;
    return Math.max(0.7, 1 - (distance / 200));
  };

  const getSlideIndicator = () => {
    const direction = getSlideDirection();
    if (!direction || Math.abs(slideX) < 30 || !currentStage || !getPreviousStage || !getNextStage) return null;
    
    const willTrigger = Math.abs(slideX) > threshold;

    // Default stage color function
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

    const effectiveGetStageColor = getStageColor || defaultStageColor;
    
    if (direction === 'right') {
      const nextStage = getNextStage(currentStage);
      if (nextStage === currentStage) return null;
      
      return {
        direction: 'right' as const,
        stage: nextStage,
        stageTitle: stages.find(s => s.key === nextStage)?.title || nextStage,
        className: effectiveGetStageColor(nextStage),
        willTrigger
      };
    } else {
      const prevStage = getPreviousStage(currentStage);
      if (prevStage === currentStage) return null;
      
      return {
        direction: 'left' as const,
        stage: prevStage,
        stageTitle: stages.find(s => s.key === prevStage)?.title || prevStage,
        className: effectiveGetStageColor(prevStage),
        willTrigger
      };
    }
  };

  // Calculate styles for the sliding element
  const styles: SlidableStyles = {
    transform: isSliding ? `translateX(${slideX}px)` : 'translateX(0)',
    opacity: isSliding ? getSlideOpacity() : 1,
    transition: isSliding ? 'none' : 'transform 0.2s ease-out, opacity 0.2s ease-out'
  };

  return {
    // State
    isSliding,
    slideX,
    isUpdating,
    canSlide,
    
    // Handlers
    handleMouseDown,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    
    // Helpers
    getSlideDirection,
    getSlideOpacity,
    getSlideIndicator,
    
    // Styles
    styles
  };
};
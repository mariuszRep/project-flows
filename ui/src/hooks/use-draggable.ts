import { CSSProperties } from 'react';
import { DraggableProvided, DraggableStateSnapshot } from 'react-beautiful-dnd';

export interface UseDraggableConfig {
  provided: DraggableProvided;
  snapshot: DraggableStateSnapshot;
}

export interface UseDraggableReturn {
  // Individual props to be applied to drag wrapper
  innerRef: DraggableProvided['innerRef'];
  draggableProps: DraggableProvided['draggableProps'];
  dragHandleProps: DraggableProvided['dragHandleProps'];
  dragClassName: string;
  dragStyle: CSSProperties;
  
  // State for the dragged component
  isDragging: boolean;
  
  // Additional drag state info
  dragInfo: {
    isDraggingOver: boolean;
    draggingOverWith?: string;
  };
}

export const useDraggable = (config: UseDraggableConfig): UseDraggableReturn => {
  const { provided, snapshot } = config;

  // Generate the wrapper classes for drag transformation
  const getDragWrapperClass = (): string => {
    const baseClasses = 'transition-transform';
    const dragClasses = snapshot.isDragging ? 'rotate-2 scale-105' : '';
    return `${baseClasses} ${dragClasses}`.trim();
  };

  return {
    innerRef: provided.innerRef,
    draggableProps: {
      ...provided.draggableProps,
      style: undefined, // We'll handle style separately to avoid conflicts
    },
    dragHandleProps: provided.dragHandleProps,
    dragClassName: getDragWrapperClass(),
    dragStyle: provided.draggableProps.style || {},
    isDragging: snapshot.isDragging,
    dragInfo: {
      isDraggingOver: snapshot.isDraggingOver,
      draggingOverWith: snapshot.draggingOverWith,
    },
  };
};
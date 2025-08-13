import React from 'react';
import EntityView from '@/components/view/EntityView';

/**
 * Props interface for TaskView component
 */
interface TaskViewProps {
  /** ID of the task to display */
  taskId: number;
  /** Whether the modal is open/visible */
  isOpen: boolean;
  /** Callback when the modal is closed */
  onClose: () => void;
  /** Callback when the edit button is clicked */
  onEdit: () => void;
}

/**
 * TaskView - A wrapper component for viewing tasks using EntityView
 * 
 * This component provides a task-specific interface to the unified EntityView component.
 * It maintains backward compatibility with existing TaskView usage throughout the application
 * while leveraging the new unified viewing system.
 * 
 * Features:
 * - Displays task data with stage badges and project context
 * - Uses task template (templateId=1) for property ordering
 * - Maintains existing TaskView API for seamless migration
 * - Template-driven property rendering with fallback support
 * 
 * @component
 * @example
 * ```tsx
 * <TaskView 
 *   taskId={123} 
 *   isOpen={isViewOpen} 
 *   onClose={() => setIsViewOpen(false)} 
 *   onEdit={() => setIsEditOpen(true)} 
 * />
 * ```
 */
const TaskView: React.FC<TaskViewProps> = ({
  taskId,
  isOpen,
  onClose,
  onEdit
}) => {
  return (
    <EntityView
      entityType="task"
      entityId={taskId}
      isOpen={isOpen}
      onClose={onClose}
      onEdit={onEdit}
      templateId={1}
    />
  );
};

export default TaskView;
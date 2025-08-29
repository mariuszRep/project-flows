import React from 'react';
import EntityView from '@/components/view/EntityView';

/**
 * Props interface for EpicView component
 */
interface EpicViewProps {
  /** ID of the epic to display */
  epicId: number;
  /** Whether the modal is open/visible */
  isOpen: boolean;
  /** Callback when the modal is closed */
  onClose: () => void;
  /** Callback when the edit button is clicked */
  onEdit: () => void;
  /** Optional callback for epic stage updates */
  onEpicUpdate?: (epicId: number, newStage: string) => void;
  /** Optional callback for epic deletion */
  onDelete?: (epicId: number, epicTitle: string) => void;
}

/**
 * EpicView - A wrapper component for viewing epics using EntityView
 * 
 * This component provides an epic-specific interface to the unified EntityView component.
 * It follows the same patterns as TaskView but for Epic entities, providing consistent
 * viewing experience across the three-level hierarchy (Project → Epic → Task).
 * 
 * Features:
 * - Displays epic data with stage badges and project context
 * - Uses epic template (templateId=3) for property ordering
 * - Supports epic stage management through dropdown actions
 * - Template-driven property rendering with fallback support
 * - Integrates with MCP object tools for Epic CRUD operations
 * 
 * @component
 * @example
 * ```tsx
 * <EpicView 
 *   epicId={456} 
 *   isOpen={isViewOpen} 
 *   onClose={() => setIsViewOpen(false)} 
 *   onEdit={() => setIsEditOpen(true)} 
 *   onEpicUpdate={handleEpicStageUpdate}
 * />
 * ```
 */
const EpicView: React.FC<EpicViewProps> = ({
  epicId,
  isOpen,
  onClose,
  onEdit,
  onEpicUpdate,
  onDelete
}) => {
  return (
    <EntityView
      entityType="epic"
      entityId={epicId}
      isOpen={isOpen}
      onClose={onClose}
      onEdit={onEdit}
      templateId={3}
      onTaskUpdate={onEpicUpdate}
      onDelete={onDelete}
    />
  );
};

export default EpicView;
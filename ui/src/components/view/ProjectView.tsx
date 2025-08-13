import React from 'react';
import EntityView from '@/components/view/EntityView';

/**
 * Props interface for ProjectView component
 */
interface ProjectViewProps {
  /** ID of the project to display */
  projectId: number;
  /** Whether the modal is open/visible */
  isOpen: boolean;
  /** Callback when the modal is closed */
  onClose: () => void;
  /** Callback when the edit button is clicked */
  onEdit: () => void;
}

/**
 * ProjectView - A wrapper component for viewing projects using EntityView
 * 
 * This component provides a project-specific interface to the unified EntityView component.
 * It enables read-only viewing of project details with template-driven property ordering
 * and consistent UI/UX matching the task viewing experience.
 * 
 * Features:
 * - Displays project data with project badge (no stage badges)
 * - Uses project template (templateId=2) for property ordering
 * - Shows all project template fields (Description, Features, Stack, Architecture, Structure, etc.)
 * - Template-driven property rendering with fallback support
 * - Consistent modal layout and interaction patterns
 * 
 * @component
 * @example
 * ```tsx
 * <ProjectView 
 *   projectId={456} 
 *   isOpen={isViewOpen} 
 *   onClose={() => setIsViewOpen(false)} 
 *   onEdit={() => setIsEditOpen(true)} 
 * />
 * ```
 */
const ProjectView: React.FC<ProjectViewProps> = ({
  projectId,
  isOpen,
  onClose,
  onEdit
}) => {
  return (
    <EntityView
      entityType="project"
      entityId={projectId}
      isOpen={isOpen}
      onClose={onClose}
      onEdit={onEdit}
      templateId={2}
    />
  );
};

export default ProjectView;
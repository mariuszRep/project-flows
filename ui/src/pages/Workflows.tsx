import { useState } from 'react';
import { HeaderAndSidebarLayout } from '@/components/layout/HeaderAndSidebarLayout';
import { useSession } from '@/contexts/SessionContext';
import { useNavigate } from 'react-router-dom';
import { WorkflowSideMenu } from '@/components/workflows/WorkflowSideMenu';
import { WorkflowCanvas } from '@/components/workflows/WorkflowCanvas';

export default function Workflows() {
  const navigate = useNavigate();
  const { selectedSession } = useSession();
  
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<number | null>(null);
  const [sidebarRefreshTrigger, setSidebarRefreshTrigger] = useState(0);

  const handleSettingsClick = () => {
    navigate('/settings');
  };

  const handleCreateNew = () => {
    // TODO: Implement workflow creation
    console.log('Create workflow clicked');
  };

  const handleWorkflowSelect = (workflowId: number | null) => {
    setSelectedWorkflowId(workflowId);
  };

  // Placeholder props for HeaderAndSidebarLayout
  const placeholderProps = {
    selectedSession: selectedSession,
    titleInput: '',
    editingTitle: false,
    setTitleInput: () => {},
    setEditingTitle: () => {},
    handleUpdateTitle: () => {},
    refreshSessions: () => {},
  };

  // TODO: Implement create/edit workflow functionality later

  return (
    <HeaderAndSidebarLayout
      {...placeholderProps}
      onSettingsClick={handleSettingsClick}
      fullWidth={true}
      sidebarContent={
        <WorkflowSideMenu
          selectedWorkflowId={selectedWorkflowId}
          onWorkflowSelect={handleWorkflowSelect}
          onCreateWorkflow={handleCreateNew}
          refreshTrigger={sidebarRefreshTrigger}
          isCollapsed={false}
        />
      }
    >
      <div className="h-[calc(100vh-8rem)]">
        <WorkflowCanvas workflowId={selectedWorkflowId} />
      </div>
    </HeaderAndSidebarLayout>
  );
}

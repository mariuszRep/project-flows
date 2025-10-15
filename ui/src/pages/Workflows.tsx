import { useState } from 'react';
import { HeaderAndSidebarLayout } from '@/components/layout/HeaderAndSidebarLayout';
import { useSession } from '@/contexts/SessionContext';
import { useNavigate } from 'react-router-dom';
import { WorkflowSideMenu } from '@/components/workflows/WorkflowSideMenu';
import { WorkflowCanvas } from '@/components/workflows/WorkflowCanvas';
import { useMCP } from '@/contexts/MCPContext';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

export default function Workflows() {
  const navigate = useNavigate();
  const { selectedSession } = useSession();
  const { callTool, isConnected } = useMCP();
  const { toast } = useToast();

  const [selectedWorkflowId, setSelectedWorkflowId] = useState<number | null>(null);
  const [sidebarRefreshTrigger, setSidebarRefreshTrigger] = useState(0);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newWorkflowName, setNewWorkflowName] = useState('');
  const [newWorkflowDescription, setNewWorkflowDescription] = useState('');

  const handleSettingsClick = () => {
    navigate('/settings');
  };

  const handleCreateNew = () => {
    setNewWorkflowName('');
    setNewWorkflowDescription('');
    setIsCreateDialogOpen(true);
  };

  const handleCreateWorkflow = async () => {
    if (!newWorkflowName.trim() || !callTool) return;

    setIsCreating(true);
    try {
      const result = await callTool('create_template', {
        name: newWorkflowName.trim(),
        description: newWorkflowDescription.trim() || 'A new workflow',
        type: 'workflow',
        metadata: {
          enabled: false,
          mcp_tool_name: newWorkflowName.toLowerCase().replace(/\s+/g, '_'),
          input_schema: {
            type: 'object',
            properties: {},
            required: []
          }
        }
      });

      if (result && result.content && result.content[0]) {
        const text = result.content[0].text;
        const match = text.match(/ID (\d+)/);
        if (match) {
          const newId = parseInt(match[1]);
          setSelectedWorkflowId(newId);
          setSidebarRefreshTrigger(prev => prev + 1);
          setIsCreateDialogOpen(false);

          toast({
            title: "Workflow Created",
            description: `"${newWorkflowName}" has been created successfully.`,
          });
        }
      }
    } catch (error) {
      console.error('Error creating workflow:', error);
      toast({
        title: "Creation Failed",
        description: "Failed to create workflow. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
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
    <>
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

      {/* Create Workflow Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Workflow</DialogTitle>
            <DialogDescription>
              Create a new workflow template. You can add steps and configure it after creation.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="workflow-name">Name *</Label>
              <Input
                id="workflow-name"
                placeholder="My Workflow"
                value={newWorkflowName}
                onChange={(e) => setNewWorkflowName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newWorkflowName.trim()) {
                    handleCreateWorkflow();
                  }
                }}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="workflow-description">Description</Label>
              <Textarea
                id="workflow-description"
                placeholder="Describe what this workflow does..."
                value={newWorkflowDescription}
                onChange={(e) => setNewWorkflowDescription(e.target.value)}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsCreateDialogOpen(false)}
              disabled={isCreating}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateWorkflow}
              disabled={!newWorkflowName.trim() || isCreating || !isConnected}
            >
              {isCreating ? 'Creating...' : 'Create Workflow'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

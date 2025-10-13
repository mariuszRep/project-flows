import { useState, useEffect } from 'react';
import { HeaderAndSidebarLayout } from '@/components/layout/HeaderAndSidebarLayout';
import { useSession } from '@/contexts/SessionContext';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { workflowStorageService, WorkflowDefinition } from '@/services/workflowStorageService';
import { WorkflowEditor } from '@/components/workflows/WorkflowEditor';
import { Plus, Play, Trash2, Edit, GitBranch, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const MCP_SERVER_URL = import.meta.env.VITE_MCP_SERVER_URL || 'http://localhost:3001';

export default function Workflows() {
  const navigate = useNavigate();
  const { selectedSession } = useSession();
  const { toast } = useToast();
  
  const [workflows, setWorkflows] = useState<WorkflowDefinition[]>([]);
  const [selectedWorkflow, setSelectedWorkflow] = useState<WorkflowDefinition | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [workflowToDelete, setWorkflowToDelete] = useState<string | null>(null);
  const [registeredWorkflows, setRegisteredWorkflows] = useState<Set<string>>(new Set());
  const [registeringWorkflow, setRegisteringWorkflow] = useState<string | null>(null);

  // Load workflows from localStorage on mount
  useEffect(() => {
    loadWorkflows();
  }, []);

  const loadWorkflows = () => {
    const loaded = workflowStorageService.loadAllWorkflows();
    setWorkflows(loaded);
  };

  const handleSettingsClick = () => {
    navigate('/settings');
  };

  const handleCreateNew = () => {
    setSelectedWorkflow(null);
    setIsCreating(true);
    setIsEditing(false);
  };

  const handleEdit = (workflow: WorkflowDefinition) => {
    setSelectedWorkflow(workflow);
    setIsEditing(true);
    setIsCreating(false);
  };

  const handleSave = (workflow: WorkflowDefinition) => {
    try {
      workflowStorageService.saveWorkflow(workflow);
      loadWorkflows();
      setIsCreating(false);
      setIsEditing(false);
      setSelectedWorkflow(null);
      
      toast({
        title: 'Success',
        description: `Workflow '${workflow.name}' saved successfully`,
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: (error as Error).message,
        variant: 'destructive',
      });
    }
  };

  const handleCancel = () => {
    setIsCreating(false);
    setIsEditing(false);
    setSelectedWorkflow(null);
  };

  const handleDelete = (name: string) => {
    setWorkflowToDelete(name);
  };

  const confirmDelete = () => {
    if (workflowToDelete) {
      const success = workflowStorageService.deleteWorkflow(workflowToDelete);
      if (success) {
        loadWorkflows();
        // Also unregister from MCP server if registered
        if (registeredWorkflows.has(workflowToDelete)) {
          unregisterWorkflow(workflowToDelete);
        }
        toast({
          title: 'Success',
          description: `Workflow '${workflowToDelete}' deleted successfully`,
        });
      } else {
        toast({
          title: 'Error',
          description: 'Failed to delete workflow',
          variant: 'destructive',
        });
      }
      setWorkflowToDelete(null);
    }
  };

  const registerWorkflow = async (workflow: WorkflowDefinition) => {
    setRegisteringWorkflow(workflow.name);
    try {
      const response = await fetch(`${MCP_SERVER_URL}/api/workflows`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(workflow),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Server error (${response.status}): ${text}`);
      }

      const data = await response.json();

      if (data.success) {
        setRegisteredWorkflows(prev => new Set(prev).add(workflow.name));
        toast({
          title: 'Success',
          description: `Workflow '${workflow.name}' registered with MCP server`,
        });
      } else {
        throw new Error(data.error || 'Failed to register workflow');
      }
    } catch (error) {
      console.error('Registration error:', error);
      toast({
        title: 'Error',
        description: `Failed to register workflow: ${(error as Error).message}`,
        variant: 'destructive',
      });
    } finally {
      setRegisteringWorkflow(null);
    }
  };

  const unregisterWorkflow = async (name: string) => {
    try {
      const response = await fetch(`${MCP_SERVER_URL}/api/workflows/${name}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (data.success) {
        setRegisteredWorkflows(prev => {
          const newSet = new Set(prev);
          newSet.delete(name);
          return newSet;
        });
        toast({
          title: 'Success',
          description: `Workflow '${name}' unregistered from MCP server`,
        });
      } else {
        throw new Error(data.error || 'Failed to unregister workflow');
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: `Failed to unregister workflow: ${(error as Error).message}`,
        variant: 'destructive',
      });
    }
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

  if (isCreating || isEditing) {
    return (
      <HeaderAndSidebarLayout {...placeholderProps} onSettingsClick={handleSettingsClick}>
        <div className="flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">
                {isCreating ? 'Create Workflow' : 'Edit Workflow'}
              </h1>
              <p className="text-muted-foreground">
                Define a custom MCP tool using JSON workflow steps
              </p>
            </div>
          </div>

          <WorkflowEditor
            workflow={selectedWorkflow}
            onSave={handleSave}
            onCancel={handleCancel}
          />
        </div>
      </HeaderAndSidebarLayout>
    );
  }

  return (
    <HeaderAndSidebarLayout {...placeholderProps} onSettingsClick={handleSettingsClick}>
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Workflows</h1>
            <p className="text-muted-foreground">
              Create and manage dynamic MCP workflow tools
            </p>
          </div>
          <Button onClick={handleCreateNew}>
            <Plus className="w-4 h-4 mr-2" />
            Create Workflow
          </Button>
        </div>

        {workflows.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <GitBranch className="w-12 h-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No workflows yet</h3>
              <p className="text-muted-foreground text-center mb-4">
                Create your first workflow to get started with dynamic MCP tools
              </p>
              <Button onClick={handleCreateNew}>
                <Plus className="w-4 h-4 mr-2" />
                Create Workflow
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {workflows.map((workflow) => {
              const isRegistered = registeredWorkflows.has(workflow.name);
              const isRegistering = registeringWorkflow === workflow.name;

              return (
                <Card key={workflow.name} className="card-hover">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="flex items-center gap-2">
                          <GitBranch className="w-4 h-4" />
                          {workflow.name}
                        </CardTitle>
                        <CardDescription className="mt-2">
                          {workflow.description}
                        </CardDescription>
                      </div>
                      {isRegistered && (
                        <Badge variant="default" className="ml-2">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          Registered
                        </Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-col gap-2">
                      <div className="text-sm text-muted-foreground">
                        {workflow.steps.length} step{workflow.steps.length !== 1 ? 's' : ''}
                      </div>
                      <div className="flex gap-2 mt-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEdit(workflow)}
                        >
                          <Edit className="w-3 h-3 mr-1" />
                          Edit
                        </Button>
                        {isRegistered ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => unregisterWorkflow(workflow.name)}
                            disabled={isRegistering}
                          >
                            <XCircle className="w-3 h-3 mr-1" />
                            Unregister
                          </Button>
                        ) : (
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() => registerWorkflow(workflow)}
                            disabled={isRegistering}
                          >
                            {isRegistering ? (
                              <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                            ) : (
                              <Play className="w-3 h-3 mr-1" />
                            )}
                            Register
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDelete(workflow.name)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="w-3 h-3 mr-1" />
                          Delete
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <AlertDialog open={workflowToDelete !== null} onOpenChange={() => setWorkflowToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Workflow</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete '{workflowToDelete}'? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </HeaderAndSidebarLayout>
  );
}

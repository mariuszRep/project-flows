import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Plus, GitBranch } from 'lucide-react';
import { useMCP } from '@/contexts/MCPContext';

interface Workflow {
  id: number;
  name: string;
  description: string;
}

interface WorkflowSidebarProps {
  isCollapsed: boolean;
  selectedWorkflowId?: number | null;
  onWorkflowSelect: (workflowId: number | null) => void;
  onCreateWorkflow: () => void;
  refreshTrigger?: number;
}

export function WorkflowSideMenu({ 
  isCollapsed, 
  selectedWorkflowId, 
  onWorkflowSelect, 
  onCreateWorkflow,
  refreshTrigger 
}: WorkflowSidebarProps) {
  const { callTool, isConnected, tools } = useMCP();
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Set up change event listeners for real-time updates
  // TODO: Add template change events when available
  // const { } = useChangeEvents({
  //   onTemplateChanged: () => {
  //     console.log('Template changed event received in WorkflowSidebar, refreshing workflows');
  //     fetchWorkflows();
  //   }
  // });

  // Fetch workflows from templates table (type='workflow')
  const fetchWorkflows = async () => {
    if (!isConnected || !callTool || tools.length === 0) {
      setWorkflows([]);
      return;
    }

    setIsLoading(true);
    try {
      const listTemplates = tools.find(tool => tool.name === 'list_templates');
      
      if (listTemplates) {
        const result = await callTool('list_templates', {});
        if (result && result.content && result.content[0]) {
          const contentText = result.content[0].text;
          
          // Handle "No templates found." response
          if (contentText === 'No templates found.' || contentText.includes('No templates')) {
            setWorkflows([]);
            return;
          }
          
          try {
            const jsonResponse = JSON.parse(contentText);
            
            // The response is an array of templates directly
            if (Array.isArray(jsonResponse)) {
              // Filter only workflow type templates
              const workflowTemplates = jsonResponse
                .filter((template: any) => template.type === 'workflow')
                .map((template: any) => ({
                  id: template.id,
                  name: template.name || 'Untitled Workflow',
                  description: template.description || ''
                }));
              
              setWorkflows(workflowTemplates);
            } else {
              setWorkflows([]);
            }
          } catch (parseError) {
            console.error('Error parsing JSON response:', parseError);
            setWorkflows([]);
          }
        }
      }
    } catch (err) {
      console.error('Error fetching workflows:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isConnected && tools.length > 0) {
      fetchWorkflows();
    } else {
      setWorkflows([]);
    }
  }, [isConnected, tools]);

  // Refresh workflows when refreshTrigger changes
  useEffect(() => {
    if (refreshTrigger && isConnected && tools.length > 0) {
      fetchWorkflows();
    }
  }, [refreshTrigger, isConnected, tools]);

  const handleWorkflowClick = (workflowId: number) => {
    if (selectedWorkflowId === workflowId) {
      onWorkflowSelect(null);
    } else {
      onWorkflowSelect(workflowId);
    }
  };

  if (isCollapsed) {
    return (
      <div className="px-1 py-2 space-y-2">
        {/* Create Workflow Button */}
        <Button
          variant="ghost"
          size="icon"
          onClick={onCreateWorkflow}
          className="w-9 h-9 rounded-full"
          title="Create Workflow"
        >
          <Plus className="h-4 w-4" />
        </Button>

        {/* Workflow Icons */}
        {workflows.map((workflow) => (
          <Button
            key={workflow.id}
            variant={selectedWorkflowId === workflow.id ? 'secondary' : 'ghost'}
            size="icon"
            onClick={() => handleWorkflowClick(workflow.id)}
            className="w-9 h-9 rounded-full"
            title={workflow.name}
          >
            <GitBranch className="h-4 w-4" />
          </Button>
        ))}
      </div>
    );
  }

  return (
    <div className="px-3 py-2">
      {/* Create Workflow Button */}
      <div className="mb-4">
        <Button
          variant="outline"
          size="sm"
          onClick={onCreateWorkflow}
          className="w-full justify-start"
          disabled={!isConnected}
        >
          <Plus className="h-4 w-4 mr-2" />
          Create Workflow
        </Button>
      </div>

      {/* Workflows Header */}
      <div className="mb-3">
        <h3 className="text-sm font-medium text-muted-foreground px-2">Workflows</h3>
      </div>

      {/* Workflows List */}
      {isLoading ? (
        <div className="px-2 py-4 text-center">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto"></div>
          <p className="text-xs text-muted-foreground mt-2">Loading workflows...</p>
        </div>
      ) : workflows.length === 0 ? (
        <div className="px-2 py-4 text-center">
          <p className="text-xs text-muted-foreground">No workflows yet</p>
        </div>
      ) : (
        <div className="space-y-1">
          {workflows.map((workflow) => (
            <Button
              key={workflow.id}
              variant="default"
              size="sm"
              onClick={() => handleWorkflowClick(workflow.id)}
              className={`w-full justify-start ${selectedWorkflowId === workflow.id ? 'bg-border' : ''}`}
            >
              <GitBranch className="h-4 w-4 mr-2 flex-shrink-0" />
              <span className="truncate flex-1 text-left">{workflow.name}</span>
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}

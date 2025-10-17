import { useCallback, useMemo, useState, useEffect, useRef } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  Node,
  Edge,
  NodeTypes,
  BackgroundVariant,
  useNodesState,
  useEdgesState,
  useReactFlow,
  addEdge,
  Connection,
  ReactFlowProvider,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { CallToolNode } from './nodes/CallToolNode';
import { CreateObjectNode } from './nodes/CreateObjectNode';
import { LogNode } from './nodes/LogNode';
import { ConditionalNode } from './nodes/ConditionalNode';
import { SetVariableNode } from './nodes/SetVariableNode';
import { ReturnNode } from './nodes/ReturnNode';
import { StartNode } from './nodes/StartNode';
import { EndNode } from './nodes/EndNode';
import { LoadStateNode } from './nodes/LoadStateNode';
import { SaveStateNode } from './nodes/SaveStateNode';
import { SwitchNode } from './nodes/SwitchNode';
import { NodeEditModal } from './NodeEditModal';
import { WorkflowEditModal } from './WorkflowEditModal';
import { GitBranch, Save, Loader2, Rocket, XCircle, Settings } from 'lucide-react';
import { useMCP } from '@/contexts/MCPContext';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';

interface WorkflowCanvasProps {
  workflowId: number | null;
}

interface WorkflowStep {
  name: string;
  type: string;
  step_type?: string;
  step_config?: any;
}

interface WorkflowData {
  id: number;
  name: string;
  description: string;
  steps: WorkflowStep[];
}

const nodeTypes: NodeTypes = {
  start: StartNode,
  end: EndNode,
  call_tool: CallToolNode,
  create_object: CreateObjectNode,
  log: LogNode,
  conditional: ConditionalNode,
  set_variable: SetVariableNode,
  return: ReturnNode,
  load_state: LoadStateNode,
  save_state: SaveStateNode,
  switch: SwitchNode,
};

function workflowToReactFlow(workflow: WorkflowData): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = workflow.steps.map((step, index) => {
    const stepType = step.step_type || step.type || 'log';
    const isStartNode = stepType === 'start';

    return {
      id: `step-${index}`,
      type: stepType,
      position: { x: index * 300 + 50, y: 150 },
      data: {
        label: step.name,
        stepType: stepType,
        config: step.step_config || step,
      },
      draggable: true,
      deletable: !isStartNode,
    };
  });

  const edges: Edge[] = workflow.steps.slice(0, -1).map((step, index) => ({
    id: `edge-${index}`,
    source: `step-${index}`,
    target: `step-${index + 1}`,
    sourceHandle: null,
    targetHandle: null,
    type: 'default',
    animated: false,
    style: { 
      stroke: 'hsl(var(--border))', 
      strokeWidth: 1.5
    },
  }));

  return { nodes, edges };
}

function WorkflowCanvasInner({ workflowId }: WorkflowCanvasProps) {
  const { callTool, isConnected, tools } = useMCP();
  const { screenToFlowPosition, getViewport } = useReactFlow();
  const { toast } = useToast();
  const [workflow, setWorkflow] = useState<WorkflowData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [nodeIdCounter, setNodeIdCounter] = useState(1);
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [originalSteps, setOriginalSteps] = useState<WorkflowStep[]>([]);
  const [isPublished, setIsPublished] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isWorkflowEditOpen, setIsWorkflowEditOpen] = useState(false);

  // Fetch workflow data when workflowId changes
  useEffect(() => {
    const fetchWorkflow = async () => {
      if (!workflowId || !isConnected || !callTool || tools.length === 0) {
        setWorkflow(null);
        return;
      }

      setIsLoading(true);
      try {
        // Get all templates and find the one we need
        const templatesResult = await callTool('list_templates', {});
        if (templatesResult && templatesResult.content && templatesResult.content[0]) {
          const templatesText = templatesResult.content[0].text;
          
          if (templatesText === 'No templates found.' || templatesText.includes('No templates')) {
            setWorkflow(null);
            return;
          }
          
          const templates = JSON.parse(templatesText);
          const template = Array.isArray(templates) 
            ? templates.find((t: any) => t.id === workflowId)
            : null;
          
          if (template) {
            // Get template properties (workflow steps)
            const propsResult = await callTool('list_properties', { template_id: workflowId });
            if (propsResult && propsResult.content && propsResult.content[0]) {
              const propsText = propsResult.content[0].text;
              
              if (propsText.includes('No properties found')) {
                setWorkflow({
                  id: template.id,
                  name: template.name,
                  description: template.description || '',
                  steps: [],
                });
                return;
              }
              
              // Parse the properties array directly
              const properties = JSON.parse(propsText);
              
              console.log('Raw properties from list_properties:', {
                isArray: Array.isArray(properties),
                count: Array.isArray(properties) ? properties.length : 0,
                properties
              });
              
              // Filter and sort workflow steps (exclude 'property' step_type as those are workflow parameters)
              const steps = Array.isArray(properties)
                ? properties
                    .filter((prop: any) => {
                      const hasStepType = !!prop.step_type;
                      const isNotParameter = prop.step_type !== 'property';
                      console.log(`Property ${prop.key}: has step_type=${hasStepType}, value=${prop.step_type}, isNotParameter=${isNotParameter}`);
                      return hasStepType && isNotParameter;
                    })
                    .sort((a: any, b: any) => (a.execution_order || 0) - (b.execution_order || 0))
                    .map((prop: any) => ({
                      id: prop.id,
                      name: prop.key,
                      type: prop.step_type,
                      step_type: prop.step_type,
                      step_config: prop.step_config,
                    }))
                : [];
              
              console.log('Workflow loaded:', {
                id: template.id,
                name: template.name,
                stepsCount: steps.length,
                steps
              });
              
              setWorkflow({
                id: template.id,
                name: template.name,
                description: template.description || '',
                steps,
              });
              setOriginalSteps(steps);
              setIsDirty(false);
              
              // Check if workflow is published
              const metadata = template.metadata || {};
              setIsPublished(metadata.published === true);
            }
          } else {
            setWorkflow(null);
          }
        }
      } catch (err) {
        console.error('Error fetching workflow:', err);
        setWorkflow(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchWorkflow();
  }, [workflowId, isConnected, callTool, tools]);

  // Update nodes and edges when workflow changes
  useEffect(() => {
    if (workflow) {
      const { nodes: newNodes, edges: newEdges } = workflowToReactFlow(workflow);
      
      // Auto-create start node if workflow has no steps
      if (newNodes.length === 0) {
        const startNode: Node = {
          id: 'start-node',
          type: 'start',
          position: { x: 50, y: 150 },
          data: {
            label: 'Start',
            stepType: 'start',
            config: {
              tool_name: workflow.name.toLowerCase().replace(/\s+/g, '_'),
              display_description: workflow.description,
              tool_description: workflow.description,
              input_parameters: []
            }
          },
          draggable: true,
          deletable: false,
          selectable: true,
          connectable: true
        };
        setNodes([startNode]);
        setEdges([]);
        setIsDirty(true);
      } else {
        setNodes(newNodes);
        setEdges(newEdges);
      }
      // Update counter to be higher than existing node IDs
      const maxId = newNodes.reduce((max, node) => {
        const nodeNum = parseInt(node.id.replace(/\D/g, '')) || 0;
        return Math.max(max, nodeNum);
      }, 0);
      setNodeIdCounter(maxId + 1);
    } else {
      setNodes([]);
      setEdges([]);
      setNodeIdCounter(1);
    }
  }, [workflow, setNodes, setEdges]);

  // Save workflow handler
  const handleSaveWorkflow = useCallback(async () => {
    if (!workflowId || !workflow || !callTool) return;

    setIsSaving(true);
    try {
      console.log('=== SAVE WORKFLOW DEBUG ===');
      console.log('All nodes:', nodes);
      console.log('Nodes to process (excluding end):', nodes.filter(node => node.type !== 'end'));

      // Convert React Flow nodes back to workflow steps (include start node, exclude end node)
      const currentSteps = nodes
        .filter(node => node.type !== 'end')
        .map((node, index) => ({
          name: node.data.label || `Step ${index + 1}`,
          type: node.data.stepType || node.type,
          step_type: node.data.stepType || node.type,
          step_config: node.data.config || {},
          position: node.position,
          execution_order: index
        }));

      console.log('currentSteps (after conversion):', currentSteps);
      console.log('originalSteps (from DB):', originalSteps);

      // Find steps to create, update, or delete
      const stepsToCreate = currentSteps.filter(step =>
        !originalSteps.find(orig => orig.name === step.name)
      );

      const stepsToUpdate = currentSteps.filter(step => {
        const original = originalSteps.find(orig => orig.name === step.name);
        return original && JSON.stringify(original.step_config) !== JSON.stringify(step.step_config);
      });

      const stepsToDelete = originalSteps.filter(orig =>
        !currentSteps.find(step => step.name === orig.name)
      );

      console.log('stepsToCreate:', stepsToCreate);
      console.log('stepsToUpdate:', stepsToUpdate);
      console.log('stepsToDelete:', stepsToDelete);

      // Create new steps
      for (const step of stepsToCreate) {
        console.log('Creating step:', step);
        const result = await callTool('create_property', {
          template_id: workflowId,
          key: step.name,
          type: 'text',
          description: `Workflow step: ${step.name}`,
          step_type: step.step_type,
          step_config: step.step_config,
          execution_order: step.execution_order
        });
        console.log('create_property result:', result);
      }

      // Update existing steps
      for (const step of stepsToUpdate) {
        const original = originalSteps.find(orig => orig.name === step.name);
        console.log('Updating step:', step);
        console.log('Original step:', original);
        if (original && (original as any).id) {
          console.log('Calling update_property with property_id:', (original as any).id);
          const result = await callTool('update_property', {
            property_id: (original as any).id,
            step_config: step.step_config,
            execution_order: step.execution_order
          });
          console.log('update_property result:', result);
        } else {
          console.warn('Could not update step - no ID found:', { step, original });
        }
      }

      // Delete removed steps
      for (const step of stepsToDelete) {
        if ((step as any).id) {
          await callTool('delete_property', {
            property_id: (step as any).id
          });
        }
      }

      // Update template metadata with node positions
      const layout = {
        nodes: nodes.map(node => ({
          id: node.id,
          position: node.position
        }))
      };

      const template = await callTool('get_template', { template_id: workflowId });
      if (template && template.content && template.content[0]) {
        const templateData = JSON.parse(template.content[0].text);
        const metadata = templateData.metadata || {};

        await callTool('update_template', {
          template_id: workflowId,
          metadata: {
            ...metadata,
            layout
          }
        });
      }

      setIsDirty(false);
      setOriginalSteps(currentSteps);

      toast({
        title: "Workflow Saved",
        description: "Your workflow has been saved successfully.",
      });
    } catch (error) {
      console.error('Error saving workflow:', error);
      toast({
        title: "Save Failed",
        description: "Failed to save workflow. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  }, [workflowId, workflow, nodes, originalSteps, callTool, toast]);

  // Toggle publish/unpublish workflow
  const handleTogglePublish = useCallback(async () => {
    if (!workflowId || !workflow || !callTool) return;

    setIsPublishing(true);
    try {
      // Get current template
      const template = await callTool('get_template', { template_id: workflowId });
      if (!template || !template.content || !template.content[0]) {
        throw new Error('Failed to fetch template');
      }

      const templateData = JSON.parse(template.content[0].text);
      const metadata = templateData.metadata || {};
      const newPublishedState = !isPublished;

      // Update metadata.published
      await callTool('update_template', {
        template_id: workflowId,
        metadata: {
          ...metadata,
          published: newPublishedState
        }
      });

      setIsPublished(newPublishedState);

      toast({
        title: newPublishedState ? "Workflow Published" : "Workflow Unpublished",
        description: newPublishedState
          ? "Your workflow is now available as an MCP tool."
          : "Your workflow has been removed from available MCP tools.",
      });
    } catch (error) {
      console.error('Error toggling publish state:', error);
      toast({
        title: "Operation Failed",
        description: "Failed to update workflow publish state. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsPublishing(false);
    }
  }, [workflowId, workflow, isPublished, callTool, toast]);

  // Drag and drop handlers
  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      const type = event.dataTransfer.getData('application/reactflow');
      if (!type) return;

      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      const newNode: Node = {
        id: `node-${nodeIdCounter}`,
        type,
        position,
        data: {
          label: `${type.charAt(0).toUpperCase() + type.slice(1)} ${nodeIdCounter}`,
          stepType: type,
          config: {},
        },
      };

      setNodes((nds) => nds.concat(newNode));
      setNodeIdCounter((id) => id + 1);
      setIsDirty(true);

      // Auto-select and open property panel
      setSelectedNode(newNode);
      setIsPanelOpen(true);
    },
    [screenToFlowPosition, nodeIdCounter, setNodes]
  );

  // Click to add node (from palette or elsewhere)
  const addNodeToCenter = useCallback(
    (nodeType: string) => {
      const viewport = getViewport();
      const position = screenToFlowPosition({
        x: window.innerWidth / 2,
        y: window.innerHeight / 2,
      });

      const newNode: Node = {
        id: `node-${nodeIdCounter}`,
        type: nodeType,
        position,
        data: {
          label: `${nodeType.charAt(0).toUpperCase() + nodeType.slice(1)} ${nodeIdCounter}`,
          stepType: nodeType,
          config: {},
        },
      };

      setNodes((nds) => nds.concat(newNode));
      setNodeIdCounter((id) => id + 1);
      setIsDirty(true);

      // Auto-select and open property panel
      setSelectedNode(newNode);
      setIsPanelOpen(true);
    },
    [screenToFlowPosition, getViewport, nodeIdCounter, setNodes]
  );

  // Edge connection handler
  const onConnect = useCallback(
    (connection: Connection) => {
      const edge = {
        ...connection,
        type: 'default',
        animated: false,
        style: { stroke: 'hsl(var(--border))', strokeWidth: 1.5 },
      };
      setEdges((eds) => addEdge(edge, eds));
    },
    [setEdges]
  );

  // Node double-click handler
  const onNodeDoubleClick = useCallback((_event: React.MouseEvent, node: Node) => {
    console.log('Double-clicked node:', node);
    console.log('Node type:', node.type);
    console.log('Setting selectedNode and opening panel');
    setSelectedNode(node);
    setIsPanelOpen(true);
  }, []);

  // Node delete handler
  const onNodesDelete = useCallback(
    (deleted: Node[]) => {
      // Close panel if deleted node was selected
      if (selectedNode && deleted.find(n => n.id === selectedNode.id)) {
        setSelectedNode(null);
        setIsPanelOpen(false);
      }
    },
    [selectedNode]
  );

  // Property panel handlers
  const handlePropertySave = useCallback(
    (nodeId: string, data: any) => {
      setNodes((nds) =>
        nds.map((node) =>
          node.id === nodeId ? { ...node, data } : node
        )
      );
      setIsDirty(true);
    },
    [setNodes]
  );

  const handlePropertyDelete = useCallback(
    (nodeId: string) => {
      setNodes((nds) => nds.filter((node) => node.id !== nodeId));
      setSelectedNode(null);
      setIsPanelOpen(false);
      setIsDirty(true);
    },
    [setNodes]
  );

  const handlePanelClose = useCallback(() => {
    setIsPanelOpen(false);
    setSelectedNode(null);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Check if user is typing in an input/textarea/contenteditable element
      const target = event.target as HTMLElement;
      const isInputField = target.tagName === 'INPUT' ||
                          target.tagName === 'TEXTAREA' ||
                          target.isContentEditable;

      // Delete selected nodes/edges ONLY with Delete key (not Backspace to avoid accidental deletion)
      if (event.key === 'Delete' && !isInputField) {
        const selectedNodes = nodes.filter(node => node.selected);
        const selectedEdges = edges.filter(edge => edge.selected);

        if (selectedNodes.length > 0) {
          setNodes((nds) => nds.filter(node => !node.selected));
          if (selectedNode && selectedNodes.find(n => n.id === selectedNode.id)) {
            setSelectedNode(null);
            setIsPanelOpen(false);
          }
        }

        if (selectedEdges.length > 0) {
          setEdges((eds) => eds.filter(edge => !edge.selected));
        }
      }

      // Escape to deselect
      if (event.key === 'Escape') {
        setNodes((nds) => nds.map(node => ({ ...node, selected: false })));
        setEdges((eds) => eds.map(edge => ({ ...edge, selected: false })));
        setIsPanelOpen(false);
        setSelectedNode(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [nodes, edges, selectedNode, setNodes, setEdges]);

  if (isLoading) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-muted/10">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4"></div>
        <p className="text-muted-foreground">Loading workflow...</p>
      </div>
    );
  }

  if (!workflow) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-muted/10">
        <GitBranch className="w-16 h-16 text-muted-foreground mb-4" />
        <h3 className="text-xl font-semibold mb-2">No Workflow Selected</h3>
        <p className="text-muted-foreground text-center max-w-md">
          Select a workflow from the sidebar to visualize its steps and flow
        </p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col" ref={reactFlowWrapper}>
      <div className="bg-background p-4">
        <Card className="border border-border shadow-sm">
          <div className="p-3 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0">
                <GitBranch className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-sm font-medium flex items-center gap-2">
                  {workflow.name}
                  {isDirty && <span className="text-xs text-muted-foreground">(unsaved changes)</span>}
                </h2>
                {workflow.description && (
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">{workflow.description}</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button
                onClick={() => setIsWorkflowEditOpen(true)}
                disabled={!isConnected}
                size="sm"
                variant="outline"
                className="gap-2"
              >
                <Settings className="w-4 h-4" />
                Settings
              </Button>
              <Button
                onClick={handleSaveWorkflow}
                disabled={!isDirty || isSaving || !isConnected}
                size="sm"
                variant="outline"
                className="gap-2"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    Save
                  </>
                )}
              </Button>
              <Button
                onClick={handleTogglePublish}
                disabled={isPublishing || !isConnected}
                size="sm"
                variant={isPublished ? "secondary" : "default"}
                className="gap-2"
              >
                {isPublishing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {isPublished ? 'Unpublishing...' : 'Publishing...'}
                  </>
                ) : isPublished ? (
                  <>
                    <XCircle className="w-4 h-4" />
                    Unpublish
                  </>
                ) : (
                  <>
                    <Rocket className="w-4 h-4" />
                    Publish
                  </>
                )}
              </Button>
            </div>
          </div>
        </Card>
      </div>

      <div className="flex-1 bg-background">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeDoubleClick={onNodeDoubleClick}
          onNodesDelete={onNodesDelete}
          onDrop={onDrop}
          onDragOver={onDragOver}
          nodeTypes={nodeTypes}
          nodesDraggable={true}
          nodesConnectable={true}
          elementsSelectable={true}
          fitView
          minZoom={0.1}
          maxZoom={2}
          defaultEdgeOptions={{
            animated: false,
            style: { stroke: 'hsl(var(--border))', strokeWidth: 1.5 },
          }}
          connectionLineStyle={{ stroke: 'hsl(var(--border))', strokeWidth: 1.5 }}
          style={{ background: 'hsl(var(--background))' }}
          deleteKeyCode={null}
        >
          <Background
            variant={BackgroundVariant.Dots}
            gap={16}
            size={1}
            color="hsl(var(--muted-foreground))"
            style={{ opacity: 0.15 }}
          />
          <Controls />
          <MiniMap
            nodeStrokeWidth={3}
            zoomable
            pannable
            className="bg-background border border-border"
          />
        </ReactFlow>

        <NodeEditModal
          node={selectedNode}
          isOpen={isPanelOpen}
          onClose={handlePanelClose}
          onSave={handlePropertySave}
          onDelete={handlePropertyDelete}
        />

        <WorkflowEditModal
          isOpen={isWorkflowEditOpen}
          onClose={() => setIsWorkflowEditOpen(false)}
          workflowId={workflowId}
          workflowName={workflow?.name || ''}
          workflowDescription={workflow?.description || ''}
          nodes={nodes}
          onSave={() => {
            // Refresh workflow data after save
            const fetchWorkflow = async () => {
              if (!workflowId || !isConnected || !callTool || tools.length === 0) return;

              try {
                const result = await callTool('get_template', { template_id: workflowId });
                if (result && result.content && result.content[0]) {
                  const templateData = JSON.parse(result.content[0].text);
                  setWorkflow({
                    ...workflow!,
                    name: templateData.name,
                    description: templateData.description || '',
                  });
                }
              } catch (err) {
                console.error('Error refreshing workflow:', err);
              }
            };
            fetchWorkflow();
          }}
        />
      </div>
    </div>
  );
}

export function WorkflowCanvas({ workflowId }: WorkflowCanvasProps) {
  return (
    <ReactFlowProvider>
      <WorkflowCanvasInner workflowId={workflowId} />
    </ReactFlowProvider>
  );
}

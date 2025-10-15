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
import { LogNode } from './nodes/LogNode';
import { ConditionalNode } from './nodes/ConditionalNode';
import { SetVariableNode } from './nodes/SetVariableNode';
import { ReturnNode } from './nodes/ReturnNode';
import { StartNode } from './nodes/StartNode';
import { EndNode } from './nodes/EndNode';
import { NodeEditModal } from './NodeEditModal';
import { GitBranch } from 'lucide-react';
import { useMCP } from '@/contexts/MCPContext';

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
  log: LogNode,
  conditional: ConditionalNode,
  set_variable: SetVariableNode,
  return: ReturnNode,
};

function workflowToReactFlow(workflow: WorkflowData): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = workflow.steps.map((step, index) => {
    const stepType = step.step_type || step.type || 'log';
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
  const [workflow, setWorkflow] = useState<WorkflowData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [nodeIdCounter, setNodeIdCounter] = useState(1);
  const reactFlowWrapper = useRef<HTMLDivElement>(null);

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
              
              // Filter and sort workflow steps
              const steps = Array.isArray(properties)
                ? properties
                    .filter((prop: any) => {
                      const hasStepType = !!prop.step_type;
                      console.log(`Property ${prop.key}: has step_type=${hasStepType}, value=${prop.step_type}`);
                      return hasStepType;
                    })
                    .sort((a: any, b: any) => (a.execution_order || 0) - (b.execution_order || 0))
                    .map((prop: any) => ({
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
      setNodes(newNodes);
      setEdges(newEdges);
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
    },
    [setNodes]
  );

  const handlePropertyDelete = useCallback(
    (nodeId: string) => {
      setNodes((nds) => nds.filter((node) => node.id !== nodeId));
      setSelectedNode(null);
      setIsPanelOpen(false);
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
      // Delete selected nodes/edges
      if (event.key === 'Delete' || event.key === 'Backspace') {
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
      <div className="border-b bg-background p-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <GitBranch className="w-5 h-5" />
              {workflow.name}
            </h2>
            <p className="text-sm text-muted-foreground mt-1">{workflow.description}</p>
          </div>
          <div className="text-sm text-muted-foreground">
            {workflow.steps.length} step{workflow.steps.length !== 1 ? 's' : ''}
          </div>
        </div>
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

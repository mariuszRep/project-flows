import { useCallback, useMemo, useState, useEffect } from 'react';
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
} from 'reactflow';
import 'reactflow/dist/style.css';
import { CallToolNode } from './nodes/CallToolNode';
import { LogNode } from './nodes/LogNode';
import { ConditionalNode } from './nodes/ConditionalNode';
import { SetVariableNode } from './nodes/SetVariableNode';
import { ReturnNode } from './nodes/ReturnNode';
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

export function WorkflowCanvas({ workflowId }: WorkflowCanvasProps) {
  const { callTool, isConnected, tools } = useMCP();
  const [workflow, setWorkflow] = useState<WorkflowData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

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
    } else {
      setNodes([]);
      setEdges([]);
    }
  }, [workflow, setNodes, setEdges]);

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
    <div className="h-full flex flex-col">
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
          nodeTypes={nodeTypes}
          nodesDraggable={true}
          nodesConnectable={false}
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
      </div>
    </div>
  );
}

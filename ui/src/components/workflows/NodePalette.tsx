import { Card } from '@/components/ui/card';
import { Wrench, FileText, GitBranch, Variable, CornerDownRight, Play, StopCircle, Database, Download, Upload, Route } from 'lucide-react';

export interface NodeType {
  type: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  description: string;
}

export const nodeTypes: NodeType[] = [
  {
    type: 'start',
    label: 'Start',
    icon: Play,
    color: 'bg-green-500',
    description: 'Workflow entry point'
  },
  {
    type: 'call_tool',
    label: 'Call Tool',
    icon: Wrench,
    color: 'bg-blue-500',
    description: 'Execute an MCP tool'
  },
  {
    type: 'create_object',
    label: 'Create Object',
    icon: Database,
    color: 'bg-teal-500',
    description: 'Create task, project, epic, or rule'
  },
  {
    type: 'log',
    label: 'Log',
    icon: FileText,
    color: 'bg-purple-500',
    description: 'Log a message'
  },
  {
    type: 'conditional',
    label: 'Conditional',
    icon: GitBranch,
    color: 'bg-orange-500',
    description: 'Branch based on condition'
  },
  {
    type: 'set_variable',
    label: 'Set Variable',
    icon: Variable,
    color: 'bg-cyan-500',
    description: 'Set a workflow variable'
  },
  {
    type: 'return',
    label: 'Return',
    icon: CornerDownRight,
    color: 'bg-pink-500',
    description: 'Return a value'
  },
  {
    type: 'load_state',
    label: 'Load State',
    icon: Download,
    color: 'bg-emerald-500',
    description: 'Load workflow state from database'
  },
  {
    type: 'save_state',
    label: 'Save State',
    icon: Upload,
    color: 'bg-amber-500',
    description: 'Save workflow state to database'
  },
  {
    type: 'switch',
    label: 'Switch',
    icon: Route,
    color: 'bg-indigo-500',
    description: 'Multi-branch routing'
  },
  {
    type: 'end',
    label: 'End',
    icon: StopCircle,
    color: 'bg-red-500',
    description: 'Workflow exit point'
  }
];

interface NodePaletteProps {
  onNodeAdd?: (nodeType: string) => void;
  onNodeDragStart?: (event: React.DragEvent, nodeType: string) => void;
}

export function NodePalette({ onNodeAdd, onNodeDragStart }: NodePaletteProps) {
  const handleDragStart = (event: React.DragEvent, nodeType: string) => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.effectAllowed = 'move';

    if (onNodeDragStart) {
      onNodeDragStart(event, nodeType);
    }
  };

  const handleClick = (nodeType: string) => {
    if (onNodeAdd) {
      onNodeAdd(nodeType);
    }
  };

  return (
    <div className="px-3 py-2">
      <div className="mb-3">
        <h3 className="text-sm font-medium text-muted-foreground px-2">Node Palette</h3>
        <p className="text-xs text-muted-foreground px-2 mt-1">
          Drag onto canvas or click to add
        </p>
      </div>

      <div className="space-y-2">
        {nodeTypes.filter((nodeType) => nodeType.type !== 'start' && nodeType.type !== 'end').map((nodeType) => {
          const Icon = nodeType.icon;
          return (
            <Card
              key={nodeType.type}
              draggable
              onDragStart={(e) => handleDragStart(e, nodeType.type)}
              onClick={() => handleClick(nodeType.type)}
              className="cursor-grab active:cursor-grabbing hover:border-primary/50 transition-all hover:shadow-md p-3"
            >
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full ${nodeType.color} flex items-center justify-center flex-shrink-0`}>
                  <Icon className="w-4 h-4 text-white" />
                </div>
                <div className="flex-1 text-left">
                  <div className="font-medium text-sm">{nodeType.label}</div>
                  <div className="text-xs text-muted-foreground">{nodeType.description}</div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

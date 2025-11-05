import { Card } from '@/components/ui/card';
import { Bot, Database, FolderOpen } from 'lucide-react';

export interface NodeType {
  type: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  description: string;
}

export const nodeTypes: NodeType[] = [
  {
    type: 'agent',
    label: 'Agent',
    icon: Bot,
    color: 'bg-purple-500',
    description: 'Agent node'
  },
  {
    type: 'create_object',
    label: 'Object',
    icon: Database,
    color: 'bg-teal-500',
    description: 'Create object (Task, Project, Epic, Rule)'
  },
  {
    type: 'load_object',
    label: 'Load Object',
    icon: FolderOpen,
    color: 'bg-blue-500',
    description: 'Load object properties for agent population'
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
        {nodeTypes.map((nodeType) => {
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

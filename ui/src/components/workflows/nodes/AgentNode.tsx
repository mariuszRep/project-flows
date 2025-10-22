import { Handle, Position } from 'reactflow';
import { Card } from '@/components/ui/card';
import { Bot } from 'lucide-react';

interface AgentNodeProps {
  data: {
    label: string;
    stepType: string;
    config?: Record<string, unknown>;
  };
  selected?: boolean;
}

export function AgentNode({ data, selected }: AgentNodeProps) {
  return (
    <Card className={`min-w-[200px] shadow-sm transition-all ${
      selected ? 'border-2 border-primary' : 'border border-border'
    }`}>
      <Handle
        type="target"
        position={Position.Left}
        className={`w-2 h-2 rounded-full bg-border transition-opacity ${
          selected ? 'opacity-100' : 'opacity-0'
        }`}
      />
      <div className="p-3 flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-purple-500 flex items-center justify-center flex-shrink-0">
          <Bot className="w-5 h-5 text-white" />
        </div>
        <div className="font-medium text-sm">{data.label || 'Agent'}</div>
      </div>
      <Handle
        type="source"
        position={Position.Right}
        className={`w-2 h-2 rounded-full bg-border transition-opacity ${
          selected ? 'opacity-100' : 'opacity-0'
        }`}
      />
    </Card>
  );
}

import { Handle, Position } from 'reactflow';
import { Card } from '@/components/ui/card';
import { FileText } from 'lucide-react';

interface LogNodeProps {
  data: {
    label: string;
    stepType: string;
    config: any;
  };
  selected?: boolean;
}

export function LogNode({ data, selected }: LogNodeProps) {
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
          <FileText className="w-5 h-5 text-white" />
        </div>
        <div className="font-medium text-sm">{data.label}</div>
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

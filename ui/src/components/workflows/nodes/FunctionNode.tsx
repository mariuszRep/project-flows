import { Handle, Position } from 'reactflow';
import { Card } from '@/components/ui/card';
import { Code } from 'lucide-react';

interface FunctionNodeProps {
  data: {
    label: string;
    stepType: string;
    config?: {
      function_name?: string;
      parameters?: Record<string, unknown>;
      result_variable?: string;
    };
  };
  selected?: boolean;
}

export function FunctionNode({ data, selected }: FunctionNodeProps) {
  const functionName = data.config?.function_name || 'No function selected';

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
      <div className="p-3">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-full bg-orange-500 flex items-center justify-center flex-shrink-0">
            <Code className="w-5 h-5 text-white" />
          </div>
          <div className="font-medium text-sm">{data.label || 'Function'}</div>
        </div>
        <div className="text-xs text-muted-foreground ml-[52px]">
          {functionName}
        </div>
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

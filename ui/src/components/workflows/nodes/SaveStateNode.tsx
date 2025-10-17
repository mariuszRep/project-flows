import { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { Upload } from 'lucide-react';

export const SaveStateNode = memo(({ data, selected }: NodeProps) => {
  return (
    <div
      className={`
        px-4 py-3 shadow-md rounded-lg border-2 bg-card min-w-[180px]
        ${selected ? 'border-primary shadow-lg' : 'border-border'}
        transition-all hover:shadow-lg
      `}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="w-3 h-3 !bg-amber-500 border-2 border-background"
      />

      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-full bg-amber-500 flex items-center justify-center flex-shrink-0">
          <Upload className="w-4 h-4 text-white" />
        </div>
        <div className="flex-1">
          <div className="font-medium text-sm">{data.label}</div>
          <div className="text-xs text-muted-foreground">Save State</div>
        </div>
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        className="w-3 h-3 !bg-amber-500 border-2 border-background"
      />
    </div>
  );
});

SaveStateNode.displayName = 'SaveStateNode';

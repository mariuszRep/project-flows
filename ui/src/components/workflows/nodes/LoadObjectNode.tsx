import { Handle, Position } from 'reactflow';
import { Card } from '@/components/ui/card';
import { FolderOpen } from 'lucide-react';
import { useMCP } from '@/contexts/MCPContext';
import { useState, useEffect } from 'react';

interface LoadObjectNodeProps {
  data: {
    label: string;
    stepType: string;
    config: any;
  };
  selected?: boolean;
}

export function LoadObjectNode({ data, selected }: LoadObjectNodeProps) {
  const { callTool, isConnected } = useMCP();
  const [templateName, setTemplateName] = useState<string | null>(null);

  useEffect(() => {
    const fetchTemplateName = async () => {
      const templateId = data.config?.template_id;
      if (!templateId || !isConnected || !callTool) {
        setTemplateName(null);
        return;
      }

      try {
        const result = await callTool('list_templates', {});
        if (result && result.content && result.content[0]) {
          const templatesText = result.content[0].text;

          if (!templatesText.includes('No templates')) {
            const templates = JSON.parse(templatesText);
            const template = Array.isArray(templates)
              ? templates.find((t: any) => t.id === templateId)
              : null;

            if (template) {
              setTemplateName(template.name);
            }
          }
        }
      } catch (error) {
        console.error('Error fetching template name:', error);
        setTemplateName(null);
      }
    };

    fetchTemplateName();
  }, [data.config?.template_id, isConnected, callTool]);

  // Display label with template name if configured
  const displayLabel = templateName
    ? `${data.label} (${templateName})`
    : data.label;

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
        <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0">
          <FolderOpen className="w-5 h-5 text-white" />
        </div>
        <div className="font-medium text-sm">{displayLabel}</div>
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

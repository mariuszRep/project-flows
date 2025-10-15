import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AutoTextarea } from '@/components/ui/auto-textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { X, Save, Trash2, Plus } from 'lucide-react';
import { Node } from 'reactflow';
import { useToast } from '@/hooks/use-toast';
import { useMCP } from '@/contexts/MCPContext';

interface NodeEditModalProps {
  node: Node | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (nodeId: string, data: Record<string, unknown>) => void;
  onDelete?: (nodeId: string) => void;
}

export function NodeEditModal({ node, isOpen, onClose, onSave, onDelete }: NodeEditModalProps) {
  const { toast } = useToast();
  const { tools } = useMCP();
  const [label, setLabel] = useState('');
  const [description, setDescription] = useState('');
  const [config, setConfig] = useState<Record<string, any>>({});
  const [error, setError] = useState<string | null>(null);
  const firstInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (node && isOpen) {
      console.log('NodeEditModal opened for node:', node);
      console.log('Node type:', node.type);
      console.log('Node data:', node.data);
      setLabel(node.data.label || '');
      setDescription(node.data.description || '');
      setConfig(node.data.config || {});
      setError(null);

      // Focus first input after modal opens
      setTimeout(() => {
        if (firstInputRef.current) {
          firstInputRef.current.focus();
        }
      }, 100);
    }
  }, [node, isOpen]);

  if (!isOpen || !node) {
    return null;
  }

  const handleSave = () => {
    // Validate required fields
    if (!label.trim()) {
      setError('Label is required');
      toast({
        title: "Validation Error",
        description: "Label is required",
        variant: "destructive",
      });
      return;
    }

    onSave(node.id, {
      ...node.data,
      label,
      description,
      config
    });

    toast({
      title: "Success",
      description: "Node updated successfully",
    });

    onClose();
  };

  const handleDelete = () => {
    if (onDelete) {
      onDelete(node.id);
      toast({
        title: "Success",
        description: "Node deleted successfully",
      });
      onClose();
    }
  };

  const getNodeTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      start: 'Start Node',
      end: 'End Node',
      call_tool: 'Call Tool Node',
      log: 'Log Node',
      conditional: 'Conditional Node',
      set_variable: 'Set Variable Node',
      return: 'Return Node'
    };
    return labels[type] || type;
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 overflow-y-auto p-4">
      <Card className="w-full max-w-2xl mx-auto">
        {/* Header */}
        <div className="sticky top-0 bg-transparent p-6 flex items-center justify-between rounded-t-lg border-b">
          <h2 className="text-2xl font-semibold text-foreground">
            {getNodeTypeLabel(node.type || '')}
          </h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Content */}
        <div className="p-6 max-h-[70vh] overflow-y-auto">
          {/* Error State */}
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-4 mb-4">
              <p className="text-red-800 dark:text-red-300 text-sm">{error}</p>
            </div>
          )}

          <div className="space-y-4">
            {/* Label Field */}
            <div className="border rounded-xl border-border bg-muted/5 p-4">
              <label className="text-xs font-medium text-muted-foreground mb-2 block">
                Label
              </label>
              <Input
                ref={firstInputRef}
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="Enter node label..."
                className="w-full"
              />
            </div>

            {/* Description Field */}
            <div className="border rounded-xl border-border bg-muted/5 p-4">
              <label className="text-xs font-medium text-muted-foreground mb-2 block">
                Description
              </label>
              <AutoTextarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Enter node description..."
                minRows={3}
                maxRows={6}
                className="w-full"
              />
            </div>

            {/* Node-specific configuration fields */}
            {node.type === 'start' && (
              <div className="border rounded-xl border-border bg-muted/5 p-4 space-y-3">
                <h3 className="text-sm font-semibold mb-2">Workflow Tool Configuration</h3>
                <div>
                  <Label className="text-xs">Tool Name</Label>
                  <Input
                    value={config.tool_name || ''}
                    onChange={(e) => setConfig({ ...config, tool_name: e.target.value })}
                    placeholder="my_workflow_tool"
                    className="font-mono"
                  />
                  <p className="text-xs text-muted-foreground mt-1">Lowercase, underscores only</p>
                </div>
                <div>
                  <Label className="text-xs">Tool Description</Label>
                  <AutoTextarea
                    value={config.tool_description || ''}
                    onChange={(e) => setConfig({ ...config, tool_description: e.target.value })}
                    placeholder="Description for MCP tool"
                    minRows={2}
                    maxRows={4}
                  />
                </div>
                <div>
                  <Label className="text-xs">Input Parameters (JSON)</Label>
                  <AutoTextarea
                    value={typeof config.input_parameters === 'string' ? config.input_parameters : JSON.stringify(config.input_parameters || [], null, 2)}
                    onChange={(e) => setConfig({ ...config, input_parameters: e.target.value })}
                    placeholder='[{"name": "task_id", "type": "number", "required": true}]'
                    minRows={3}
                    maxRows={6}
                    className="font-mono text-xs"
                  />
                </div>
              </div>
            )}

            {node.type === 'call_tool' && (
              <div className="border rounded-xl border-border bg-muted/5 p-4 space-y-3">
                <h3 className="text-sm font-semibold mb-2">Tool Configuration</h3>
                <div>
                  <Label className="text-xs">Select Tool</Label>
                  <Select
                    value={config.tool_name || ''}
                    onValueChange={(value) => setConfig({ ...config, tool_name: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a tool..." />
                    </SelectTrigger>
                    <SelectContent className="max-h-[300px]">
                      {tools.filter(t => !['execute_task', 'initiate_object'].includes(t.name)).map((tool) => (
                        <SelectItem key={tool.name} value={tool.name}>
                          {tool.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Parameters (JSON)</Label>
                  <AutoTextarea
                    value={config.parameters || ''}
                    onChange={(e) => setConfig({ ...config, parameters: e.target.value })}
                    placeholder='{"object_id": 123}'
                    minRows={4}
                    maxRows={8}
                    className="w-full font-mono text-xs"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Use ${'{{input.paramName}}'} to reference start node parameters
                  </p>
                </div>
              </div>
            )}

            {node.type === 'conditional' && (
              <div className="border rounded-xl border-border bg-muted/5 p-4">
                <h3 className="text-sm font-semibold mb-2">Conditional Configuration</h3>
                <label className="text-xs font-medium text-muted-foreground mb-2 block">
                  Condition
                </label>
                <AutoTextarea
                  value={config.condition || ''}
                  onChange={(e) => setConfig({ ...config, condition: e.target.value })}
                  placeholder="Enter condition expression..."
                  minRows={2}
                  maxRows={4}
                  className="w-full"
                />
              </div>
            )}

            {node.type === 'set_variable' && (
              <div className="border rounded-xl border-border bg-muted/5 p-4 space-y-3">
                <h3 className="text-sm font-semibold mb-2">Variable Configuration</h3>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-2 block">
                    Variable Name
                  </label>
                  <Input
                    value={config.variable_name || ''}
                    onChange={(e) => setConfig({ ...config, variable_name: e.target.value })}
                    placeholder="e.g., result, context"
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-2 block">
                    Value
                  </label>
                  <AutoTextarea
                    value={config.value || ''}
                    onChange={(e) => setConfig({ ...config, value: e.target.value })}
                    placeholder="Enter variable value..."
                    minRows={2}
                    maxRows={4}
                    className="w-full"
                  />
                </div>
              </div>
            )}

            {node.type === 'log' && (
              <div className="border rounded-xl border-border bg-muted/5 p-4">
                <h3 className="text-sm font-semibold mb-2">Log Configuration</h3>
                <label className="text-xs font-medium text-muted-foreground mb-2 block">
                  Message
                </label>
                <AutoTextarea
                  value={config.message || ''}
                  onChange={(e) => setConfig({ ...config, message: e.target.value })}
                  placeholder="Enter log message..."
                  minRows={2}
                  maxRows={4}
                  className="w-full"
                />
              </div>
            )}

            {node.type === 'return' && (
              <div className="border rounded-xl border-border bg-muted/5 p-4">
                <h3 className="text-sm font-semibold mb-2">Return Configuration</h3>
                <label className="text-xs font-medium text-muted-foreground mb-2 block">
                  Return Value
                </label>
                <AutoTextarea
                  value={config.return_value || ''}
                  onChange={(e) => setConfig({ ...config, return_value: e.target.value })}
                  placeholder="Enter return value..."
                  minRows={2}
                  maxRows={4}
                  className="w-full"
                />
              </div>
            )}

            {/* Node Info */}
            <div className="border rounded-xl border-border bg-muted/5 p-4">
              <h3 className="text-sm font-semibold mb-2">Node Information</h3>
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Node ID:</span>
                  <span className="font-mono">{node.id}</span>
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Type:</span>
                  <span className="font-mono">{node.type}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-6 border-t flex items-center justify-between gap-2">
          <div>
            {onDelete && (
              <Button variant="destructive" onClick={handleDelete}>
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Node
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleSave}>
              <Save className="h-4 w-4 mr-2" />
              Save Changes
            </Button>
          </div>
        </div>
      </Card>
    </div>,
    document.body
  );
}

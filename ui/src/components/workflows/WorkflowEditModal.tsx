import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AutoTextarea } from '@/components/ui/auto-textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { X, Save, Plus, Trash2, Loader2, Settings, Edit2 } from 'lucide-react';
import { Node, useNodes } from 'reactflow';
import { useToast } from '@/hooks/use-toast';
import { useMCP } from '@/contexts/MCPContext';

interface WorkflowEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  workflowId: number | null;
  workflowName: string;
  workflowDescription: string;
  nodes: Node[];
  onSave: () => void;
}

// Workflow parameter interface (maps to property in database)
interface WorkflowParameter {
  id?: number; // Property ID from database
  key: string; // Property key (parameter name)
  type: string;
  description: string;
  required?: boolean;
  default?: string;
  step_config?: {
    required?: boolean;
    default?: string;
    template_id?: number;
    template_name?: string;
    property_key?: string;
    node_id?: string;
    node_parameter?: string;
    node_label?: string;
  };
}

export function WorkflowEditModal({
  isOpen,
  onClose,
  workflowId,
  workflowName: initialName,
  workflowDescription: initialDescription,
  nodes,
  onSave,
}: WorkflowEditModalProps) {
  const { toast } = useToast();
  const { callTool, isConnected } = useMCP();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [toolName, setToolName] = useState('');
  const [parameters, setParameters] = useState<WorkflowParameter[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // Description edit modal state
  const [editingParamIndex, setEditingParamIndex] = useState<number | null>(null);
  const [editingDescription, setEditingDescription] = useState('');

  // Template selection state
  const [templates, setTemplates] = useState<any[]>([]);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);
  const [propertiesByTemplate, setPropertiesByTemplate] = useState<Map<number, any[]>>(new Map());
  const [isLoadingProperties, setIsLoadingProperties] = useState<Set<number>>(new Set());

  // New parameter form state
  const [showAddParameterForm, setShowAddParameterForm] = useState(false);
  const [parameterSource, setParameterSource] = useState<'custom' | 'template' | 'node'>('custom');
  const [newParamKey, setNewParamKey] = useState('');
  const [newParamType, setNewParamType] = useState('string');
  const [newParamRequired, setNewParamRequired] = useState(false);
  const [newParamDescription, setNewParamDescription] = useState('');
  const [newParamDefault, setNewParamDefault] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null);
  const [selectedPropertyKey, setSelectedPropertyKey] = useState<string>('');
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedNodeParameter, setSelectedNodeParameter] = useState<string>('');

  // Get all nodes from canvas
  const canvasNodes = useNodes();

  // Helper function to extract parameters from a node based on its type
  const getNodeParameters = (node: Node): Array<{ key: string; type: string; description?: string }> => {
    const nodeData = node.data as any;
    const parameters: Array<{ key: string; type: string; description?: string }> = [];

    // Load object / Create object nodes - extract from properties
    if ((node.type === 'load_object' || node.type === 'create_object') && nodeData?.config?.properties) {
      const properties = nodeData.config.properties;
      Object.entries(properties).forEach(([key, value]: [string, any]) => {
        parameters.push({
          key,
          type: typeof value === 'object' && value?.type ? value.type : 'string',
          description: typeof value === 'object' && value?.description ? value.description : undefined,
        });
      });
    }

    return parameters;
  };

  // Get nodes that have configurable parameters
  const nodesWithParameters = canvasNodes.filter(node => {
    const params = getNodeParameters(node);
    return params.length > 0;
  });

  // Helper function to determine parameter source
  const getParameterSource = (param: WorkflowParameter): { type: 'custom' | 'template' | 'node'; label: string; icon: string } => {
    if (param.step_config?.node_id) {
      return {
        type: 'node',
        label: param.step_config.node_label || 'Node',
        icon: '🔗',
      };
    }
    if (param.step_config?.template_id) {
      return {
        type: 'template',
        label: param.step_config.template_name || 'Template',
        icon: '📋',
      };
    }
    return {
      type: 'custom',
      label: 'Custom',
      icon: '🔧',
    };
  };

  // Load templates when modal opens
  useEffect(() => {
    const loadTemplates = async () => {
      if (!isOpen || !isConnected || !callTool) {
        return;
      }

      setIsLoadingTemplates(true);
      try {
        const result = await callTool('list_templates', {});
        if (result && result.content && result.content[0]) {
          const text = result.content[0].text;
          if (!text.includes('No templates')) {
            const templatesData = JSON.parse(text);
            setTemplates(Array.isArray(templatesData) ? templatesData : []);
          }
        }
      } catch (error) {
        console.error('Error loading templates:', error);
        setTemplates([]);
      } finally {
        setIsLoadingTemplates(false);
      }
    };

    loadTemplates();
  }, [isOpen, isConnected, callTool]);

  // Initialize form data and load parameters from properties table
  useEffect(() => {
    if (isOpen && workflowId && callTool) {
      const loadWorkflowSettings = async () => {
        try {
          // Load template metadata
          const result = await callTool('get_template', { template_id: workflowId });
          if (result && result.content && result.content[0]) {
            const templateData = JSON.parse(result.content[0].text);
            const metadata = templateData.metadata || {};

            setName(templateData.name || '');
            setDescription(templateData.description || '');
            setToolName(metadata.mcp_tool_name || templateData.name.toLowerCase().replace(/\s+/g, '_'));
          }

          // Load parameters from properties table
          const propsResult = await callTool('list_properties', { template_id: workflowId });
          if (propsResult && propsResult.content && propsResult.content[0]) {
            const propsText = propsResult.content[0].text;
            if (!propsText.includes('No properties found')) {
              const properties = JSON.parse(propsText);
              const params = Array.isArray(properties)
                ? properties
                    .filter((p: any) => p.step_type === 'property')
                    .map((p: any) => ({
                      id: p.id,
                      key: p.key,
                      type: p.type,
                      description: p.description,
                      required: p.step_config?.required || false,
                      default: p.step_config?.default || '',
                      step_config: p.step_config,
                    }))
                : [];
              setParameters(params);
            } else {
              setParameters([]);
            }
          }
        } catch (error) {
          console.error('Error loading workflow settings:', error);
          setName(initialName);
          setDescription(initialDescription);
          setToolName(initialName.toLowerCase().replace(/\s+/g, '_'));
          setParameters([]);
        }
      };

      loadWorkflowSettings();
    }
  }, [isOpen, workflowId, callTool, initialName, initialDescription]);

  // Load properties for a specific template
  const loadPropertiesForTemplate = async (templateId: number) => {
    if (propertiesByTemplate.has(templateId) || !callTool) {
      return;
    }

    setIsLoadingProperties(prev => new Set(prev).add(templateId));

    try {
      const result = await callTool('list_properties', { template_id: templateId });
      if (result && result.content && result.content[0]) {
        const text = result.content[0].text;
        if (!text.includes('No properties found')) {
          const properties = JSON.parse(text);
          const propertyList = Array.isArray(properties)
            ? properties.filter((p: any) => p.step_type === 'property')
            : [];
          setPropertiesByTemplate(prev => new Map(prev).set(templateId, propertyList));
        } else {
          setPropertiesByTemplate(prev => new Map(prev).set(templateId, []));
        }
      }
    } catch (error) {
      console.error('Error loading properties:', error);
      setPropertiesByTemplate(prev => new Map(prev).set(templateId, []));
    } finally {
      setIsLoadingProperties(prev => {
        const next = new Set(prev);
        next.delete(templateId);
        return next;
      });
    }
  };

  const resetNewParameterForm = () => {
    setNewParamKey('');
    setNewParamType('string');
    setNewParamRequired(false);
    setNewParamDescription('');
    setNewParamDefault('');
    setSelectedTemplateId(null);
    setSelectedPropertyKey('');
    setSelectedNodeId(null);
    setSelectedNodeParameter('');
    setParameterSource('custom');
    setShowAddParameterForm(false);
  };

  // Show add parameter form
  const addParameter = () => {
    setShowAddParameterForm(true);
  };

  // Add custom parameter
  const addCustomParameter = async () => {
    if (!workflowId || !callTool) return;

    const paramKey = newParamKey.trim();

    if (!paramKey) {
      toast({
        title: "Validation Error",
        description: "Parameter name is required",
        variant: "destructive",
      });
      return;
    }

    if (parameters.some(p => p.key === paramKey)) {
      toast({
        title: "Parameter Already Exists",
        description: `Parameter "${paramKey}" is already in the workflow.`,
        variant: "destructive",
      });
      return;
    }

    try {
      const result = await callTool('create_property', {
        template_id: workflowId,
        key: paramKey,
        type: newParamType,
        description: newParamDescription.trim(),
        step_type: 'property',
        step_config: {
          required: newParamRequired,
          default: newParamDefault.trim(),
        },
      });

      if (result && result.content && result.content[0]) {
        const text = result.content[0].text;
        const match = text.match(/ID:\s*(\d+)/);
        const propertyId = match ? parseInt(match[1]) : undefined;

        setParameters([
          ...parameters,
          {
            id: propertyId,
            key: paramKey,
            type: newParamType,
            description: newParamDescription.trim(),
            required: newParamRequired,
            default: newParamDefault.trim(),
            step_config: {
              required: newParamRequired,
              default: newParamDefault.trim(),
            },
          },
        ]);

        resetNewParameterForm();
        toast({
          title: "Parameter Added",
          description: `Custom parameter "${paramKey}" has been added.`,
        });
      }
    } catch (error) {
      console.error('Error adding custom parameter:', error);
      toast({
        title: "Error",
        description: "Failed to add parameter. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Add template-based parameter
  const addTemplateParameter = async () => {
    if (!workflowId || !callTool || !selectedTemplateId || !selectedPropertyKey) return;

    const template = templates.find(t => t.id === selectedTemplateId);
    const properties = propertiesByTemplate.get(selectedTemplateId) || [];
    const property = properties.find((p: any) => p.key === selectedPropertyKey);

    if (!template || !property) {
      toast({
        title: "Error",
        description: "Selected template or property not found",
        variant: "destructive",
      });
      return;
    }

    const paramKey = newParamKey.trim() || selectedPropertyKey.toLowerCase().replace(/\s+/g, '_');

    if (parameters.some(p => p.key === paramKey)) {
      toast({
        title: "Parameter Already Exists",
        description: `Parameter "${paramKey}" is already in the workflow.`,
        variant: "destructive",
      });
      return;
    }

    try {
      const result = await callTool('create_property', {
        template_id: workflowId,
        key: paramKey,
        type: newParamType,
        description: newParamDescription.trim() || property.description || `Value for ${property.key}`,
        step_type: 'property',
        step_config: {
          required: newParamRequired,
          default: newParamDefault.trim(),
          template_id: selectedTemplateId,
          template_name: template.name,
          property_key: selectedPropertyKey,
        },
      });

      if (result && result.content && result.content[0]) {
        const text = result.content[0].text;
        const match = text.match(/ID:\s*(\d+)/);
        const propertyId = match ? parseInt(match[1]) : undefined;

        setParameters([
          ...parameters,
          {
            id: propertyId,
            key: paramKey,
            type: newParamType,
            description: newParamDescription.trim() || property.description || `Value for ${property.key}`,
            required: newParamRequired,
            default: newParamDefault.trim(),
            step_config: {
              required: newParamRequired,
              default: newParamDefault.trim(),
              template_id: selectedTemplateId,
              template_name: template.name,
              property_key: selectedPropertyKey,
            },
          },
        ]);

        resetNewParameterForm();
        toast({
          title: "Parameter Added",
          description: `Template parameter "${paramKey}" has been added from ${template.name}.`,
        });
      }
    } catch (error) {
      console.error('Error adding template parameter:', error);
      toast({
        title: "Error",
        description: "Failed to add parameter. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Add node-based parameter
  const addNodeParameter = async () => {
    if (!workflowId || !callTool || !selectedNodeId || !selectedNodeParameter) return;

    const node = canvasNodes.find(n => n.id === selectedNodeId);
    if (!node) {
      toast({
        title: "Error",
        description: "Selected node not found",
        variant: "destructive",
      });
      return;
    }

    const nodeParams = getNodeParameters(node);
    const nodeParam = nodeParams.find(p => p.key === selectedNodeParameter);

    if (!nodeParam) {
      toast({
        title: "Error",
        description: "Selected parameter not found on node",
        variant: "destructive",
      });
      return;
    }

    const paramKey = newParamKey.trim() || selectedNodeParameter.toLowerCase().replace(/\s+/g, '_');

    // Check if parameter key already exists
    if (parameters.some(p => p.key === paramKey)) {
      toast({
        title: "Parameter Already Exists",
        description: `Parameter "${paramKey}" is already in the workflow.`,
        variant: "destructive",
      });
      return;
    }

    // Check for duplicate node parameter mapping
    const existingMapping = parameters.find(p => {
      // Check if this parameter is sourced from the same node parameter
      return p.id && parameters.some(param => {
        // We'll need to check step_config in the database, but for now check locally
        return false; // Will be validated server-side if needed
      });
    });

    const nodeLabel = (node.data as any)?.label || node.type || node.id;

    try {
      const result = await callTool('create_property', {
        template_id: workflowId,
        key: paramKey,
        type: newParamType || nodeParam.type,
        description: newParamDescription.trim() || nodeParam.description || `Value from ${nodeLabel} node`,
        step_type: 'property',
        step_config: {
          required: newParamRequired,
          default: newParamDefault.trim(),
          node_id: selectedNodeId,
          node_parameter: selectedNodeParameter,
          node_label: nodeLabel,
        },
      });

      if (result && result.content && result.content[0]) {
        const text = result.content[0].text;
        const match = text.match(/ID:\s*(\d+)/);
        const propertyId = match ? parseInt(match[1]) : undefined;

        setParameters([
          ...parameters,
          {
            id: propertyId,
            key: paramKey,
            type: newParamType || nodeParam.type,
            description: newParamDescription.trim() || nodeParam.description || `Value from ${nodeLabel} node`,
            required: newParamRequired,
            default: newParamDefault.trim(),
            step_config: {
              required: newParamRequired,
              default: newParamDefault.trim(),
              node_id: selectedNodeId,
              node_parameter: selectedNodeParameter,
              node_label: nodeLabel,
            },
          },
        ]);

        resetNewParameterForm();
        toast({
          title: "Parameter Added",
          description: `Node parameter "${paramKey}" has been linked to ${nodeLabel}.`,
        });
      }
    } catch (error) {
      console.error('Error adding node parameter:', error);
      toast({
        title: "Error",
        description: "Failed to add parameter. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Remove parameter
  const removeParameter = async (index: number) => {
    const param = parameters[index];
    if (!param.id || !callTool) {
      setParameters(parameters.filter((_, i) => i !== index));
      return;
    }

    try {
      await callTool('delete_property', { property_id: param.id });
      setParameters(parameters.filter((_, i) => i !== index));
      toast({
        title: "Parameter Removed",
        description: `Parameter "${param.key}" has been removed.`,
      });
    } catch (error) {
      console.error('Error removing parameter:', error);
      toast({
        title: "Error",
        description: "Failed to remove parameter. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Update parameter
  const updateParameter = async (index: number, field: keyof WorkflowParameter, value: any) => {
    const param = parameters[index];
    const updated = { ...param, [field]: value };

    // Update local state immediately for responsiveness
    const newParams = [...parameters];
    newParams[index] = updated;
    setParameters(newParams);

    // If parameter has an ID, update in database
    if (param.id && callTool) {
      try {
        const step_config = {
          required: updated.required,
          default: updated.default,
        };

        await callTool('update_property', {
          property_id: param.id,
          key: updated.key,
          type: updated.type,
          description: updated.description,
          step_config,
        });
      } catch (error) {
        console.error('Error updating parameter:', error);
        toast({
          title: "Update Warning",
          description: "Parameter updated locally but failed to save to database.",
          variant: "destructive",
        });
      }
    }
  };

  // Save description from modal
  const saveDescription = async () => {
    if (editingParamIndex === null) return;

    await updateParameter(editingParamIndex, 'description', editingDescription);
    setEditingParamIndex(null);
    setEditingDescription('');
  };

  const validateForm = (): boolean => {
    if (!name.trim()) {
      toast({
        title: "Validation Error",
        description: "Workflow name is required",
        variant: "destructive",
      });
      return false;
    }

    if (!toolName.trim()) {
      toast({
        title: "Validation Error",
        description: "Tool name is required",
        variant: "destructive",
      });
      return false;
    }

    if (!/^[a-z][a-z0-9_]*$/.test(toolName)) {
      toast({
        title: "Validation Error",
        description: "Tool name must start with a letter and contain only lowercase letters, numbers, and underscores",
        variant: "destructive",
      });
      return false;
    }

    const paramKeys = parameters.map(p => p.key.trim()).filter(k => k);
    const uniqueKeys = new Set(paramKeys);
    if (paramKeys.length !== uniqueKeys.size) {
      toast({
        title: "Validation Error",
        description: "Parameter names must be unique",
        variant: "destructive",
      });
      return false;
    }

    for (const param of parameters) {
      if (!param.key.trim()) {
        toast({
          title: "Validation Error",
          description: "All parameters must have a name",
          variant: "destructive",
        });
        return false;
      }
    }

    return true;
  };

  const handleSave = async () => {
    if (!validateForm() || !workflowId || !callTool) {
      return;
    }

    setIsSaving(true);
    try {
      const result = await callTool('get_template', { template_id: workflowId });
      if (!result || !result.content || !result.content[0]) {
        throw new Error('Failed to fetch template');
      }

      const templateData = JSON.parse(result.content[0].text);
      const currentMetadata = templateData.metadata || {};

      await callTool('update_template', {
        template_id: workflowId,
        name: name,
        description: description,
        metadata: {
          ...currentMetadata,
          mcp_tool_name: toolName,
          tool_description: description,
        }
      });

      toast({
        title: "Workflow Settings Saved",
        description: "Your workflow configuration has been updated successfully.",
      });

      onSave();
      onClose();
    } catch (error) {
      console.error('Error saving workflow settings:', error);
      toast({
        title: "Save Failed",
        description: "Failed to save workflow settings. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) {
    return null;
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 overflow-y-auto p-4">
      <Card className="w-full max-w-5xl mx-auto max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="sticky top-0 bg-background p-6 flex items-center justify-between rounded-t-lg border-b">
          <div className="flex items-center gap-3">
            <Settings className="w-6 h-6 text-primary" />
            <h2 className="text-2xl font-semibold text-foreground">Workflow Settings</h2>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-6">
            {/* Basic Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Basic Information</h3>

              <div>
                <Label className="text-sm">Workflow Name</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="My Workflow"
                  className="mt-1"
                />
              </div>

              <div>
                <Label className="text-sm">Description</Label>
                <AutoTextarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe what this workflow does..."
                  minRows={3}
                  maxRows={6}
                  className="mt-1"
                />
              </div>

              <div>
                <Label className="text-sm">MCP Tool Name</Label>
                <Input
                  value={toolName}
                  onChange={(e) => setToolName(e.target.value)}
                  placeholder="my_workflow_tool"
                  className="mt-1 font-mono"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Lowercase letters, numbers, and underscores only. This is how the workflow will be called as an MCP tool.
                </p>
              </div>
            </div>

            {/* Parameters Configuration */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold">Workflow Parameters</h3>
                  <p className="text-sm text-muted-foreground">
                    Define input parameters that will be available to all nodes in this workflow.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => addParameter()}
                  className="gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Add Parameter
                </Button>
              </div>

              {/* Add Parameter Form */}
              {showAddParameterForm && (
                <div className="border rounded-lg p-4 bg-background space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold">Add New Parameter</h4>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={resetNewParameterForm}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>

                  {/* Parameter Source Tabs */}
                  <div className="flex gap-2 p-1 bg-muted rounded-lg">
                    <button
                      type="button"
                      onClick={() => setParameterSource('custom')}
                      className={`flex-1 px-4 py-2 rounded transition-colors ${
                        parameterSource === 'custom'
                          ? 'bg-background shadow-sm font-medium'
                          : 'hover:bg-background/50'
                      }`}
                    >
                      🔧 Custom
                    </button>
                    <button
                      type="button"
                      onClick={() => setParameterSource('template')}
                      className={`flex-1 px-4 py-2 rounded transition-colors ${
                        parameterSource === 'template'
                          ? 'bg-background shadow-sm font-medium'
                          : 'hover:bg-background/50'
                      }`}
                    >
                      📋 From Template
                    </button>
                    <button
                      type="button"
                      onClick={() => setParameterSource('node')}
                      className={`flex-1 px-4 py-2 rounded transition-colors ${
                        parameterSource === 'node'
                          ? 'bg-background shadow-sm font-medium'
                          : 'hover:bg-background/50'
                      }`}
                    >
                      🔗 Node
                    </button>
                  </div>

                  {/* Custom Parameter Form */}
                  {parameterSource === 'custom' && (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label className="text-sm">Parameter Name *</Label>
                          <Input
                            value={newParamKey}
                            onChange={(e) => setNewParamKey(e.target.value)}
                            placeholder="my_parameter"
                            className="mt-1 font-mono"
                          />
                        </div>
                        <div>
                          <Label className="text-sm">Type</Label>
                          <Select value={newParamType} onValueChange={setNewParamType}>
                            <SelectTrigger className="mt-1">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="string">String</SelectItem>
                              <SelectItem value="number">Number</SelectItem>
                              <SelectItem value="integer">Integer</SelectItem>
                              <SelectItem value="boolean">Boolean</SelectItem>
                              <SelectItem value="array">Array</SelectItem>
                              <SelectItem value="object">Object</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div>
                        <Label className="text-sm">Description</Label>
                        <Input
                          value={newParamDescription}
                          onChange={(e) => setNewParamDescription(e.target.value)}
                          placeholder="Description of this parameter..."
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label className="text-sm">Default Value (Optional)</Label>
                        <Input
                          value={newParamDefault}
                          onChange={(e) => setNewParamDefault(e.target.value)}
                          placeholder="Default value..."
                          className="mt-1"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id="new-param-required"
                          checked={newParamRequired}
                          onCheckedChange={(checked) => setNewParamRequired(checked === true)}
                        />
                        <Label htmlFor="new-param-required" className="text-sm cursor-pointer">
                          Required parameter
                        </Label>
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={resetNewParameterForm}
                        >
                          Cancel
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          onClick={addCustomParameter}
                          className="gap-2"
                        >
                          <Plus className="h-4 w-4" />
                          Add Custom Parameter
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Template-Based Parameter Form */}
                  {parameterSource === 'template' && (
                    <div className="space-y-3">
                      <div>
                        <Label className="text-sm">Select Template *</Label>
                        {isLoadingTemplates ? (
                          <div className="flex items-center gap-2 p-2 border rounded-lg mt-1">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span className="text-sm text-muted-foreground">Loading templates...</span>
                          </div>
                        ) : (
                          <Select
                            value={selectedTemplateId?.toString() || ''}
                            onValueChange={(value) => {
                              const templateId = parseInt(value);
                              setSelectedTemplateId(templateId);
                              setSelectedPropertyKey('');
                              loadPropertiesForTemplate(templateId);
                            }}
                          >
                            <SelectTrigger className="mt-1">
                              <SelectValue placeholder="Choose a template..." />
                            </SelectTrigger>
                            <SelectContent>
                              {templates.map((template) => (
                                <SelectItem key={template.id} value={template.id.toString()}>
                                  {template.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      </div>

                      {selectedTemplateId && (
                        <div>
                          <Label className="text-sm">Select Property *</Label>
                          {isLoadingProperties.has(selectedTemplateId) ? (
                            <div className="flex items-center gap-2 p-2 border rounded-lg mt-1">
                              <Loader2 className="w-4 w-4 animate-spin" />
                              <span className="text-sm text-muted-foreground">Loading properties...</span>
                            </div>
                          ) : (
                            <Select
                              value={selectedPropertyKey}
                              onValueChange={(value) => {
                                setSelectedPropertyKey(value);
                                const properties = propertiesByTemplate.get(selectedTemplateId) || [];
                                const property = properties.find((p: any) => p.key === value);
                                if (property) {
                                  setNewParamKey(value.toLowerCase().replace(/\s+/g, '_'));
                                  setNewParamDescription(property.description || '');
                                  setNewParamType(property.type || 'string');
                                }
                              }}
                            >
                              <SelectTrigger className="mt-1">
                                <SelectValue placeholder="Choose a property..." />
                              </SelectTrigger>
                              <SelectContent>
                                {(propertiesByTemplate.get(selectedTemplateId) || []).map((property: any) => (
                                  <SelectItem key={property.key} value={property.key}>
                                    {property.key}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        </div>
                      )}

                      {selectedPropertyKey && (
                        <>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <Label className="text-sm">Parameter Name</Label>
                              <Input
                                value={newParamKey}
                                onChange={(e) => setNewParamKey(e.target.value)}
                                placeholder="my_parameter"
                                className="mt-1 font-mono"
                              />
                              <p className="text-xs text-muted-foreground mt-1">
                                Leave blank to auto-generate
                              </p>
                            </div>
                            <div>
                              <Label className="text-sm">Type</Label>
                              <Select value={newParamType} onValueChange={setNewParamType}>
                                <SelectTrigger className="mt-1">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="string">String</SelectItem>
                                  <SelectItem value="number">Number</SelectItem>
                                  <SelectItem value="integer">Integer</SelectItem>
                                  <SelectItem value="boolean">Boolean</SelectItem>
                                  <SelectItem value="array">Array</SelectItem>
                                  <SelectItem value="object">Object</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                          <div>
                            <Label className="text-sm">Description</Label>
                            <Input
                              value={newParamDescription}
                              onChange={(e) => setNewParamDescription(e.target.value)}
                              placeholder="Description..."
                              className="mt-1"
                            />
                          </div>
                          <div>
                            <Label className="text-sm">Default Value (Optional)</Label>
                            <Input
                              value={newParamDefault}
                              onChange={(e) => setNewParamDefault(e.target.value)}
                              placeholder="Default value..."
                              className="mt-1"
                            />
                          </div>
                          <div className="flex items-center gap-2">
                            <Checkbox
                              id="template-param-required"
                              checked={newParamRequired}
                              onCheckedChange={(checked) => setNewParamRequired(checked === true)}
                            />
                            <Label htmlFor="template-param-required" className="text-sm cursor-pointer">
                              Required parameter
                            </Label>
                          </div>
                          <div className="flex justify-end gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={resetNewParameterForm}
                            >
                              Cancel
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              onClick={addTemplateParameter}
                              className="gap-2"
                            >
                              <Plus className="h-4 w-4" />
                              Add Template Parameter
                            </Button>
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  {/* Node-Based Parameter Form */}
                  {parameterSource === 'node' && (
                    <div className="space-y-3">
                      <div>
                        <Label className="text-sm">Select Node *</Label>
                        {nodesWithParameters.length === 0 ? (
                          <div className="flex items-center gap-2 p-2 border rounded-lg mt-1">
                            <span className="text-sm text-muted-foreground">No nodes with parameters found on canvas</span>
                          </div>
                        ) : (
                          <Select
                            value={selectedNodeId || ''}
                            onValueChange={(value) => {
                              setSelectedNodeId(value);
                              setSelectedNodeParameter('');
                              setNewParamKey('');
                              setNewParamDescription('');
                            }}
                          >
                            <SelectTrigger className="mt-1">
                              <SelectValue placeholder="Choose a node..." />
                            </SelectTrigger>
                            <SelectContent>
                              {nodesWithParameters.map((node) => {
                                const nodeLabel = (node.data as any)?.label || node.type || node.id;
                                return (
                                  <SelectItem key={node.id} value={node.id}>
                                    {nodeLabel} ({node.type})
                                  </SelectItem>
                                );
                              })}
                            </SelectContent>
                          </Select>
                        )}
                      </div>

                      {selectedNodeId && (() => {
                        const selectedNode = canvasNodes.find(n => n.id === selectedNodeId);
                        const availableParams = selectedNode ? getNodeParameters(selectedNode) : [];
                        return (
                          <div>
                            <Label className="text-sm">Select Parameter *</Label>
                            {availableParams.length === 0 ? (
                              <div className="flex items-center gap-2 p-2 border rounded-lg mt-1">
                                <span className="text-sm text-muted-foreground">No parameters available</span>
                              </div>
                            ) : (
                              <Select
                                value={selectedNodeParameter}
                                onValueChange={(value) => {
                                  setSelectedNodeParameter(value);
                                  const param = availableParams.find(p => p.key === value);
                                  if (param) {
                                    setNewParamKey(value.toLowerCase().replace(/\s+/g, '_'));
                                    setNewParamDescription(param.description || '');
                                    setNewParamType(param.type || 'string');
                                  }
                                }}
                              >
                                <SelectTrigger className="mt-1">
                                  <SelectValue placeholder="Choose a parameter..." />
                                </SelectTrigger>
                                <SelectContent>
                                  {availableParams.map((param) => (
                                    <SelectItem key={param.key} value={param.key}>
                                      {param.key} ({param.type})
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )}
                          </div>
                        );
                      })()}

                      {selectedNodeParameter && (
                        <>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <Label className="text-sm">Parameter Name</Label>
                              <Input
                                value={newParamKey}
                                onChange={(e) => setNewParamKey(e.target.value)}
                                placeholder="my_parameter"
                                className="mt-1 font-mono"
                              />
                              <p className="text-xs text-muted-foreground mt-1">
                                Leave blank to auto-generate
                              </p>
                            </div>
                            <div>
                              <Label className="text-sm">Type</Label>
                              <Select value={newParamType} onValueChange={setNewParamType}>
                                <SelectTrigger className="mt-1">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="string">String</SelectItem>
                                  <SelectItem value="number">Number</SelectItem>
                                  <SelectItem value="integer">Integer</SelectItem>
                                  <SelectItem value="boolean">Boolean</SelectItem>
                                  <SelectItem value="array">Array</SelectItem>
                                  <SelectItem value="object">Object</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                          <div>
                            <Label className="text-sm">Description</Label>
                            <Input
                              value={newParamDescription}
                              onChange={(e) => setNewParamDescription(e.target.value)}
                              placeholder="Description..."
                              className="mt-1"
                            />
                          </div>
                          <div>
                            <Label className="text-sm">Default Value (Optional)</Label>
                            <Input
                              value={newParamDefault}
                              onChange={(e) => setNewParamDefault(e.target.value)}
                              placeholder="Default value..."
                              className="mt-1"
                            />
                          </div>
                          <div className="flex items-center gap-2">
                            <Checkbox
                              id="node-param-required"
                              checked={newParamRequired}
                              onCheckedChange={(checked) => setNewParamRequired(checked === true)}
                            />
                            <Label htmlFor="node-param-required" className="text-sm cursor-pointer">
                              Required parameter
                            </Label>
                          </div>
                          <div className="flex justify-end gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={resetNewParameterForm}
                            >
                              Cancel
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              onClick={addNodeParameter}
                              className="gap-2"
                            >
                              <Plus className="h-4 w-4" />
                              Add Node Parameter
                            </Button>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Parameters List */}
              {parameters.length === 0 ? (
                <div className="text-sm text-muted-foreground text-center py-8 border border-dashed rounded-lg">
                  No parameters defined. Click "Add Parameter" to create custom parameters or import from templates.
                </div>
              ) : (
                <div className="space-y-3">
                  {parameters.map((param, index) => {
                    const source = getParameterSource(param);
                    return (
                      <div key={index} className="border rounded-lg p-4 bg-background space-y-3">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-xs px-2 py-1 rounded-md bg-muted font-medium">
                            {source.icon} {source.label}
                          </span>
                          {source.type === 'node' && param.step_config?.node_parameter && (
                            <span className="text-xs text-muted-foreground">
                              → {param.step_config.node_parameter}
                            </span>
                          )}
                          {source.type === 'template' && param.step_config?.property_key && (
                            <span className="text-xs text-muted-foreground">
                              → {param.step_config.property_key}
                            </span>
                          )}
                        </div>
                        <div className="grid grid-cols-[1.5fr_1.5fr_120px_80px_40px_40px] gap-2 items-start">
                          <div>
                            <Label className="text-xs text-muted-foreground">Parameter Name</Label>
                            <Input
                              value={param.key}
                              onChange={(e) => updateParameter(index, 'key', e.target.value)}
                              placeholder="e.g., project_title"
                              className="h-9 text-sm font-mono mt-1"
                            />
                          </div>

                        <div>
                          <Label className="text-xs text-muted-foreground">Default Value</Label>
                          <Input
                            value={param.default || ''}
                            onChange={(e) => updateParameter(index, 'default', e.target.value)}
                            placeholder="Default value..."
                            className="h-9 text-sm mt-1"
                          />
                        </div>

                        <div>
                          <Label className="text-xs text-muted-foreground">Type</Label>
                          <Select
                            value={param.type}
                            onValueChange={(value) => updateParameter(index, 'type', value)}
                          >
                            <SelectTrigger className="h-9 text-sm mt-1">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="string">String</SelectItem>
                              <SelectItem value="number">Number</SelectItem>
                              <SelectItem value="integer">Integer</SelectItem>
                              <SelectItem value="boolean">Boolean</SelectItem>
                              <SelectItem value="array">Array</SelectItem>
                              <SelectItem value="object">Object</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div>
                          <Label className="text-xs text-muted-foreground">Required</Label>
                          <div className="flex items-center justify-center h-9 mt-1">
                            <Checkbox
                              checked={param.required}
                              onCheckedChange={(checked) => updateParameter(index, 'required', checked)}
                            />
                          </div>
                        </div>

                        <div className="flex items-end h-full pb-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setEditingParamIndex(index);
                              setEditingDescription(param.description);
                            }}
                            className="h-9 w-9"
                            title="Edit description"
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                        </div>

                        <div className="flex items-end h-full pb-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removeParameter(index)}
                            className="h-9 w-9 text-destructive hover:text-destructive hover:bg-destructive/10"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                        {/* Description (read-only display) */}
                        <div className="bg-muted/30 rounded px-3 py-2">
                          <Label className="text-xs text-muted-foreground block mb-1">Description</Label>
                          <p className="text-sm">{param.description || <span className="text-muted-foreground italic">No description</span>}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-background p-6 border-t flex items-center justify-end gap-3">
          <Button variant="outline" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving} className="gap-2">
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                Save Settings
              </>
            )}
          </Button>
        </div>
      </Card>

      {/* Description Edit Modal */}
      {editingParamIndex !== null && createPortal(
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black bg-opacity-50 p-4">
          <Card className="w-full max-w-2xl">
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Edit Parameter Description</h3>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    setEditingParamIndex(null);
                    setEditingDescription('');
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <div>
                <Label className="text-sm">Description</Label>
                <AutoTextarea
                  value={editingDescription}
                  onChange={(e) => setEditingDescription(e.target.value)}
                  placeholder="Detailed description of this parameter..."
                  minRows={4}
                  maxRows={10}
                  className="mt-1"
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setEditingParamIndex(null);
                    setEditingDescription('');
                  }}
                >
                  Cancel
                </Button>
                <Button onClick={saveDescription}>
                  Save Description
                </Button>
              </div>
            </div>
          </Card>
        </div>,
        document.body
      )}
    </div>,
    document.body
  );
}

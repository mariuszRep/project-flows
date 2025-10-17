import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AutoTextarea } from '@/components/ui/auto-textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { X, Save, Trash2, Plus, Loader2 } from 'lucide-react';
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

interface InputParameter {
  name: string;
  type: string;
  required: boolean;
  default_value?: string;
  description?: string;
}

interface ToolParameter {
  key: string;
  value: string;
  required?: boolean;
  description?: string;
  type?: string;
}

export function NodeEditModal({ node, isOpen, onClose, onSave, onDelete }: NodeEditModalProps) {
  const { toast } = useToast();
  const { tools, callTool, isConnected } = useMCP();
  const [label, setLabel] = useState('');
  const [description, setDescription] = useState('');
  const [config, setConfig] = useState<Record<string, any>>({});
  const [error, setError] = useState<string | null>(null);
  const [inputParameters, setInputParameters] = useState<InputParameter[]>([]);
  const [toolParameters, setToolParameters] = useState<ToolParameter[]>([]);
  const firstInputRef = useRef<HTMLInputElement>(null);

  // State for create_object configuration
  const [availableTemplates, setAvailableTemplates] = useState<any[]>([]);
  const [availableProperties, setAvailableProperties] = useState<any[]>([]);
  const [selectedProperties, setSelectedProperties] = useState<Record<string, boolean | string>>({});
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);
  const [isLoadingProperties, setIsLoadingProperties] = useState(false);
  const [workflowParameters, setWorkflowParameters] = useState<string[]>([]);

  useEffect(() => {
    if (node && isOpen) {
      console.log('NodeEditModal opened for node:', node);
      console.log('Node type:', node.type);
      console.log('Node data:', node.data);
      console.log('Node data.config:', node.data.config);
      console.log('Node data.config.input_parameters:', node.data.config?.input_parameters);
      setLabel(node.data.label || '');
      setDescription(node.data.description || '');
      setConfig(node.data.config || {});
      setError(null);

      // Parse input parameters for start node
      if (node.type === 'start') {
        const inputParams = node.data.config?.input_parameters;
        console.log('Loading input parameters for start node:', inputParams);

        if (inputParams) {
          try {
            const params = typeof inputParams === 'string'
              ? JSON.parse(inputParams)
              : inputParams;

            if (Array.isArray(params)) {
              console.log('Setting input parameters:', params);
              setInputParameters(params);
            } else {
              console.log('Input parameters not an array, resetting');
              setInputParameters([]);
            }
          } catch (e) {
            console.error('Failed to parse input parameters:', e);
            setInputParameters([]);
          }
        } else {
          console.log('No input parameters found, resetting');
          setInputParameters([]);
        }
      } else {
        setInputParameters([]);
      }

      // Parse tool parameters for call_tool node
      if (node.type === 'call_tool') {
        const params = node.data.config?.parameters;
        const toolName = node.data.config?.tool_name;
        console.log('Loading tool parameters for call_tool node:', params);

        if (params) {
          try {
            const parsedParams = typeof params === 'string' ? JSON.parse(params) : params;

            if (typeof parsedParams === 'object' && parsedParams !== null && !Array.isArray(parsedParams)) {
              // Try to enrich with schema information if tool is selected
              const selectedTool = toolName ? tools.find(t => t.name === toolName) : null;
              let schemaInfo: Record<string, any> = {};

              if (selectedTool && selectedTool.inputSchema && selectedTool.inputSchema.properties) {
                const schema = selectedTool.inputSchema;
                const requiredFields = Array.isArray(schema.required) ? schema.required : [];

                Object.keys(schema.properties).forEach(key => {
                  const prop = schema.properties[key];
                  schemaInfo[key] = {
                    required: requiredFields.includes(key),
                    description: prop.description || '',
                    type: prop.type || 'string'
                  };
                });
              }

              const paramArray = Object.entries(parsedParams).map(([key, value]) => ({
                key,
                value: typeof value === 'string' ? value : JSON.stringify(value),
                required: schemaInfo[key]?.required || false,
                description: schemaInfo[key]?.description || '',
                type: schemaInfo[key]?.type || 'string'
              }));
              console.log('Setting tool parameters with schema info:', paramArray);
              setToolParameters(paramArray);
            } else {
              console.log('Tool parameters not an object, resetting');
              setToolParameters([]);
            }
          } catch (e) {
            console.error('Failed to parse tool parameters:', e);
            setToolParameters([]);
          }
        } else {
          console.log('No tool parameters found, resetting');
          setToolParameters([]);
        }
      } else {
        setToolParameters([]);
      }

      // Parse create_object configuration
      if (node.type === 'create_object') {
        const properties = node.data.config?.properties;
        if (properties && typeof properties === 'object') {
          setSelectedProperties(properties);
        } else {
          setSelectedProperties({});
        }
      } else {
        setSelectedProperties({});
      }

      // Focus first input after modal opens
      setTimeout(() => {
        if (firstInputRef.current) {
          firstInputRef.current.focus();
        }
      }, 100);
    }
  }, [node, isOpen]);

  // Load workflow parameters from parent workflow
  useEffect(() => {
    const loadWorkflowParameters = async () => {
      if (!isOpen || !node || !isConnected || !callTool) {
        return;
      }

      try {
        // Get the workflow template ID from URL or context
        // For now, we'll parse it from the URL path
        const pathParts = window.location.pathname.split('/');
        const workflowIdIndex = pathParts.indexOf('workflows') + 1;
        const workflowId = workflowIdIndex > 0 ? parseInt(pathParts[workflowIdIndex]) : null;

        if (!workflowId) {
          setWorkflowParameters([]);
          return;
        }

        const result = await callTool('get_template', { template_id: workflowId });
        if (result && result.content && result.content[0]) {
          const templateData = JSON.parse(result.content[0].text);
          const metadata = templateData.metadata || {};
          const params = metadata.workflow_parameters || [];

          // Extract parameter names
          const paramNames = params.map((p: any) => p.name);
          setWorkflowParameters(paramNames);
        } else {
          setWorkflowParameters([]);
        }
      } catch (error) {
        console.error('Error loading workflow parameters:', error);
        setWorkflowParameters([]);
      }
    };

    loadWorkflowParameters();
  }, [isOpen, node, isConnected, callTool]);

  // Load templates for create_object node
  useEffect(() => {
    const loadTemplates = async () => {
      if (!isOpen || !node || node.type !== 'create_object' || !isConnected || !callTool) {
        return;
      }

      setIsLoadingTemplates(true);
      try {
        const result = await callTool('list_templates', {});
        if (result && result.content && result.content[0]) {
          const templatesText = result.content[0].text;

          if (!templatesText.includes('No templates')) {
            const templates = JSON.parse(templatesText);
            // Filter only object templates (exclude workflow templates)
            const objectTemplates = Array.isArray(templates)
              ? templates.filter((t: any) => t.type === 'object' || !t.type)
              : [];
            setAvailableTemplates(objectTemplates);
          } else {
            setAvailableTemplates([]);
          }
        }
      } catch (error) {
        console.error('Error loading templates:', error);
        setAvailableTemplates([]);
      } finally {
        setIsLoadingTemplates(false);
      }
    };

    loadTemplates();
  }, [isOpen, node, isConnected, callTool]);

  // Load properties when template is selected
  useEffect(() => {
    const loadProperties = async () => {
      const templateId = config.template_id;
      if (!isOpen || !node || node.type !== 'create_object' || !templateId || !isConnected || !callTool) {
        setAvailableProperties([]);
        return;
      }

      setIsLoadingProperties(true);
      try {
        const result = await callTool('list_properties', { template_id: templateId });
        if (result && result.content && result.content[0]) {
          const propsText = result.content[0].text;

          if (!propsText.includes('No properties found')) {
            const properties = JSON.parse(propsText);
            // Filter properties with step_type='property' (exclude workflow steps)
            const objectProps = Array.isArray(properties)
              ? properties.filter((p: any) => p.step_type === 'property')
              : [];
            setAvailableProperties(objectProps);
          } else {
            setAvailableProperties([]);
          }
        }
      } catch (error) {
        console.error('Error loading properties:', error);
        setAvailableProperties([]);
      } finally {
        setIsLoadingProperties(false);
      }
    };

    loadProperties();
  }, [isOpen, node, config.template_id, isConnected, callTool]);

  if (!isOpen || !node) {
    return null;
  }

  const addParameter = () => {
    setInputParameters([
      ...inputParameters,
      { name: '', type: 'string', required: false, default_value: '', description: '' }
    ]);
  };

  const removeParameter = (index: number) => {
    setInputParameters(inputParameters.filter((_, i) => i !== index));
  };

  const updateParameter = (index: number, field: keyof InputParameter, value: any) => {
    const updated = [...inputParameters];
    updated[index] = { ...updated[index], [field]: value };
    setInputParameters(updated);
  };

  const addToolParameter = () => {
    setToolParameters([
      ...toolParameters,
      { key: '', value: '' }
    ]);
  };

  const removeToolParameter = (index: number) => {
    setToolParameters(toolParameters.filter((_, i) => i !== index));
  };

  const updateToolParameter = (index: number, field: keyof ToolParameter, value: string) => {
    const updated = [...toolParameters];
    updated[index] = { ...updated[index], [field]: value };
    setToolParameters(updated);
  };

  const handleToolSelection = (toolName: string) => {
    setConfig({ ...config, tool_name: toolName });

    // Find the selected tool's schema
    const selectedTool = tools.find(t => t.name === toolName);
    if (selectedTool && selectedTool.inputSchema) {
      console.log('Tool selected:', toolName);
      console.log('Tool input schema:', selectedTool.inputSchema);

      // Extract properties from the schema
      const schema = selectedTool.inputSchema;
      if (schema.properties && typeof schema.properties === 'object') {
        const requiredFields = Array.isArray(schema.required) ? schema.required : [];

        // Create parameter entries for each property in the schema
        const schemaParams: ToolParameter[] = Object.keys(schema.properties).map(key => {
          const prop = schema.properties[key];
          const isRequired = requiredFields.includes(key);

          return {
            key,
            value: '', // Empty value, user will fill it in
            required: isRequired,
            description: prop.description || '',
            type: prop.type || 'string'
          };
        });

        console.log('Generated parameters from schema:', schemaParams);
        setToolParameters(schemaParams);
      }
    }
  };

  const validateParameters = (): boolean => {
    const names = inputParameters.map(p => p.name.trim()).filter(n => n);
    const uniqueNames = new Set(names);

    if (names.length !== uniqueNames.size) {
      setError('Parameter names must be unique');
      toast({
        title: "Validation Error",
        description: "Parameter names must be unique",
        variant: "destructive",
      });
      return false;
    }

    for (const param of inputParameters) {
      if (!param.name.trim()) {
        setError('All parameters must have a name');
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

  const handleTemplateSelection = (templateId: string) => {
    const numericId = parseInt(templateId);
    setConfig({ ...config, template_id: numericId });
    // Reset selected properties when template changes
    setSelectedProperties({});
  };

  const addProperty = (propertyKey: string) => {
    if (!propertyKey || propertyKey in selectedProperties) return;
    setSelectedProperties({
      ...selectedProperties,
      [propertyKey]: true // true means "use direct input", will be replaced with parameter reference
    });
  };

  const removeProperty = (propertyKey: string) => {
    const newProps = { ...selectedProperties };
    delete newProps[propertyKey];
    setSelectedProperties(newProps);
  };

  const updatePropertyMapping = (propertyKey: string, value: string | boolean) => {
    setSelectedProperties({
      ...selectedProperties,
      [propertyKey]: value
    });
  };

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

    // Validate parameters for start node
    if (node.type === 'start' && inputParameters.length > 0) {
      if (!validateParameters()) {
        return;
      }
    }

    // Prepare config with input parameters for start node
    const updatedConfig = { ...config };
    if (node.type === 'start') {
      updatedConfig.input_parameters = inputParameters;
      console.log('Saving start node with input parameters:', inputParameters);
      console.log('Updated config:', updatedConfig);
    }

    // Prepare config with tool parameters for call_tool node
    if (node.type === 'call_tool') {
      const paramsObject: Record<string, any> = {};
      toolParameters.forEach(param => {
        if (param.key.trim()) {
          // Try to parse value as JSON, otherwise keep as string
          try {
            paramsObject[param.key] = JSON.parse(param.value);
          } catch {
            paramsObject[param.key] = param.value;
          }
        }
      });
      updatedConfig.parameters = JSON.stringify(paramsObject);
      console.log('Saving call_tool node with parameters:', paramsObject);
      console.log('Updated config:', updatedConfig);
    }

    // Validate and prepare config for create_object node
    if (node.type === 'create_object') {
      // Validate template selection
      if (!updatedConfig.template_id) {
        setError('Template selection is required');
        toast({
          title: "Validation Error",
          description: "Please select a template",
          variant: "destructive",
        });
        return;
      }

      // Validate at least one property is selected
      if (Object.keys(selectedProperties).length === 0) {
        setError('At least one property must be selected');
        toast({
          title: "Validation Error",
          description: "Please select at least one property to configure",
          variant: "destructive",
        });
        return;
      }

      updatedConfig.properties = selectedProperties;
      console.log('Saving create_object node with config:', updatedConfig);
    }

    const dataToSave = {
      ...node.data,
      label,
      description,
      config: updatedConfig
    };

    console.log('Saving node data:', dataToSave);

    onSave(node.id, dataToSave);

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
      create_object: 'Create Object Node',
      log: 'Log Node',
      conditional: 'Conditional Node',
      set_variable: 'Set Variable Node',
      return: 'Return Node'
    };
    return labels[type] || type;
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 overflow-y-auto p-4">
      <Card className="w-full max-w-4xl mx-auto">
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
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-xs">Input Parameters</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={addParameter}
                      className="h-7 text-xs"
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      Add Parameter
                    </Button>
                  </div>
                  
                  {inputParameters.length === 0 ? (
                    <div className="text-xs text-muted-foreground text-center py-4 border border-dashed rounded-lg">
                      No parameters defined. Click "Add Parameter" to create one.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {/* Header row */}
                      <div className="grid grid-cols-[1.5fr_1.5fr_120px_80px_40px] gap-2 px-3 pb-1">
                        <Label className="text-xs text-muted-foreground">Name</Label>
                        <Label className="text-xs text-muted-foreground">Default Value</Label>
                        <Label className="text-xs text-muted-foreground">Type</Label>
                        <Label className="text-xs text-muted-foreground">Required</Label>
                        <div></div>
                      </div>

                      {inputParameters.map((param, index) => (
                        <div key={index} className="border rounded-lg p-3 bg-background space-y-2">
                          <div className="grid grid-cols-[1.5fr_1.5fr_120px_80px_40px] gap-2 items-center">
                            <Input
                              value={param.name}
                              onChange={(e) => updateParameter(index, 'name', e.target.value)}
                              placeholder="e.g., task_id"
                              className="h-9 text-sm"
                            />

                            <Input
                              value={param.default_value || ''}
                              onChange={(e) => updateParameter(index, 'default_value', e.target.value)}
                              placeholder="Default value..."
                              className="h-9 text-sm"
                            />

                            <Select
                              value={param.type}
                              onValueChange={(value) => updateParameter(index, 'type', value)}
                            >
                              <SelectTrigger className="h-9 text-sm">
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

                            <div className="flex items-center justify-center">
                              <Checkbox
                                checked={param.required}
                                onCheckedChange={(checked) => updateParameter(index, 'required', checked)}
                              />
                            </div>

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

                          {/* Description field on second row */}
                          <div className="pl-0">
                            <Input
                              value={param.description || ''}
                              onChange={(e) => updateParameter(index, 'description', e.target.value)}
                              placeholder="Description (optional)..."
                              className="h-9 text-sm text-muted-foreground"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
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
                    onValueChange={handleToolSelection}
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
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-xs">Parameters</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={addToolParameter}
                      className="h-7 text-xs"
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      Add Parameter
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mb-2">
                    Use ${'{{input.paramName}}'} to reference start node parameters
                  </p>

                  {toolParameters.length === 0 ? (
                    <div className="text-xs text-muted-foreground text-center py-4 border border-dashed rounded-lg">
                      No parameters defined. Click "Add Parameter" to create one.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {/* Header row */}
                      <div className="grid grid-cols-[1fr_2fr_40px] gap-2 px-3 pb-1">
                        <Label className="text-xs text-muted-foreground">Key</Label>
                        <Label className="text-xs text-muted-foreground">Value</Label>
                        <div></div>
                      </div>

                      {toolParameters.map((param, index) => (
                        <div key={index} className="border rounded-lg p-3 bg-background">
                          <div className="grid grid-cols-[1fr_2fr_40px] gap-2 items-center">
                            <div className="flex items-center gap-1">
                              <Input
                                value={param.key}
                                onChange={(e) => updateToolParameter(index, 'key', e.target.value)}
                                placeholder="e.g., object_id"
                                className="h-9 text-sm font-mono"
                                disabled={!!param.required}
                              />
                              {param.required && (
                                <span className="text-red-500 text-xs font-bold" title="Required">*</span>
                              )}
                            </div>

                            <Input
                              value={param.value}
                              onChange={(e) => updateToolParameter(index, 'value', e.target.value)}
                              placeholder={param.description || `e.g., 123 or {{input.task_id}}`}
                              className="h-9 text-sm font-mono"
                            />

                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => removeToolParameter(index)}
                              className="h-9 w-9 text-destructive hover:text-destructive hover:bg-destructive/10"
                              disabled={!!param.required}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {node.type === 'create_object' && (
              <div className="border rounded-xl border-border bg-muted/5 p-4 space-y-4">
                <h3 className="text-sm font-semibold mb-2">Create Object Configuration</h3>

                {/* Template Selection */}
                <div>
                  <Label className="text-xs">Select Template</Label>
                  {isLoadingTemplates ? (
                    <div className="flex items-center gap-2 p-2 text-sm text-muted-foreground">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Loading templates...
                    </div>
                  ) : (
                    <Select
                      value={config.template_id?.toString() || ''}
                      onValueChange={handleTemplateSelection}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a template..." />
                      </SelectTrigger>
                      <SelectContent>
                        {availableTemplates.map((template) => (
                          <SelectItem key={template.id} value={template.id.toString()}>
                            {template.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">
                    Choose the type of object to create (Task, Project, Epic, Rule)
                  </p>
                </div>

                {/* Properties Configuration */}
                {config.template_id && (
                  <div>
                    <Label className="text-xs mb-2 block">Configure Properties</Label>
                    {isLoadingProperties ? (
                      <div className="flex items-center gap-2 p-2 text-sm text-muted-foreground">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Loading properties...
                      </div>
                    ) : availableProperties.length === 0 ? (
                      <div className="text-xs text-muted-foreground text-center py-4 border border-dashed rounded-lg">
                        No properties available for this template
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {/* Selected Properties List */}
                        {Object.keys(selectedProperties).length > 0 && (
                          <div className="space-y-2">
                            {Object.keys(selectedProperties).map((propKey) => {
                              const currentValue = selectedProperties[propKey];
                              const isDirectInput = currentValue === true;
                              const hasWorkflowParams = workflowParameters.length > 0;

                              return (
                                <div key={propKey} className="border rounded-lg p-3 bg-background space-y-2">
                                  <div className="flex items-center justify-between">
                                    <Label className="text-sm font-medium">{propKey}</Label>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => removeProperty(propKey)}
                                      className="h-6 w-6 text-destructive hover:text-destructive hover:bg-destructive/10"
                                    >
                                      <X className="h-4 w-4" />
                                    </Button>
                                  </div>

                                  {/* Parameter Mapping Dropdown */}
                                  {hasWorkflowParams && (
                                    <div>
                                      <Label className="text-xs text-muted-foreground mb-1 block">
                                        Map to workflow parameter (optional)
                                      </Label>
                                      <Select
                                        value={typeof currentValue === 'string' ? currentValue : ''}
                                        onValueChange={(value) => {
                                          if (value === '__direct__') {
                                            updatePropertyMapping(propKey, true);
                                          } else {
                                            updatePropertyMapping(propKey, `{{input.${value}}}`);
                                          }
                                        }}
                                      >
                                        <SelectTrigger className="h-8 text-sm">
                                          <SelectValue placeholder="Direct input (agent fills)" />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="__direct__">
                                            <span className="text-muted-foreground">Direct input (agent fills)</span>
                                          </SelectItem>
                                          {workflowParameters.map((param) => (
                                            <SelectItem key={param} value={param}>
                                              <span className="font-mono text-xs">{`{{input.${param}}}`}</span>
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                      {typeof currentValue === 'string' && (
                                        <p className="text-xs text-muted-foreground mt-1">
                                          Will use: <span className="font-mono">{currentValue}</span>
                                        </p>
                                      )}
                                    </div>
                                  )}

                                  {!hasWorkflowParams && (
                                    <p className="text-xs text-muted-foreground italic">
                                      No workflow parameters defined. The agent will fill this value directly.
                                    </p>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* Add Property Dropdown */}
                        <Select onValueChange={addProperty}>
                          <SelectTrigger>
                            <SelectValue placeholder="Add a property..." />
                          </SelectTrigger>
                          <SelectContent>
                            {availableProperties
                              .filter(prop => !(prop.key in selectedProperties))
                              .map((prop) => (
                                <SelectItem key={prop.key} value={prop.key}>
                                  {prop.key}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">
                          Use {'{{input.field}}'} for start node parameters or {'{{variable.name}}'} for workflow variables.
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Result Variable */}
                {config.template_id && (
                  <div>
                    <Label className="text-xs">Result Variable (Optional)</Label>
                    <Input
                      value={config.result_variable || ''}
                      onChange={(e) => setConfig({ ...config, result_variable: e.target.value })}
                      placeholder="e.g., created_task, new_project"
                      className="font-mono text-sm"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Store the created object ID in a variable for use in subsequent nodes
                    </p>
                  </div>
                )}
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
            {onDelete && node.deletable !== false && (
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

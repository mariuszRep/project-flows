import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { AutoTextarea } from '@/components/ui/auto-textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { X, Save, Trash2, Plus, Loader2, Link, Unlink } from 'lucide-react';
import { Node } from 'reactflow';
import { useToast } from '@/hooks/use-toast';
import { useMCP } from '@/contexts/MCPContext';
import { ParameterSelector, PreviousStep } from './ParameterSelector';

interface NodeEditModalProps {
  node: Node | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (nodeId: string, data: Record<string, unknown>) => void;
  onDelete?: (nodeId: string) => void;
  workflowId?: number | null;
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

export function NodeEditModal({ node, isOpen, onClose, onSave, onDelete, workflowId }: NodeEditModalProps) {
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
  const [propertyEnabled, setPropertyEnabled] = useState<Record<string, boolean>>({});
  const [allowedParentTypes, setAllowedParentTypes] = useState<any[]>([]);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);
  const [isLoadingProperties, setIsLoadingProperties] = useState(false);
  const [workflowParameters, setWorkflowParameters] = useState<string[]>([]);
  const [previousSteps, setPreviousSteps] = useState<PreviousStep[]>([]);
  const [relatedParents, setRelatedParents] = useState<Record<string, {
    enabled: boolean;
    id: string | number;
  }>>({});
  const [stageLinked, setStageLinked] = useState(false);

  // State for call_function configuration
  const [availableFunctions, setAvailableFunctions] = useState<any[]>([]);
  const [isLoadingFunctions, setIsLoadingFunctions] = useState(false);
  const [functionParameters, setFunctionParameters] = useState<Record<string, string>>({});

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

      // Parse create_object configuration
      if (node.type === 'create_object') {
        const properties = node.data.config?.properties;
        if (properties && typeof properties === 'object') {
          setSelectedProperties(properties);
          // Mark properties with values as enabled
          const enabled: Record<string, boolean> = {};
          Object.keys(properties).forEach(key => {
            enabled[key] = true;
          });
          setPropertyEnabled(enabled);
        } else {
          setSelectedProperties({});
          setPropertyEnabled({});
        }

        // Parse related array from config
        const related = node.data.config?.related;
        if (Array.isArray(related)) {
          const parsedParents: Record<string, any> = {};
          related.forEach((entry: any) => {
            parsedParents[entry.object] = {
              enabled: true,
              id: entry.id || ''
            };
          });
          // Merge with allowed types (will be set by loadTemplateSchema)
          setRelatedParents(prev => ({ ...prev, ...parsedParents }));
        }

        // Check if stage is linked to a parameter
        const stage = node.data.config?.stage;
        setStageLinked(typeof stage === 'string' && stage.includes('{{'));
      } else {
        setSelectedProperties({});
        setPropertyEnabled({});
        setRelatedParents({});
        setStageLinked(false);
      }

      // Parse load_object configuration
      if (node.type === 'load_object') {
        const properties = node.data.config?.properties;
        if (properties && typeof properties === 'object') {
          setSelectedProperties(properties);
        } else {
          setSelectedProperties({});
        }
      } else if (node.type !== 'create_object') {
        setSelectedProperties({});
      }

      // Parse call_function configuration
      if (node.type === 'call_function') {
        const parameters = node.data.config?.parameters;
        if (parameters && typeof parameters === 'object') {
          setFunctionParameters(parameters);
        } else {
          setFunctionParameters({});
        }
      } else {
        setFunctionParameters({});
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
        console.log('[NodeEditModal] Skipping parameter load - prerequisites not met', {
          isOpen,
          hasNode: !!node,
          isConnected,
          hasCallTool: !!callTool,
          hasWorkflowId: !!workflowId
        });
        return;
      }

      if (!workflowId) {
        console.warn('[NodeEditModal] No workflow ID provided, cannot load parameters');
        setWorkflowParameters([]);
        return;
      }

      try {
        console.log('[NodeEditModal] Loading properties for workflow template:', workflowId);

        // Load properties with step_type='property' which are the workflow input parameters
        const result = await callTool('list_properties', { template_id: workflowId });

        console.log('[NodeEditModal] list_properties result:', result);

        if (result && result.content && result.content[0]) {
          const propsText = result.content[0].text;

          if (!propsText.includes('No properties found')) {
            const properties = JSON.parse(propsText);
            console.log('[NodeEditModal] Parsed properties:', properties);

            // Filter to only properties with step_type='property' (workflow parameters)
            const parameterProps = Array.isArray(properties)
              ? properties.filter((p: any) => p.step_type === 'property')
              : [];

            console.log('[NodeEditModal] Filtered parameter properties:', parameterProps);

            // Extract parameter names (keys)
            const paramNames = parameterProps.map((p: any) => p.key);
            console.log('[NodeEditModal] ✅ Loaded workflow parameters:', paramNames);
            setWorkflowParameters(paramNames);
          } else {
            console.log('[NodeEditModal] No properties found for workflow');
            setWorkflowParameters([]);
          }
        } else {
          console.warn('[NodeEditModal] Empty or invalid result from list_properties');
          setWorkflowParameters([]);
        }
      } catch (error) {
        console.error('[NodeEditModal] Error loading workflow parameters:', error);
        setWorkflowParameters([]);
      }
    };

    loadWorkflowParameters();
  }, [isOpen, node, isConnected, callTool, workflowId]);

  // Extract previous steps from workflow for parameter selection
  useEffect(() => {
    if (!isOpen || !node) {
      setPreviousSteps([]);
      return;
    }

    // Helper function to extract previous steps from the workflow
    // This is a simplified version - in a real implementation, you'd traverse the workflow graph
    const extractPreviousSteps = (): PreviousStep[] => {
      const steps: PreviousStep[] = [];

      // For now, we'll return a placeholder
      // TODO: Implement proper workflow graph traversal to find all previous steps
      // and extract their result_variable configurations

      return steps;
    };

    setPreviousSteps(extractPreviousSteps());
  }, [isOpen, node]);

  // Load templates for create_object and load_object nodes
  useEffect(() => {
    const loadTemplates = async () => {
      if (!isOpen || !node || (node.type !== 'create_object' && node.type !== 'load_object') || !isConnected || !callTool) {
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

  // Load available functions for call_function nodes
  useEffect(() => {
    const loadFunctions = async () => {
      if (!isOpen || !node || node.type !== 'call_function') {
        return;
      }

      setIsLoadingFunctions(true);
      try {
        const response = await fetch('http://localhost:3001/api/functions');
        if (response.ok) {
          const data = await response.json();
          if (data.success && Array.isArray(data.functions)) {
            setAvailableFunctions(data.functions);
          } else {
            setAvailableFunctions([]);
          }
        } else {
          setAvailableFunctions([]);
        }
      } catch (error) {
        console.error('Error loading functions:', error);
        setAvailableFunctions([]);
      } finally {
        setIsLoadingFunctions(false);
      }
    };

    loadFunctions();
  }, [isOpen, node]);

  // Load properties when template is selected
  useEffect(() => {
    const loadProperties = async () => {
      const templateId = config.template_id;
      if (!isOpen || !node || (node.type !== 'create_object' && node.type !== 'load_object') || !templateId || !isConnected || !callTool) {
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

  // Load template's related_schema when template is selected
  useEffect(() => {
    const loadTemplateSchema = async () => {
      const templateId = config.template_id;
      if (!isOpen || !node || node.type !== 'create_object' || !templateId || !isConnected || !callTool) {
        setAllowedParentTypes([]);
        return;
      }

      try {
        const result = await callTool('get_template', { template_id: templateId });
        if (result && result.content && result.content[0]) {
          const templateData = JSON.parse(result.content[0].text);

          if (templateData.related_schema && Array.isArray(templateData.related_schema)) {
            setAllowedParentTypes(templateData.related_schema);

            // Initialize relatedParents state with all allowed types, preserving any existing values from config
            setRelatedParents(prev => {
              const initialParents: Record<string, any> = {};
              templateData.related_schema.forEach((schema: any) => {
                // If parent was already loaded from config, keep it; otherwise initialize with defaults
                initialParents[schema.key] = prev[schema.key] || {
                  enabled: false,
                  id: ''
                };
              });
              return initialParents;
            });
          } else {
            setAllowedParentTypes([]);
            setRelatedParents({});
          }
        }
      } catch (error) {
        console.error('Error loading template schema:', error);
        setAllowedParentTypes([]);
        setRelatedParents({});
      }
    };

    loadTemplateSchema();
  }, [config.template_id, isOpen, node, isConnected, callTool]);

  if (!isOpen || !node) {
    return null;
  }

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
      [propertyKey]: '' // Empty string means property is selected but no value assigned yet
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

  // Handler to create a new workflow parameter and update the start node
  const handleCreateWorkflowParameter = async (paramName: string, paramType: string) => {
    if (!isConnected || !callTool || !workflowId) {
      toast({
        title: "Error",
        description: "Cannot create workflow parameter: not connected to MCP",
        variant: "destructive",
      });
      return;
    }

    try {
      // Create the new property in the workflow template
      await callTool('create_property', {
        template_id: workflowId,
        key: paramName,
        type: paramType,
        description: `Auto-generated parameter for ${paramName}`,
        step_type: 'property',
        execution_order: 0
      });

      // Refresh workflow parameters
      setWorkflowParameters([...workflowParameters, paramName]);

      toast({
        title: "Success",
        description: `Added "${paramName}" as workflow parameter`,
      });
    } catch (error) {
      console.error('Error creating workflow parameter:', error);
      toast({
        title: "Error",
        description: "Failed to create workflow parameter",
        variant: "destructive",
      });
    }
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

    // Validate function node
    if (node.type === 'call_function') {
      if (!config.function_name) {
        setError('Function selection is required');
        toast({
          title: "Validation Error",
          description: "Please select a function to execute",
          variant: "destructive",
        });
        return;
      }

      // Validate required parameters
      const selectedFunction = availableFunctions.find(f => f.name === config.function_name);
      if (selectedFunction) {
        const missingParams = selectedFunction.parameters
          .filter((p: any) => p.required && !config.parameters?.[p.name]);
        
        if (missingParams.length > 0) {
          setError(`Missing required parameters: ${missingParams.map(p => p.name).join(', ')}`);
          toast({
            title: "Validation Error",
            description: `Missing required parameters: ${missingParams.map(p => p.name).join(', ')}`,
            variant: "destructive",
          });
          return;
        }
      }
    }

    // Prepare config
    const updatedConfig = { ...config };

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

      // Filter to only include enabled properties
      const enabledProperties: Record<string, any> = {};
      Object.keys(propertyEnabled).forEach(key => {
        if (propertyEnabled[key] && selectedProperties[key] !== undefined) {
          enabledProperties[key] = selectedProperties[key];
        }
      });

      // Validate at least one property is enabled
      if (Object.keys(enabledProperties).length === 0) {
        setError('At least one property must be enabled');
        toast({
          title: "Validation Error",
          description: "Please enable at least one property to configure",
          variant: "destructive",
        });
        return;
      }

      updatedConfig.properties = enabledProperties;

      // Add stage if specified
      if (config.stage) {
        updatedConfig.stage = config.stage;
      }

      // Add related array for enabled parents
      const enabledParents = Object.keys(relatedParents).filter(key => relatedParents[key].enabled);
      if (enabledParents.length > 0) {
        updatedConfig.related = enabledParents.map(parentKey => {
          const parent = relatedParents[parentKey];
          return {
            object: parentKey,
            id: parent.id
          };
        });
      }

      console.log('Saving create_object node with config:', updatedConfig);
    }

    // Validate and prepare config for load_object node
    if (node.type === 'load_object') {
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
      console.log('Saving load_object node with config:', updatedConfig);
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
      agent: 'Agent Node',
      create_object: 'Create Object Node',
      load_object: 'Load Object Node',
      call_function: 'Function Node'
    };
    return labels[type] || type;
  };

  // Handler for function selection
  const handleFunctionSelection = (functionName: string) => {
    // Find the selected function to get its parameters
    const selectedFunc = availableFunctions.find(f => f.name === functionName);
    setConfig({ 
      ...config, 
      function_name: functionName,
      // Initialize parameters if they don't exist
      parameters: config.parameters || {}
    });
  };

  // Update function parameter value
  const updateFunctionParameter = (paramName: string, value: string) => {
    setConfig({
      ...config,
      parameters: {
        ...(config.parameters || {}),
        [paramName]: value
      }
    });
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

            {/* Agent Node Configuration */}
            {node.type === 'agent' && (
              <div className="border rounded-xl border-border bg-muted/5 p-4 space-y-3">
                <h3 className="text-sm font-semibold mb-2">Agent Configuration</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">Instructions</Label>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const instructions = config.instructions || [];
                        setConfig({ ...config, instructions: [...instructions, ''] });
                      }}
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      Add Instruction
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Instructions will be presented to the AI agent for execution. Use <code className="bg-muted px-1 rounded">{'{{input.field}}'}</code> to reference workflow parameters or <code className="bg-muted px-1 rounded">{'{{variable.name}}'}</code> to reference previous step results.
                  </p>
                  {(config.instructions || []).map((instruction: string, index: number) => (
                    <div key={index} className="flex gap-2">
                      <AutoTextarea
                        value={instruction}
                        onChange={(e) => {
                          const instructions = [...(config.instructions || [])];
                          instructions[index] = e.target.value;
                          setConfig({ ...config, instructions });
                        }}
                        placeholder={`Instruction ${index + 1}... Use {{input.field}} or {{variable.name}}`}
                        minRows={2}
                        maxRows={8}
                        className="font-mono text-sm flex-1"
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          const instructions = [...(config.instructions || [])];
                          instructions.splice(index, 1);
                          setConfig({ ...config, instructions });
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  {(!config.instructions || config.instructions.length === 0) && (
                    <div className="text-center py-4 text-sm text-muted-foreground border-2 border-dashed rounded">
                      No instructions yet. Click "Add Instruction" to add your first instruction.
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
                      <div className="space-y-2">
                        {availableProperties.map((property) => {
                          const isEnabled = propertyEnabled[property.key] || false;
                          const currentValue = selectedProperties[property.key] || '';

                          return (
                            <div key={property.key} className="rounded-lg p-3 bg-background">
                              <div className="flex items-start gap-3">
                                {/* Enable/Disable Checkbox */}
                                <div className="pt-2">
                                  <Checkbox
                                    checked={isEnabled}
                                    onCheckedChange={(checked) => {
                                      setPropertyEnabled({
                                        ...propertyEnabled,
                                        [property.key]: !!checked
                                      });
                                      if (!checked) {
                                        // Clear value when disabled
                                        const newProps = { ...selectedProperties };
                                        delete newProps[property.key];
                                        setSelectedProperties(newProps);
                                      }
                                    }}
                                  />
                                </div>

                                {/* Property Configuration */}
                                <div className="flex-1 space-y-2">
                                  <div className="flex items-center gap-2">
                                    <Label className="text-sm font-medium">{property.key}</Label>
                                    <Badge variant="outline" className="text-xs">
                                      {property.type || 'text'}
                                    </Badge>
                                  </div>

                                  {property.description && (
                                    <p className="text-xs text-muted-foreground">{property.description}</p>
                                  )}

                                  <div className={!isEnabled ? 'opacity-50 pointer-events-none' : ''}>
                                    <ParameterSelector
                                      value={currentValue}
                                      onChange={(newValue) => {
                                        setSelectedProperties({
                                          ...selectedProperties,
                                          [property.key]: newValue
                                        });
                                      }}
                                      propertyKey={property.key}
                                      propertyType={property.type || 'text'}
                                      propertyDescription={property.description}
                                      workflowParameters={workflowParameters}
                                      previousSteps={previousSteps}
                                      placeholder="Enter value or link parameter"
                                      onCreateWorkflowParameter={handleCreateWorkflowParameter}
                                    />
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* Stage Selection */}
                {config.template_id && (
                  <div>
                    <Label className="text-xs mb-2 block">Stage (Optional)</Label>
                    <div className="flex items-center gap-2">
                      <div className="flex-1">
                        {stageLinked ? (
                          <Select
                            value={(() => {
                              const match = (config.stage || '').match(/\{\{(.*?)\}\}/);
                              return match ? match[1] : '';
                            })()}
                            onValueChange={(value) => setConfig({ ...config, stage: `{{${value}}}` })}
                          >
                            <SelectTrigger className="h-9 text-sm font-mono">
                              <SelectValue placeholder="Select parameter..." />
                            </SelectTrigger>
                            <SelectContent className="max-h-[300px]">
                              {workflowParameters.length === 0 ? (
                                <div className="px-2 py-4 text-center text-sm text-muted-foreground">
                                  No parameters available
                                </div>
                              ) : (
                                <>
                                  <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                                    Workflow Parameters
                                  </div>
                                  {workflowParameters.map(param => (
                                    <SelectItem key={param} value={`steps.input.${param}`}>
                                      <span className="font-mono text-xs">{param}</span>
                                    </SelectItem>
                                  ))}
                                </>
                              )}
                            </SelectContent>
                          </Select>
                        ) : (
                          <Select
                            value={config.stage || ''}
                            onValueChange={(value) => setConfig({ ...config, stage: value || undefined })}
                          >
                            <SelectTrigger className="h-9 text-sm">
                              <SelectValue placeholder="Select stage..." />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="draft">Draft</SelectItem>
                              <SelectItem value="backlog">Backlog</SelectItem>
                              <SelectItem value="doing">Doing</SelectItem>
                              <SelectItem value="review">Review</SelectItem>
                              <SelectItem value="completed">Completed</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setStageLinked(!stageLinked);
                          setConfig({ ...config, stage: undefined });
                        }}
                        className="h-9 w-9 shrink-0"
                        title={stageLinked ? 'Switch to manual value' : 'Link to parameter'}
                      >
                        {stageLinked ? (
                          <Link className="h-4 w-4" />
                        ) : (
                          <Unlink className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Defaults to 'draft' if not specified
                    </p>
                  </div>
                )}

                {/* Related Parent Relationships */}
                {config.template_id && allowedParentTypes.length > 0 && (
                  <div>
                    <Label className="text-xs mb-2 block">Related Parents (Optional)</Label>
                    <div className="space-y-3">
                      {allowedParentTypes.map((parentSchema: any) => {
                        const parentKey = parentSchema.key;
                        const parent = relatedParents[parentKey];
                        if (!parent) return null;

                        const isEnabled = parent.enabled;
                        const templateIds = parentSchema.allowed_types || [];

                        return (
                          <div key={parentKey} className="rounded-lg p-4 bg-muted/5">
                            {/* Header with Enable/Disable and Type Label */}
                            <div className="flex items-start gap-3">
                              <div className="pt-1">
                                <Checkbox
                                  checked={isEnabled}
                                  onCheckedChange={(checked) => {
                                    setRelatedParents(prev => ({
                                      ...prev,
                                      [parentKey]: {
                                        ...prev[parentKey],
                                        enabled: !!checked
                                      }
                                    }));
                                  }}
                                />
                              </div>
                              <div className="flex-1 space-y-2">
                                <div className="flex items-center gap-2">
                                  <Label className="text-sm font-medium capitalize">
                                    {parentSchema.label || parentKey} ID{parentSchema.cardinality === 'multiple' ? 's' : ''}
                                  </Label>
                                  <Badge variant="outline" className="text-xs">
                                    {parentSchema.cardinality || 'single'}
                                  </Badge>
                                  {parentSchema.required && (
                                    <Badge variant="destructive" className="text-xs">Required</Badge>
                                  )}
                                </div>

                                {/* ID Field */}
                                {isEnabled && (
                                  <div className={!isEnabled ? 'opacity-50 pointer-events-none' : ''}>
                                    <ParameterSelector
                                      value={parent.id?.toString() || ''}
                                      onChange={(newValue) => {
                                        setRelatedParents(prev => ({
                                          ...prev,
                                          [parentKey]: {
                                            ...prev[parentKey],
                                            id: newValue
                                          }
                                        }));
                                      }}
                                      propertyKey="id"
                                      propertyType="number"
                                      propertyDescription={`ID of the ${parentSchema.label || parentKey} to link`}
                                      workflowParameters={workflowParameters}
                                      previousSteps={previousSteps}
                                      placeholder="Enter ID or link parameter"
                                      onCreateWorkflowParameter={handleCreateWorkflowParameter}
                                    />
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      Enable parent relationships and provide their IDs (or link to parameters)
                    </p>
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

            {node.type === 'load_object' && (
              <div className="border rounded-xl border-border bg-muted/5 p-4 space-y-4">
                <h3 className="text-sm font-semibold mb-2">Load Object Configuration</h3>

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
                    Choose the type of object to load properties from (Task, Project, Epic, Rule)
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
                          <div className="space-y-3">
                            {Object.keys(selectedProperties).map((propKey) => {
                              const property = availableProperties.find(p => p.key === propKey);
                              const currentValue = selectedProperties[propKey];

                              return (
                                <div key={propKey} className="rounded-lg p-3 bg-background">
                                  <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                      <Label className="text-sm font-medium">{propKey}</Label>
                                      {property?.type && (
                                        <Badge variant="outline" className="text-xs">
                                          {property.type}
                                        </Badge>
                                      )}
                                    </div>
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

                                  <ParameterSelector
                                    value={currentValue}
                                    onChange={(newValue) => updatePropertyMapping(propKey, newValue)}
                                    propertyKey={propKey}
                                    propertyType={property?.type || 'text'}
                                    propertyDescription={property?.description}
                                    workflowParameters={workflowParameters}
                                    previousSteps={previousSteps}
                                    placeholder="Select parameter or enter value"
                                    onCreateWorkflowParameter={handleCreateWorkflowParameter}
                                  />
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
                      placeholder="e.g., loaded_schema, property_info"
                      className="font-mono text-sm"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Store the loaded property schema in a variable for use in subsequent nodes
                    </p>
                  </div>
                )}
              </div>
            )}


            {/* Function Node Configuration */}
            {node.type === 'call_function' && (
              <div className="border rounded-xl border-border bg-muted/5 p-4 space-y-4">
                <h3 className="text-sm font-semibold mb-2">Function Configuration</h3>

                {/* Function Selection */}
                <div>
                  <Label className="text-xs">Select Function</Label>
                  {isLoadingFunctions ? (
                    <div className="flex items-center gap-2 p-2 text-sm text-muted-foreground">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Loading functions...
                    </div>
                  ) : (
                    <Select
                      value={config.function_name || ''}
                      onValueChange={handleFunctionSelection}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a function..." />
                      </SelectTrigger>
                      <SelectContent>
                        {availableFunctions.length === 0 ? (
                          <div className="p-2 text-sm text-muted-foreground">
                            No functions available
                          </div>
                        ) : (
                          availableFunctions.map((func) => (
                            <SelectItem key={func.name} value={func.name}>
                              {func.name}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">
                    Select a function to execute in this node
                  </p>
                </div>

                {/* Function Parameters */}
                {config.function_name && (
                  <div className="space-y-3">
                    <Label className="text-xs">Parameters</Label>
                    {availableFunctions
                      .find(f => f.name === config.function_name)
                      ?.parameters?.map((param: any) => (
                        <div key={param.name} className="space-y-1">
                          <div className="flex items-center gap-2">
                            <Label className="text-xs font-medium">{param.name}</Label>
                            <Badge variant="outline" className="text-xs">
                              {param.type}
                            </Badge>
                            {param.required && (
                              <Badge variant="destructive" className="text-xs">
                                Required
                              </Badge>
                            )}
                          </div>
                          {param.description && (
                            <p className="text-xs text-muted-foreground">{param.description}</p>
                          )}
                          <ParameterSelector
                            value={config.parameters?.[param.name] || ''}
                            onChange={(value) => updateFunctionParameter(param.name, value)}
                            propertyKey={param.name}
                            propertyType={param.type}
                            propertyDescription={param.description}
                            workflowParameters={workflowParameters}
                            previousSteps={previousSteps}
                            placeholder={`Enter ${param.name} value or link parameter`}
                            onCreateWorkflowParameter={handleCreateWorkflowParameter}
                          />
                        </div>
                      ))}
                  </div>
                )}

                {/* Result Variable */}
                <div>
                  <Label className="text-xs">Result Variable (Optional)</Label>
                  <Input
                    value={config.result_variable || ''}
                    onChange={(e) => setConfig({ ...config, result_variable: e.target.value })}
                    placeholder="e.g., function_result, calculation"
                    className="font-mono text-sm"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Store the function result in a variable for use in subsequent nodes
                  </p>
                </div>
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

/**
 * Workflow Executor - Interprets and executes workflow step definitions
 * Supports: agent, create_object, and load_object step types
 */

import DatabaseService from '../database.js';
import { RelatedEntry } from './create-handler.js';
import { functionRegistry } from '../workflow-functions/function-registry.js';

export interface WorkflowStep {
  name: string;
  type: 'agent' | 'create_object' | 'load_object' | 'call_function';
  // Agent fields
  instructions?: string[];
  // Create/Load object fields
  templateId?: number;
  properties?: Record<string, any>;
  resultVariable?: string;
  stage?: string;
  related?: RelatedEntry[];
  // Call function fields
  functionName?: string;
  parameters?: Record<string, any>;
  status?: 'pending' | 'completed' | 'failed';
}

export interface WorkflowDefinition {
  name: string;
  description: string;
  inputSchema: any;
  steps: WorkflowStep[];
}

export interface StepResult {
  step: string;
  type: string;
  status: 'completed' | 'failed';
  output?: any;
  error?: string;
}

export interface ExecutionContext {
  variables: Map<string, any>;
  inputs: Record<string, any>;
  logs: string[];
  stepResults: StepResult[];
  result?: any;
  currentStep: number;
}

/**
 * Tool caller interface for invoking MCP tools from workflows
 */
export interface ToolCaller {
  callTool(toolName: string, parameters: Record<string, any>): Promise<any>;
}

export class WorkflowExecutor {
  private dbService?: DatabaseService;
  private toolCaller?: ToolCaller;
  private server?: any; // MCP Server instance for sampling

  constructor(dbService?: DatabaseService, toolCaller?: ToolCaller, server?: any) {
    this.dbService = dbService;
    this.toolCaller = toolCaller;
    this.server = server;
  }

  /**
   * Load workflow definition from database by template_id
   */
  async loadWorkflowFromDatabase(templateId: number): Promise<WorkflowDefinition | null> {
    if (!this.dbService) {
      throw new Error('DatabaseService is required to load workflows from database');
    }

    try {
      // Get workflow template
      const templates = await this.dbService.getTemplates();
      const template = templates.find(t => t.id === templateId);

      if (!template) {
        return null;
      }

      // Check if it's a workflow template
      const templateData = template as any;
      if (templateData.type !== 'workflow') {
        throw new Error(`Template ${templateId} is not a workflow (type: ${templateData.type})`);
      }

      // Get workflow steps from template_properties
      const properties = await this.dbService.listProperties(templateId);
      console.log(`[Workflow Loader] Loaded ${properties.length} properties for template ${templateId}`);

      // Get workflow configuration from template metadata
      const metadata = templateData.metadata || {};
      const workflowName = metadata.mcp_tool_name || template.name.toLowerCase().replace(/\s+/g, '_');
      const workflowDescription = metadata.tool_description || template.description;

      // NEW APPROACH: Load workflow parameters from properties table (step_type='property')
      const parameterProperties = properties.filter((prop: any) => prop.step_type === 'property');
      console.log(`[Workflow Loader] Found ${parameterProperties.length} parameter properties for workflow ${templateId}`);

      // Build input schema from parameter properties
      const inputSchema = this.buildInputSchemaFromPropertiesTable(parameterProperties);
      console.log(`[Workflow Loader] Built input schema with ${Object.keys(inputSchema.properties || {}).length} parameters`);
      console.log(`[Workflow Loader] Tool name: ${workflowName}`);

      // Filter only executable workflow steps (exclude 'property' and 'start')
      const stepProperties = properties.filter((prop: any) => {
        return prop.step_type && prop.step_type !== 'property' && prop.step_type !== 'start';
      });
      console.log(`[Workflow Loader] Filtered to ${stepProperties.length} executable workflow steps`);

      // Sort by execution_order
      stepProperties.sort((a: any, b: any) => {
        return (a.execution_order || 0) - (b.execution_order || 0);
      });

      // Convert database records to WorkflowStep objects
      const steps: WorkflowStep[] = stepProperties.map((prop: any) => {
        const config = prop.step_config || {};
        const step: WorkflowStep = {
          name: prop.key,
          type: prop.step_type,
        };

        // Map config properties to step properties based on step type
        switch (prop.step_type) {
          case 'agent':
            step.instructions = config.instructions;
            break;

          case 'create_object':
            step.templateId = config.template_id;
            step.properties = config.properties;
            step.resultVariable = config.result_variable;
            step.stage = config.stage;
            step.related = config.related;
            break;

          case 'load_object':
            step.templateId = config.template_id;
            step.properties = config.properties;
            step.resultVariable = config.result_variable;
            break;

          case 'call_function':
            step.functionName = config.function_name;
            step.parameters = config.parameters;
            step.resultVariable = config.result_variable;
            break;

          default:
            console.warn(`Unknown step type: ${prop.step_type}, skipping configuration`);
            break;
        }

        return step;
      });

      // ENHANCEMENT: Dynamically add create_object properties to input schema
      // This exposes property descriptions to the agent when calling the workflow
      const enhancedInputSchema = await this.enhanceSchemaWithCreateObjectProperties(inputSchema, steps);

      const workflow: WorkflowDefinition = {
        name: workflowName,
        description: workflowDescription,
        inputSchema: enhancedInputSchema,
        steps,
      };

      return workflow;
    } catch (error) {
      console.error('Error loading workflow from database:', error);
      throw error;
    }
  }

  /**
   * Enhance input schema by adding properties from create_object steps
   * This makes create_object properties visible to the agent when calling the workflow
   */
  private async enhanceSchemaWithCreateObjectProperties(
    baseSchema: any,
    steps: WorkflowStep[]
  ): Promise<any> {
    if (!this.dbService) {
      // If no database service, return base schema unchanged
      return baseSchema;
    }

    const enhancedSchema = {
      ...baseSchema,
      properties: { ...baseSchema.properties },
      required: [...(baseSchema.required || [])]
    };

    // Find all create_object steps
    const createObjectSteps = steps.filter(step => step.type === 'create_object');

    for (const step of createObjectSteps) {
      if (!step.templateId || !step.properties) {
        continue;
      }

      try {
        // Load all properties for the template
        const allProperties = await this.dbService.listProperties(step.templateId);

        // Filter to only properties with step_type='property'
        const templateProperties = allProperties.filter((p: any) => p.step_type === 'property');

        // Filter to only the selected properties that are NOT mapped to workflow parameters
        // (Only add properties that need agent input - mapped ones are handled by workflow inputs)
        const selectedProps = templateProperties.filter((p: any) => {
          const mapping = step.properties![p.key];
          // Include if: exists AND (is true OR doesn't contain workflow parameter references)
          // Check for both old {{input.}} and new {{steps.input.}} syntax
          return mapping !== undefined &&
                 (mapping === true || (typeof mapping === 'string' &&
                   !mapping.includes('{{input.') &&
                   !mapping.includes('{{steps.input.')));
        });

        // Add each selected property to the workflow's input schema
        for (const prop of selectedProps) {
          // Only add if not already present and not mapped to workflow parameter
          if (!enhancedSchema.properties[prop.key]) {
            enhancedSchema.properties[prop.key] = {
              type: prop.type === 'text' ? 'string' : prop.type,
              description: prop.description || `Value for ${prop.key}`
            };

            // Mark Title and Description as required for task/project creation
            if ((prop.key === 'Title' || prop.key === 'Description') &&
                !enhancedSchema.required.includes(prop.key)) {
              enhancedSchema.required.push(prop.key);
            }
          }
        }
      } catch (error) {
        console.error(`Error loading properties for template ${step.templateId}:`, error);
        // Continue with other steps even if one fails
      }
    }

    return enhancedSchema;
  }

  /**
   * Build JSON Schema input schema from properties table (NEW APPROACH)
   * Reads parameters stored as rows in properties table with step_type='property'
   */
  private buildInputSchemaFromPropertiesTable(parameterProperties: any[]): any {
    const properties: any = {};
    const required: string[] = [];

    for (const param of parameterProperties) {
      if (!param.key || !param.type) {
        console.warn(`[Workflow Loader] Skipping invalid parameter property:`, param);
        continue; // Skip invalid parameters
      }

      // Map database types to JSON Schema types
      let schemaType = param.type;
      if (param.type === 'text') {
        schemaType = 'string';
      } else if (param.type === 'list') {
        schemaType = 'array';
      }

      properties[param.key] = {
        type: schemaType,
        description: param.description || ''
      };

      // Check if required from step_config
      const stepConfig = param.step_config || {};
      if (stepConfig.required === true) {
        required.push(param.key);
      }

      // Add default value if provided
      if (stepConfig.default !== undefined && stepConfig.default !== '') {
        properties[param.key].default = stepConfig.default;
      }
    }

    return {
      type: 'object',
      properties,
      required
    };
  }

  /**
   * Execute a workflow with given inputs
   */
  async execute(workflow: WorkflowDefinition, inputs: Record<string, any>): Promise<ExecutionContext> {
    const context: ExecutionContext = {
      variables: new Map(),
      inputs,
      logs: [],
      stepResults: [],
      currentStep: 0,
    };

    // Validate inputs against schema
    this.validateInputs(workflow.inputSchema, inputs);

    // Validate step references in workflow
    this.validateStepReferences(workflow);

    // Store workflow inputs as the first "step" result for unified parameter access
    // This allows {{steps.input.paramName}} to work alongside {{input.paramName}}
    context.stepResults.push({
      step: 'input',
      type: 'workflow_input',
      status: 'completed',
      output: inputs
    });

    // Execute steps sequentially
    for (let i = 0; i < workflow.steps.length; i++) {
      context.currentStep = i;
      const step = workflow.steps[i];

      try {
        await this.executeStep(step, context);
        step.status = 'completed';

        // If a return was executed, stop processing
        if (context.result !== undefined) {
          break;
        }
      } catch (error) {
        step.status = 'failed';
        throw error;
      }
    }

    return context;
  }

  /**
   * Execute workflow from a specific step (for resuming)
   */
  async executeFromStep(
    workflow: WorkflowDefinition,
    inputs: Record<string, any>,
    startStep: number,
    savedVariables?: Array<[string, any]>,
    savedStepResults?: StepResult[]
  ): Promise<ExecutionContext> {
    const context: ExecutionContext = {
      variables: new Map(savedVariables || []),
      inputs,
      logs: [],
      stepResults: savedStepResults || [],
      currentStep: startStep,
    };

    // Validate inputs against schema
    this.validateInputs(workflow.inputSchema, inputs);

    // If no saved step results, store workflow inputs as the first "step" result
    if (!savedStepResults || savedStepResults.length === 0) {
      context.stepResults.push({
        step: 'input',
        type: 'workflow_input',
        status: 'completed',
        output: inputs
      });
    }

    console.log(`[Workflow] Resuming from step ${startStep} (${workflow.steps[startStep]?.name})`);
    console.log(`[Workflow] Restored ${context.variables.size} variable(s) and ${context.stepResults.length} step result(s)`);

    // Execute steps sequentially starting from startStep
    for (let i = startStep; i < workflow.steps.length; i++) {
      context.currentStep = i;
      const step = workflow.steps[i];

      try {
        await this.executeStep(step, context);
        step.status = 'completed';

        // If a return was executed or agent step, stop processing
        if (context.result !== undefined) {
          break;
        }
      } catch (error) {
        step.status = 'failed';
        throw error;
      }
    }

    return context;
  }

  /**
   * Load workflow state from database
   */
  async loadState(stateKey: string): Promise<any> {
    if (!this.dbService) {
      console.log(`[Workflow] No database service available for loading state`);
      return null;
    }

    try {
      const state = await this.dbService.getGlobalState(stateKey);
      console.log(`[Workflow] Loaded state for key ${stateKey}:`, JSON.stringify(state, null, 2));
      return state;
    } catch (error) {
      console.error(`[Workflow] Error loading state for key ${stateKey}:`, error);
      return null;
    }
  }

  /**
   * Save workflow state to database
   */
  async saveState(stateKey: string, value: any): Promise<void> {
    if (!this.dbService) {
      throw new Error('Database service not available');
    }

    try {
      await this.dbService.setGlobalState(stateKey, value, 'workflow');
      console.log(`[Workflow] Saved state: ${stateKey}`);
    } catch (error) {
      console.error(`Error saving state for key ${stateKey}:`, error);
      throw error;
    }
  }

  /**
   * Clear workflow state from database
   */
  async clearState(stateKey: string): Promise<void> {
    if (!this.dbService) {
      return;
    }

    try {
      await this.dbService.deleteGlobalState(stateKey);
      console.log(`[Workflow] Cleared state: ${stateKey}`);
    } catch (error) {
      console.error(`Error clearing state for key ${stateKey}:`, error);
    }
  }

  /**
   * Execute a single workflow step
   */
  private async executeStep(step: WorkflowStep, context: ExecutionContext): Promise<void> {
    switch (step.type) {
      case 'agent':
        await this.executeAgent(step, context);
        break;

      case 'create_object':
        await this.executeCreateObject(step, context);
        break;

      case 'load_object':
        await this.executeLoadObject(step, context);
        break;

      case 'call_function':
        await this.executeCallFunction(step, context);
        break;

      default:
        throw new Error(`Unknown step type: ${(step as any).type}`);
    }
  }

  /**
   * Execute create_object step - RETURNS schema to agent for execution
   * The workflow cannot execute create_object directly because it needs the agent to populate values
   * Instead, we return the schema and let the agent call create_object with the generated values
   */
  private async executeCreateObject(step: WorkflowStep, context: ExecutionContext): Promise<void> {
    if (!step.templateId) {
      throw new Error('create_object step requires a templateId');
    }

    if (!this.dbService) {
      throw new Error('DatabaseService is required to load property schemas for create_object steps.');
    }

    console.log(`[Workflow ${step.name}] Loading property schema for template_id: ${step.templateId}`);

    // Load all properties for the template
    const allProperties = await this.dbService.listProperties(step.templateId);

    // Filter to only properties with step_type='property' (not workflow steps)
    const templateProperties = allProperties.filter((p: any) => p.step_type === 'property');

    // Filter to only the selected properties (where step.properties[key] exists - can be true or a string reference)
    const selectedPropKeys = step.properties ? Object.keys(step.properties) : [];
    const selectedProps = templateProperties.filter((p: any) => selectedPropKeys.includes(p.key));

    if (selectedProps.length === 0) {
      throw new Error('create_object step requires at least one selected property');
    }

    console.log(`[Workflow ${step.name}] Selected properties:`, selectedProps.map((p: any) => p.key).join(', '));
    console.log(`[Workflow ${step.name}] === STEP PROPERTIES DEBUG ===`);
    console.log(`[Workflow ${step.name}] step.properties object:`, step.properties);
    console.log(`[Workflow ${step.name}] ============================`);

    // Build a dynamic schema with only selected properties and their descriptions
    // Properties can be mapped to workflow parameters using {{input.paramName}} syntax
    const propertySchemas: Record<string, any> = {};
    const propertyMappings: Record<string, string> = {};

    for (const prop of selectedProps) {
      const mappingValue = step.properties![prop.key];
      console.log(`[Workflow ${step.name}] Processing property "${prop.key}":`, mappingValue);

      // Check if this property is mapped to a parameter (workflow input or previous step)
      // Supports: {{input.x}}, {{steps.input.x}}, {{steps.stepName.x}}, {{variable}}
      if (typeof mappingValue === 'string' && (
        mappingValue.includes('{{input.') ||
        mappingValue.includes('{{steps.') ||
        mappingValue.match(/\{\{[^}]+\}\}/)
      )) {
        // Store the mapping for later interpolation
        propertyMappings[prop.key] = mappingValue;
        // Don't add to schema - will be filled from parameters
        console.log(`[Workflow ${step.name}] Property ${prop.key} mapped to: ${mappingValue}`);
      } else if (typeof mappingValue === 'string' && mappingValue.trim() !== '') {
        // Static value - add to mappings directly
        propertyMappings[prop.key] = mappingValue;
        console.log(`[Workflow ${step.name}] Property ${prop.key} has static value: ${mappingValue}`);
      } else {
        // Add to schema for agent to fill
        propertySchemas[prop.key] = {
          type: prop.type === 'text' ? 'string' : prop.type,
          description: prop.description || `Value for ${prop.key}`
        };
      }
    }

    // Get template name for display
    const templates = await this.dbService.getTemplates();
    const template = templates.find(t => t.id === step.templateId);
    const templateName = template ? template.name : `template ${step.templateId}`;

    // Interpolate property mappings with context values
    console.log(`[Workflow ${step.name}] === INTERPOLATION DEBUG START ===`);
    console.log(`[Workflow ${step.name}] Property mappings to interpolate:`, propertyMappings);
    console.log(`[Workflow ${step.name}] Current context inputs:`, context.inputs);
    console.log(`[Workflow ${step.name}] Current context step results:`, context.stepResults);

    const interpolatedMappings: Record<string, any> = {};
    for (const [key, mappingExpr] of Object.entries(propertyMappings)) {
      const interpolatedValue = this.interpolateValue(mappingExpr, context);
      interpolatedMappings[key] = interpolatedValue;
      console.log(`[Workflow ${step.name}] Interpolated ${key}:`);
      console.log(`  - Expression: ${mappingExpr}`);
      console.log(`  - Result: ${interpolatedValue}`);
      console.log(`  - Type: ${typeof interpolatedValue}`);
    }
    console.log(`[Workflow ${step.name}] === INTERPOLATION DEBUG END ===`);

    // Check if all properties are provided (no schemas needing agent input)
    if (Object.keys(propertySchemas).length === 0 && Object.keys(interpolatedMappings).length > 0) {
      // All values are provided - auto-execute create_object
      console.log(`[Workflow ${step.name}] All property values provided, auto-executing create_object`);

      if (!this.toolCaller) {
        throw new Error('ToolCaller is required to auto-execute create_object. Provide toolCaller in constructor.');
      }

      try {
        // Build parameters object
        const toolParams: Record<string, any> = {
          template_id: step.templateId,
          properties: interpolatedMappings
        };

        // Add stage if specified (with interpolation support)
        if (step.stage !== undefined) {
          toolParams.stage = this.interpolateValue(step.stage, context);
        }

        // Add related if specified (with interpolation support for array expansion)
        if (step.related !== undefined) {
          const relatedEntries: RelatedEntry[] = [];
          for (const entry of step.related) {
            const interpolatedId = typeof entry.id === 'string' ? this.interpolateValue(entry.id, context) : entry.id;
            const interpolatedObject = typeof entry.object === 'string' ? this.interpolateValue(entry.object, context) : entry.object;

            // If interpolated ID is an array, expand into multiple related entries
            if (Array.isArray(interpolatedId)) {
              console.log(`[Workflow ${step.name}] Expanding array parameter with ${interpolatedId.length} value(s) for '${interpolatedObject}' relationship`);
              for (const id of interpolatedId) {
                // Skip undefined, null, or empty values
                if (id !== undefined && id !== null && id !== '') {
                  relatedEntries.push({ id, object: interpolatedObject });
                }
              }
            } else if (interpolatedId !== undefined && interpolatedId !== null && interpolatedId !== '') {
              // Single value - add as-is
              relatedEntries.push({ id: interpolatedId, object: interpolatedObject });
            }
            // Skip entries with undefined/null/empty IDs
          }
          toolParams.related = relatedEntries;
        }

        const result = await this.toolCaller.callTool('create_object', toolParams);

        console.log(`[Workflow ${step.name}] Auto-executed create_object, result:`, result);

        // Store result in step results
        context.stepResults.push({
          step: step.name,
          type: 'create_object',
          status: 'completed',
          output: result
        });

        // Store in variable if specified
        if (step.resultVariable) {
          context.variables.set(step.resultVariable, result);
          console.log(`[Workflow ${step.name}] Stored result in variable: ${step.resultVariable}`);
        }

        // Continue to next step (don't set context.result)
        return;
      } catch (error) {
        console.error(`[Workflow ${step.name}] Auto-execute create_object failed:`, error);
        throw new Error(`Auto-execute create_object failed: ${(error as Error).message}`);
      }
    }

    // Some properties need agent input - RETURN schema to agent
    const returnValue = {
      action: 'create_object',
      template_id: step.templateId,
      template_name: templateName,
      property_schemas: propertySchemas,
      property_values: interpolatedMappings, // Pre-filled values from workflow parameters
      instruction: Object.keys(propertySchemas).length > 0
        ? `Please call the create_object tool with template_id=${step.templateId} and populate the following properties based on their descriptions: ${Object.keys(propertySchemas).join(', ')}. These values are already provided from workflow inputs: ${Object.keys(interpolatedMappings).join(', ')}`
        : `Please call the create_object tool with template_id=${step.templateId}. All property values are provided from workflow inputs: ${Object.keys(interpolatedMappings).join(', ')}`,
      next_step: step.resultVariable ? `Store the result in variable: ${step.resultVariable}` : undefined
    };

    console.log(`[Workflow ${step.name}] Returning schema to agent:`, JSON.stringify(returnValue, null, 2));

    // Set this as the workflow result to stop execution and return to agent
    context.result = returnValue;
  }

  /**
   * Execute load_object step - loads property descriptions as instructions for the agent
   * Works identically to executeAgent, but sources instructions from database property descriptions
   * instead of manually configured instruction array
   */
  private async executeLoadObject(step: WorkflowStep, context: ExecutionContext): Promise<void> {
    if (!step.templateId) {
      throw new Error('load_object step requires a templateId');
    }

    if (!this.dbService) {
      throw new Error('DatabaseService is required to load property descriptions for load_object steps.');
    }

    console.log(`[Workflow ${step.name}] Loading property descriptions for template_id: ${step.templateId}`);

    // Load all properties for the template
    const allProperties = await this.dbService.listProperties(step.templateId);

    // Filter to only properties with step_type='property' (not workflow steps)
    const templateProperties = allProperties.filter((p: any) => p.step_type === 'property');

    // Filter to only the selected properties (where step.properties[key] exists)
    const selectedPropKeys = step.properties ? Object.keys(step.properties) : [];
    const selectedProps = templateProperties.filter((p: any) => selectedPropKeys.includes(p.key));

    if (selectedProps.length === 0) {
      throw new Error('load_object step requires at least one selected property');
    }

    console.log(`[Workflow ${step.name}] Selected properties:`, selectedProps.map((p: any) => p.key).join(', '));

    // Build instructions array from property descriptions
    const instructions = selectedProps.map((prop: any) => {
      return prop.description || `Process ${prop.key}`;
    });

    if (instructions.length === 0) {
      throw new Error('load_object step requires at least one instruction');
    }

    // Interpolate all instructions with current context
    const interpolatedInstructions = instructions.map(instruction =>
      this.interpolateString(instruction, context)
    );

    console.log(`[Workflow ${step.name}] Agent step - executing with MCP sampling`);
    console.log(`[Workflow ${step.name}] Instructions (${instructions.length}):`, interpolatedInstructions);

    // Use MCP sampling to get LLM response if server is available
    let samplingResult: string | null = null;
    if (this.server) {
      try {
        console.log(`[Workflow ${step.name}] Requesting sampling from MCP client`);

        // Format instructions as a single prompt
        const prompt = interpolatedInstructions.join('\n\n');

        // Request sampling from MCP client
        const response = await this.server.request({
          method: 'sampling/createMessage',
          params: {
            messages: [
              {
                role: 'user',
                content: {
                  type: 'text',
                  text: prompt
                }
              }
            ],
            maxTokens: 1000
          }
        }, null);

        // Extract text from response
        if (response && response.content && response.content.type === 'text') {
          samplingResult = response.content.text;
          console.log(`[Workflow ${step.name}] Sampling response received (${samplingResult?.length || 0} chars)`);
        }
      } catch (error) {
        console.warn(`[Workflow ${step.name}] Sampling failed, continuing without result:`, error);
      }
    }

    // Record step result
    // Note: Sampling may not work with SSE transport (MCP issue #907)
    // Mark as completed even without sampling result to allow workflow to continue
    const stepResult: StepResult = {
      step: step.name,
      type: 'load_object',
      status: 'completed',
      output: samplingResult || 'Sampling not available with SSE transport (agent will execute instructions manually)'
    };
    context.stepResults.push(stepResult);

    // Return instructions to the agent with result (identical structure to agent node)
    const returnValue = {
      action: 'agent_instructions',
      step_name: step.name,
      current_step: context.currentStep,
      total_steps: context.inputs.__workflow_total_steps || 'unknown',
      instructions: interpolatedInstructions,
      result: samplingResult,
      next_action: 'After executing these instructions, call the workflow tool again with the same inputs to continue to the next step.'
    };

    console.log(`[Workflow ${step.name}] Returning ${instructions.length} instruction(s) with ${samplingResult ? 'sampling result' : 'no result'}`);

    // Set this as the workflow result to pause execution
    context.result = returnValue;
  }

  /**
   * Execute call_function step - calls an internal workflow function
   * This step type executes automatically and continues to the next step (does not pause)
   */
  private async executeCallFunction(step: WorkflowStep, context: ExecutionContext): Promise<void> {
    if (!step.functionName) {
      throw new Error('call_function step requires a functionName');
    }

    console.log(`[Workflow ${step.name}] Calling function: ${step.functionName}`);

    // Check if function exists in registry
    if (!functionRegistry.has(step.functionName)) {
      throw new Error(`Function '${step.functionName}' not found in function registry`);
    }

    // Interpolate parameters with context values
    const interpolatedParams = this.interpolateValue(step.parameters || {}, context);
    console.log(`[Workflow ${step.name}] Function parameters:`, interpolatedParams);

    try {
      // Call the function
      const result = await functionRegistry.call(step.functionName, interpolatedParams);
      console.log(`[Workflow ${step.name}] Function result:`, result);

      // Check if function execution was successful
      if (!result.success) {
        throw new Error(`Function execution failed: ${result.error || 'Unknown error'}`);
      }

      // Store result in step results
      context.stepResults.push({
        step: step.name,
        type: 'call_function',
        status: 'completed',
        output: result.data
      });

      // Store in variable if specified
      if (step.resultVariable) {
        context.variables.set(step.resultVariable, result.data);
        console.log(`[Workflow ${step.name}] Stored result in variable: ${step.resultVariable}`);
      }

      // Continue to next step (don't set context.result - that would pause the workflow)
      return;
    } catch (error) {
      console.error(`[Workflow ${step.name}] Function execution error:`, error);
      throw new Error(`Function '${step.functionName}' execution failed: ${(error as Error).message}`);
    }
  }

  /**
   * Interpolate string with variables and inputs
   * Supports {{variableName}} and {{input.fieldName}} syntax
   */
  private interpolateString(template: string, context: ExecutionContext): string {
    return template.replace(/\{\{([^}]+)\}\}/g, (match, path) => {
      const value = this.resolveValue(path.trim(), context);
      // Keep placeholder if value is null or undefined
      if (value === null || value === undefined) {
        return match;
      }
      return String(value);
    });
  }

  /**
   * Interpolate any value (string, object, array)
   */
  private interpolateValue(value: any, context: ExecutionContext): any {
    if (typeof value === 'string') {
      // Check if entire string is a single interpolation
      const singleMatch = value.match(/^\{\{([^}]+)\}\}$/);
      if (singleMatch) {
        return this.resolveValue(singleMatch[1].trim(), context);
      }
      return this.interpolateString(value, context);
    }
    
    if (Array.isArray(value)) {
      return value.map(item => this.interpolateValue(item, context));
    }
    
    if (typeof value === 'object' && value !== null) {
      const result: Record<string, any> = {};
      for (const [key, val] of Object.entries(value)) {
        result[key] = this.interpolateValue(val, context);
      }
      return result;
    }
    
    return value;
  }

  /**
   * Resolve a value path with support for:
   * - {{steps.stepName.variable}} - Access previous step output
   * - {{steps.input.paramName}} - Access workflow input (explicit)
   * - {{input.paramName}} - Access workflow input (backward compatible)
   * - {{variableName}} - Access context variable
   */
  private resolveValue(path: string, context: ExecutionContext): any {
    // Check if it's a step reference: steps.stepName.variable
    if (path.startsWith('steps.')) {
      const pathParts = path.substring(6).split('.');
      if (pathParts.length < 2) {
        console.warn(`[Workflow] Invalid step reference: ${path}. Expected format: steps.stepName.variable`);
        return undefined;
      }

      const stepName = pathParts[0];
      const variablePath = pathParts.slice(1);

      // Find the step result
      const stepResult = context.stepResults.find(sr => sr.step === stepName);
      if (!stepResult) {
        console.warn(`[Workflow] Step "${stepName}" not found in step results`);
        return undefined;
      }

      // Navigate to the variable within the step output
      let value = stepResult.output;
      for (const part of variablePath) {
        if (value === undefined || value === null) {
          return undefined;
        }
        if (typeof value === 'object') {
          value = value[part];
        } else {
          return undefined;
        }
      }

      return value;
    }

    // Check if it's an input reference (backward compatibility)
    if (path.startsWith('input.')) {
      const fieldName = path.substring(6);
      return context.inputs[fieldName];
    }

    // Check if it's just "input" (all inputs)
    if (path === 'input') {
      return context.inputs;
    }

    // Check for "logs" special variable
    if (path === 'logs') {
      return context.logs;
    }

    // Check if path contains dots (nested property access for variables)
    if (path.includes('.')) {
      const parts = path.split('.');
      const variableName = parts[0];
      let value = context.variables.get(variableName);

      // Navigate nested properties
      for (let i = 1; i < parts.length && value !== undefined; i++) {
        if (typeof value === 'object' && value !== null) {
          value = value[parts[i]];
        } else {
          return undefined;
        }
      }

      return value;
    }

    // Otherwise, it's a simple variable
    return context.variables.get(path);
  }

  /**
   * Evaluate a simple condition
   * Supports: equals, not_equals, exists, not_exists
   */
  private evaluateCondition(condition: string, context: ExecutionContext): boolean {
    // Simple condition format: "{{variable}} operator value"
    // For POC, support basic equality checks
    
    // Extract variable reference
    const varMatch = condition.match(/\{\{([^}]+)\}\}/);
    if (!varMatch) {
      // No variable reference, try to evaluate as boolean
      return Boolean(condition);
    }
    
    const varPath = varMatch[1].trim();
    const varValue = this.resolveValue(varPath, context);
    
    // Check for operators
    if (condition.includes('==')) {
      const parts = condition.split('==').map(p => p.trim());
      const rightValue = this.parseValue(parts[1]);
      return varValue == rightValue;
    }
    
    if (condition.includes('!=')) {
      const parts = condition.split('!=').map(p => p.trim());
      const rightValue = this.parseValue(parts[1]);
      return varValue != rightValue;
    }
    
    // Default: check if variable exists and is truthy
    return Boolean(varValue);
  }

  /**
   * Parse a string value to appropriate type
   */
  private parseValue(str: string): any {
    str = str.trim();
    
    // Remove quotes if present
    if ((str.startsWith('"') && str.endsWith('"')) || 
        (str.startsWith("'") && str.endsWith("'"))) {
      return str.slice(1, -1);
    }
    
    // Try to parse as number
    const num = Number(str);
    if (!isNaN(num)) {
      return num;
    }
    
    // Try to parse as boolean
    if (str === 'true') return true;
    if (str === 'false') return false;
    if (str === 'null') return null;
    
    return str;
  }

  /**
   * Normalize and validate inputs against JSON Schema
   * Auto-coerces single values to arrays when schema expects array type
   */
  private validateInputs(schema: any, inputs: Record<string, any>): void {
    if (!schema || !schema.properties) {
      return; // No validation needed
    }

    // Check required fields
    const required = schema.required || [];
    for (const field of required) {
      if (!(field in inputs)) {
        throw new Error(`Missing required input field: ${field}`);
      }
    }

    // Normalize and validate types
    for (const [field, value] of Object.entries(inputs)) {
      const fieldSchema = schema.properties[field];
      if (!fieldSchema) continue;

      const expectedType = fieldSchema.type;
      const actualType = Array.isArray(value) ? 'array' : typeof value;

      // Auto-coerce single values to arrays when schema expects array
      if (expectedType === 'array' && !Array.isArray(value)) {
        console.log(`[Workflow] Auto-coercing input '${field}' from single value to array`);
        inputs[field] = [value];
        continue;
      }

      if (expectedType === 'string' && actualType !== 'string') {
        throw new Error(`Input field '${field}' must be a string`);
      }
      if (expectedType === 'number' && actualType !== 'number') {
        throw new Error(`Input field '${field}' must be a number`);
      }
      if (expectedType === 'boolean' && actualType !== 'boolean') {
        throw new Error(`Input field '${field}' must be a boolean`);
      }
      if (expectedType === 'object' && (actualType !== 'object' || Array.isArray(value))) {
        throw new Error(`Input field '${field}' must be an object`);
      }
    }
  }

  /**
   * Validate that step references in workflow are valid
   * Checks that referenced steps exist and are defined before they are referenced
   */
  private validateStepReferences(workflow: WorkflowDefinition): void {
    const stepNames = new Set<string>(['input']); // 'input' is always available

    for (let i = 0; i < workflow.steps.length; i++) {
      const step = workflow.steps[i];

      // Extract step references from step configuration
      const stepRefs = this.extractStepReferences(step);

      // Validate each reference
      for (const ref of stepRefs) {
        if (!stepNames.has(ref)) {
          throw new Error(
            `Step "${step.name}" references step "${ref}" which is not defined or not yet executed. ` +
            `Available steps: ${Array.from(stepNames).join(', ')}`
          );
        }
      }

      // Add current step to available steps for subsequent steps
      stepNames.add(step.name);
    }
  }

  /**
   * Extract step references from a workflow step configuration
   * Looks for {{steps.stepName.*}} patterns in step values
   */
  private extractStepReferences(step: WorkflowStep): Set<string> {
    const refs = new Set<string>();
    const stepRefPattern = /\{\{steps\.([^.}]+)\./g;

    // Helper to find references in any value
    const findRefsInValue = (value: any): void => {
      if (typeof value === 'string') {
        let match;
        while ((match = stepRefPattern.exec(value)) !== null) {
          refs.add(match[1]);
        }
      } else if (Array.isArray(value)) {
        value.forEach(findRefsInValue);
      } else if (typeof value === 'object' && value !== null) {
        Object.values(value).forEach(findRefsInValue);
      }
    };

    // Search all step properties for references
    findRefsInValue(step.properties);
    findRefsInValue(step.instructions);

    return refs;
  }

  /**
   * Execute agent step - uses MCP sampling to get LLM response and captures result
   * The agent should execute the instructions and then call the workflow again to continue
   */
  private async executeAgent(step: WorkflowStep, context: ExecutionContext): Promise<void> {
    const instructions = step.instructions || [];

    if (instructions.length === 0) {
      throw new Error('agent step requires at least one instruction');
    }

    // Interpolate all instructions with current context
    const interpolatedInstructions = instructions.map(instruction =>
      this.interpolateString(instruction, context)
    );

    console.log(`[Workflow ${step.name}] Agent step - executing with MCP sampling`);
    console.log(`[Workflow ${step.name}] Instructions (${instructions.length}):`, interpolatedInstructions);

    // Use MCP sampling to get LLM response if server is available
    let samplingResult: string | null = null;
    if (this.server) {
      try {
        console.log(`[Workflow ${step.name}] Requesting sampling from MCP client`);

        // Format instructions as a single prompt
        const prompt = interpolatedInstructions.join('\n\n');

        // Request sampling from MCP client
        const response = await this.server.request({
          method: 'sampling/createMessage',
          params: {
            messages: [
              {
                role: 'user',
                content: {
                  type: 'text',
                  text: prompt
                }
              }
            ],
            maxTokens: 1000
          }
        }, null);

        // Extract text from response
        if (response && response.content && response.content.type === 'text') {
          samplingResult = response.content.text;
          console.log(`[Workflow ${step.name}] Sampling response received (${samplingResult?.length || 0} chars)`);
        }
      } catch (error) {
        console.warn(`[Workflow ${step.name}] Sampling failed, continuing without result:`, error);
      }
    }

    // Record step result
    // Note: Sampling may not work with SSE transport (MCP issue #907)
    // Mark as completed even without sampling result to allow workflow to continue
    const stepResult: StepResult = {
      step: step.name,
      type: 'agent',
      status: 'completed',
      output: samplingResult || 'Sampling not available with SSE transport (agent will execute instructions manually)'
    };
    context.stepResults.push(stepResult);

    // Return instructions to the agent with result
    const returnValue = {
      action: 'agent_instructions',
      step_name: step.name,
      current_step: context.currentStep,
      total_steps: context.inputs.__workflow_total_steps || 'unknown',
      instructions: interpolatedInstructions,
      result: samplingResult,
      next_action: 'After executing these instructions, call the workflow tool again with the same inputs to continue to the next step.'
    };

    console.log(`[Workflow ${step.name}] Returning ${instructions.length} instruction(s) with ${samplingResult ? 'sampling result' : 'no result'}`);

    // Set this as the workflow result to pause execution
    context.result = returnValue;
  }
}

/**
 * Workflow Executor - Interprets and executes workflow step definitions
 * Supports: log, set_variable, conditional, call_tool, and return step types
 */

import DatabaseService from '../database.js';

export interface WorkflowStep {
  name: string;
  type: 'log' | 'set_variable' | 'conditional' | 'call_tool' | 'return';
  message?: string;
  variableName?: string;
  value?: any;
  condition?: string;
  then?: WorkflowStep[];
  else?: WorkflowStep[];
  toolName?: string;
  parameters?: Record<string, any>;
  resultVariable?: string;
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

  constructor(dbService?: DatabaseService, toolCaller?: ToolCaller) {
    this.dbService = dbService;
    this.toolCaller = toolCaller;
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

      // Find start node (step_type='start')
      const startNode = properties.find((prop: any) => prop.step_type === 'start');

      let workflowName: string;
      let workflowDescription: string;
      let inputSchema: any;

      if (startNode) {
        // NEW APPROACH: Extract tool definition from start node
        console.log(`[Workflow Loader] Found start node for workflow ${templateId}`);
        const startConfig = startNode.step_config || {};

        workflowName = startConfig.tool_name || template.name.toLowerCase().replace(/\s+/g, '_');
        workflowDescription = startConfig.tool_description || startConfig.display_description || template.description;
        inputSchema = this.buildInputSchemaFromParameters(startConfig.input_parameters || []);

        console.log(`[Workflow Loader] Tool name from start node: ${workflowName}`);
      } else {
        // LEGACY FALLBACK: Use metadata (for backward compatibility)
        console.warn(`[Workflow Loader] No start node found for workflow ${templateId}, using legacy metadata`);
        const metadata = templateData.metadata || {};
        workflowName = metadata.mcp_tool_name || template.name;
        workflowDescription = template.description;
        inputSchema = metadata.input_schema || {};
      }

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
          case 'log':
            step.message = config.message;
            break;

          case 'set_variable':
            step.variableName = config.variableName;
            step.value = config.value;
            break;

          case 'call_tool':
            step.toolName = config.tool_name;
            step.parameters = config.parameters;
            step.resultVariable = config.result_variable;
            break;

          case 'conditional':
            step.condition = config.condition;
            step.then = config.then || [];
            step.else = config.else || [];
            break;

          case 'return':
            step.value = config.value;
            break;
        }

        return step;
      });

      const workflow: WorkflowDefinition = {
        name: workflowName,
        description: workflowDescription,
        inputSchema,
        steps,
      };

      return workflow;
    } catch (error) {
      console.error('Error loading workflow from database:', error);
      throw error;
    }
  }

  /**
   * Build JSON Schema input schema from start node parameters array
   */
  private buildInputSchemaFromParameters(parameters: any[]): any {
    const properties: any = {};
    const required: string[] = [];

    for (const param of parameters) {
      if (!param.name || !param.type) {
        continue; // Skip invalid parameters
      }

      properties[param.name] = {
        type: param.type,
        description: param.description || ''
      };

      if (param.required === true) {
        required.push(param.name);
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
   * Execute a single workflow step
   */
  private async executeStep(step: WorkflowStep, context: ExecutionContext): Promise<void> {
    switch (step.type) {
      case 'log':
        this.executeLog(step, context);
        break;

      case 'set_variable':
        this.executeSetVariable(step, context);
        break;

      case 'conditional':
        await this.executeConditional(step, context);
        break;

      case 'call_tool':
        await this.executeCallTool(step, context);
        break;

      case 'return':
        this.executeReturn(step, context);
        break;

      default:
        throw new Error(`Unknown step type: ${(step as any).type}`);
    }
  }

  /**
   * Execute log step - outputs message to logs
   */
  private executeLog(step: WorkflowStep, context: ExecutionContext): void {
    if (!step.message) {
      throw new Error('Log step requires a message');
    }
    
    const message = this.interpolateString(step.message, context);
    context.logs.push(message);
    console.log(`[Workflow ${step.name || 'Log'}] ${message}`);
  }

  /**
   * Execute set_variable step - stores value in context
   */
  private executeSetVariable(step: WorkflowStep, context: ExecutionContext): void {
    if (!step.variableName) {
      throw new Error('set_variable step requires a variableName');
    }
    
    if (step.value === undefined) {
      throw new Error('set_variable step requires a value');
    }
    
    const value = this.interpolateValue(step.value, context);
    context.variables.set(step.variableName, value);
  }

  /**
   * Execute conditional step - evaluates condition and executes then/else branches
   */
  private async executeConditional(step: WorkflowStep, context: ExecutionContext): Promise<void> {
    if (!step.condition) {
      throw new Error('conditional step requires a condition');
    }
    
    const conditionResult = this.evaluateCondition(step.condition, context);
    
    if (conditionResult && step.then) {
      for (const thenStep of step.then) {
        await this.executeStep(thenStep, context);
        if (context.result !== undefined) break;
      }
    } else if (!conditionResult && step.else) {
      for (const elseStep of step.else) {
        await this.executeStep(elseStep, context);
        if (context.result !== undefined) break;
      }
    }
  }

  /**
   * Execute return step - sets result and stops execution
   */
  private executeReturn(step: WorkflowStep, context: ExecutionContext): void {
    if (step.value === undefined) {
      throw new Error('return step requires a value');
    }

    context.result = this.interpolateValue(step.value, context);
  }

  /**
   * Execute call_tool step - invokes MCP tool with interpolated parameters
   */
  private async executeCallTool(step: WorkflowStep, context: ExecutionContext): Promise<void> {
    if (!this.toolCaller) {
      throw new Error('ToolCaller is required to execute call_tool steps. Provide toolCaller in constructor.');
    }

    if (!step.toolName) {
      throw new Error('call_tool step requires a toolName');
    }

    if (!step.parameters) {
      throw new Error('call_tool step requires parameters');
    }

    // Interpolate parameters with context values
    const interpolatedParams = this.interpolateValue(step.parameters, context);

    console.log(`[Workflow ${step.name}] Calling tool: ${step.toolName}`);
    console.log(`[Workflow ${step.name}] Parameters:`, JSON.stringify(interpolatedParams, null, 2));

    try {
      // Call the tool via the tool caller interface
      const result = await this.toolCaller.callTool(step.toolName, interpolatedParams);

      console.log(`[Workflow ${step.name}] Tool result:`, JSON.stringify(result, null, 2));

      // Store result in context variable if specified
      if (step.resultVariable) {
        context.variables.set(step.resultVariable, result);
        console.log(`[Workflow ${step.name}] Stored result in variable: ${step.resultVariable}`);
      }
    } catch (error) {
      console.error(`[Workflow ${step.name}] Tool execution failed:`, error);
      throw new Error(`Tool '${step.toolName}' execution failed: ${(error as Error).message}`);
    }
  }

  /**
   * Interpolate string with variables and inputs
   * Supports {{variableName}} and {{input.fieldName}} syntax
   */
  private interpolateString(template: string, context: ExecutionContext): string {
    return template.replace(/\{\{([^}]+)\}\}/g, (match, path) => {
      const value = this.resolveValue(path.trim(), context);
      return value !== undefined ? String(value) : match;
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
   * Resolve a value path (e.g., "variableName" or "input.fieldName" or "created_object.object_id")
   */
  private resolveValue(path: string, context: ExecutionContext): any {
    // Check if it's an input reference
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

    // Check if path contains dots (nested property access)
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
   * Validate inputs against JSON Schema
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

    // Basic type validation
    for (const [field, value] of Object.entries(inputs)) {
      const fieldSchema = schema.properties[field];
      if (!fieldSchema) continue;

      const expectedType = fieldSchema.type;
      const actualType = Array.isArray(value) ? 'array' : typeof value;

      if (expectedType === 'string' && actualType !== 'string') {
        throw new Error(`Input field '${field}' must be a string`);
      }
      if (expectedType === 'number' && actualType !== 'number') {
        throw new Error(`Input field '${field}' must be a number`);
      }
      if (expectedType === 'boolean' && actualType !== 'boolean') {
        throw new Error(`Input field '${field}' must be a boolean`);
      }
      if (expectedType === 'array' && !Array.isArray(value)) {
        throw new Error(`Input field '${field}' must be an array`);
      }
      if (expectedType === 'object' && (actualType !== 'object' || Array.isArray(value))) {
        throw new Error(`Input field '${field}' must be an object`);
      }
    }
  }
}

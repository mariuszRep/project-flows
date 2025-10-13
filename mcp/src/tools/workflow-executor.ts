/**
 * Workflow Executor - Interprets and executes workflow step definitions
 * Supports: log, set_variable, conditional, and return step types
 */

export interface WorkflowStep {
  name: string;
  type: 'log' | 'set_variable' | 'conditional' | 'return';
  message?: string;
  variableName?: string;
  value?: any;
  condition?: string;
  then?: WorkflowStep[];
  else?: WorkflowStep[];
  status?: 'pending' | 'completed' | 'failed';
}

export interface WorkflowDefinition {
  name: string;
  description: string;
  inputSchema: any;
  steps: WorkflowStep[];
}

export interface ExecutionContext {
  variables: Map<string, any>;
  inputs: Record<string, any>;
  logs: string[];
  result?: any;
  currentStep: number;
}

export class WorkflowExecutor {
  /**
   * Execute a workflow with given inputs
   */
  async execute(workflow: WorkflowDefinition, inputs: Record<string, any>): Promise<ExecutionContext> {
    const context: ExecutionContext = {
      variables: new Map(),
      inputs,
      logs: [],
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
   * Resolve a value path (e.g., "variableName" or "input.fieldName")
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
    
    // Otherwise, it's a variable
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

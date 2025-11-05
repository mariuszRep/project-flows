/**
 * WORKFLOW FUNCTION REGISTRY
 *
 * Central registry for all workflow-callable functions.
 * Functions registered here can be called from workflow steps.
 */

import { hello_world, add_numbers, FunctionResult } from "./test-functions.js";

/**
 * Function definition for UI discovery
 */
export interface FunctionDefinition {
  name: string;
  description: string;
  parameters: {
    name: string;
    type: string;
    description: string;
    required: boolean;
  }[];
}

/**
 * Function signature
 */
type WorkflowFunction = (params: any) => Promise<FunctionResult>;

/**
 * Function Registry
 */
class FunctionRegistry {
  private functions: Map<string, WorkflowFunction> = new Map();
  private definitions: Map<string, FunctionDefinition> = new Map();

  constructor() {
    // Register test functions
    this.register(
      "hello_world",
      hello_world,
      {
        name: "hello_world",
        description: "Returns a greeting message (TEST FUNCTION)",
        parameters: [
          {
            name: "name",
            type: "string",
            description: "Name to greet (optional, defaults to 'World')",
            required: false
          }
        ]
      }
    );

    this.register(
      "add_numbers",
      add_numbers,
      {
        name: "add_numbers",
        description: "Adds two numbers together (TEST FUNCTION)",
        parameters: [
          {
            name: "a",
            type: "number",
            description: "First number",
            required: true
          },
          {
            name: "b",
            type: "number",
            description: "Second number",
            required: true
          }
        ]
      }
    );
  }

  /**
   * Register a function
   */
  private register(name: string, fn: WorkflowFunction, definition: FunctionDefinition) {
    this.functions.set(name, fn);
    this.definitions.set(name, definition);
  }

  /**
   * Call a registered function
   */
  async call(name: string, params: any): Promise<FunctionResult> {
    const fn = this.functions.get(name);
    if (!fn) {
      return {
        success: false,
        error: `Function '${name}' not found in registry`
      };
    }

    try {
      return await fn(params);
    } catch (error: any) {
      return {
        success: false,
        error: error.message || "Unknown error occurred"
      };
    }
  }

  /**
   * Get all function definitions
   */
  getDefinitions(): FunctionDefinition[] {
    return Array.from(this.definitions.values());
  }

  /**
   * Get a specific function definition
   */
  getDefinition(name: string): FunctionDefinition | undefined {
    return this.definitions.get(name);
  }

  /**
   * Check if a function exists
   */
  has(name: string): boolean {
    return this.functions.has(name);
  }
}

// Export singleton instance
export const functionRegistry = new FunctionRegistry();

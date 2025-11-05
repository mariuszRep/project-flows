/**
 * WORKFLOW FUNCTION REGISTRY
 *
 * Central registry for all workflow-callable functions.
 * Functions are loaded dynamically from database (type='node' templates)
 */

import DatabaseService from '../database.js';
import { handlers } from './handlers/index.js';

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
 * Function result type
 */
export interface FunctionResult {
  success: boolean;
  data?: any;
  error?: string;
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
  private loaded = false;

  /**
   * Load function definitions from database (type='node')
   */
  async loadFromDatabase(dbService: DatabaseService): Promise<void> {
    console.log('[FunctionRegistry] Loading function nodes from database...');

    try {
      // Get all templates with type='node'
      const templates = await dbService.getTemplates();
      const nodeTemplates = templates.filter((t: any) => t.type === 'node');

      console.log(`[FunctionRegistry] Found ${nodeTemplates.length} node template(s)`);

      // Clear existing registrations
      this.functions.clear();
      this.definitions.clear();

      // Load each node template
      for (const template of nodeTemplates) {
        try {
          // Load properties (parameters)
          const properties = await dbService.listProperties(template.id);
          const parameters = properties.filter((p: any) => p.step_type === 'property');

          // Build function definition
          const definition: FunctionDefinition = {
            name: template.name,
            description: template.description,
            parameters: parameters.map((p: any) => ({
              name: p.key,
              type: p.type === 'text' ? 'string' : p.type,
              description: p.description || '',
              required: p.step_config?.required || false
            }))
          };

          // Get handler from metadata
          const handlerName = template.metadata?.function_handler;
          if (!handlerName) {
            console.warn(`[FunctionRegistry] Node template '${template.name}' missing function_handler in metadata, skipping`);
            continue;
          }

          // Load handler implementation
          const handlerLoader = handlers[handlerName];
          if (!handlerLoader) {
            console.warn(`[FunctionRegistry] Handler '${handlerName}' not found for node '${template.name}', skipping`);
            continue;
          }

          const handler = await handlerLoader();

          // Register function
          this.register(template.name, handler, definition);
          console.log(`✅ [FunctionRegistry] Registered function: ${template.name} (handler: ${handlerName})`);

        } catch (error) {
          console.error(`[FunctionRegistry] Error loading node template ${template.id}:`, error);
        }
      }

      this.loaded = true;
      console.log(`[FunctionRegistry] Successfully registered ${this.functions.size} function(s)`);

    } catch (error) {
      console.error('[FunctionRegistry] Error loading functions from database:', error);
      throw error;
    }
  }

  /**
   * Register a function (private - only called by loadFromDatabase)
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
      // Extract values from parameter objects if they have type/value structure
      const processedParams: Record<string, any> = {};
      for (const [key, value] of Object.entries(params)) {
        if (value && typeof value === 'object' && 'value' in value) {
          processedParams[key] = value.value;
        } else {
          processedParams[key] = value;
        }
      }

      return await fn(processedParams);
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

  /**
   * Check if functions have been loaded from database
   */
  isLoaded(): boolean {
    return this.loaded;
  }
}

// Export singleton instance
export const functionRegistry = new FunctionRegistry();

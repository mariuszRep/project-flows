/**
 * Workflow Storage Service - localStorage-based workflow persistence
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
}

export interface WorkflowDefinition {
  name: string;
  description: string;
  inputSchema: any;
  steps: WorkflowStep[];
  createdAt?: string;
  updatedAt?: string;
}

const STORAGE_KEY = 'project-flows-workflows';
const CURRENT_VERSION = 1;

interface WorkflowStorage {
  version: number;
  workflows: Record<string, WorkflowDefinition>;
}

const DEFAULT_STORAGE: WorkflowStorage = {
  version: CURRENT_VERSION,
  workflows: {},
};

export const workflowStorageService = {
  /**
   * Save a workflow to localStorage
   */
  saveWorkflow(workflow: WorkflowDefinition): void {
    try {
      const storage = this.loadStorage();
      const now = new Date().toISOString();
      
      const workflowToSave: WorkflowDefinition = {
        ...workflow,
        updatedAt: now,
        createdAt: storage.workflows[workflow.name]?.createdAt || now,
      };
      
      storage.workflows[workflow.name] = workflowToSave;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(storage));
    } catch (error) {
      console.error('Failed to save workflow:', error);
      throw new Error('Failed to save workflow to localStorage');
    }
  },

  /**
   * Load a specific workflow by name
   */
  loadWorkflow(name: string): WorkflowDefinition | null {
    try {
      const storage = this.loadStorage();
      return storage.workflows[name] || null;
    } catch (error) {
      console.error('Failed to load workflow:', error);
      return null;
    }
  },

  /**
   * Load all workflows
   */
  loadAllWorkflows(): WorkflowDefinition[] {
    try {
      const storage = this.loadStorage();
      return Object.values(storage.workflows);
    } catch (error) {
      console.error('Failed to load workflows:', error);
      return [];
    }
  },

  /**
   * Delete a workflow
   */
  deleteWorkflow(name: string): boolean {
    try {
      const storage = this.loadStorage();
      if (storage.workflows[name]) {
        delete storage.workflows[name];
        localStorage.setItem(STORAGE_KEY, JSON.stringify(storage));
        return true;
      }
      return false;
    } catch (error) {
      console.error('Failed to delete workflow:', error);
      return false;
    }
  },

  /**
   * Check if a workflow exists
   */
  workflowExists(name: string): boolean {
    try {
      const storage = this.loadStorage();
      return name in storage.workflows;
    } catch (error) {
      return false;
    }
  },

  /**
   * Validate workflow definition
   */
  validateWorkflow(workflow: any): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!workflow.name || typeof workflow.name !== 'string') {
      errors.push('Workflow name is required and must be a string');
    }

    if (!workflow.description || typeof workflow.description !== 'string') {
      errors.push('Workflow description is required and must be a string');
    }

    if (!workflow.inputSchema || typeof workflow.inputSchema !== 'object') {
      errors.push('Workflow inputSchema is required and must be an object');
    }

    if (!Array.isArray(workflow.steps)) {
      errors.push('Workflow steps must be an array');
    } else if (workflow.steps.length === 0) {
      errors.push('Workflow must have at least one step');
    } else {
      // Validate each step
      workflow.steps.forEach((step: any, index: number) => {
        if (!step.name || typeof step.name !== 'string') {
          errors.push(`Step ${index + 1}: name is required and must be a string`);
        }
        if (!step.type || !['log', 'set_variable', 'conditional', 'return'].includes(step.type)) {
          errors.push(`Step ${index + 1}: type must be one of: log, set_variable, conditional, return`);
        }
      });
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  },

  /**
   * Load storage from localStorage
   */
  loadStorage(): WorkflowStorage {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) {
        return DEFAULT_STORAGE;
      }

      const parsed = JSON.parse(stored) as WorkflowStorage;

      // Handle version migration if needed
      if (parsed.version !== CURRENT_VERSION) {
        const migrated = this.migrateStorage(parsed);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
        return migrated;
      }

      return parsed;
    } catch (error) {
      console.error('Failed to load workflow storage:', error);
      return DEFAULT_STORAGE;
    }
  },

  /**
   * Migrate storage format (for future versions)
   */
  migrateStorage(oldStorage: any): WorkflowStorage {
    return {
      ...DEFAULT_STORAGE,
      workflows: oldStorage.workflows || {},
    };
  },

  /**
   * Clear all workflows
   */
  clearAllWorkflows(): void {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.error('Failed to clear workflows:', error);
    }
  },

  /**
   * Export workflows as JSON
   */
  exportWorkflows(): string {
    const storage = this.loadStorage();
    return JSON.stringify(storage.workflows, null, 2);
  },

  /**
   * Import workflows from JSON
   */
  importWorkflows(jsonString: string): { success: boolean; count: number; errors: string[] } {
    try {
      const workflows = JSON.parse(jsonString);
      const errors: string[] = [];
      let count = 0;

      if (typeof workflows !== 'object' || workflows === null) {
        return { success: false, count: 0, errors: ['Invalid JSON format'] };
      }

      for (const [name, workflow] of Object.entries(workflows)) {
        const validation = this.validateWorkflow(workflow);
        if (validation.valid) {
          this.saveWorkflow(workflow as WorkflowDefinition);
          count++;
        } else {
          errors.push(`Workflow '${name}': ${validation.errors.join(', ')}`);
        }
      }

      return {
        success: errors.length === 0,
        count,
        errors,
      };
    } catch (error) {
      return {
        success: false,
        count: 0,
        errors: [(error as Error).message],
      };
    }
  },
};

export type { WorkflowStorage };

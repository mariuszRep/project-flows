import { Tool, TextContent } from "@modelcontextprotocol/sdk/types.js";
import { TaskData, TaskStage } from "../types/task.js";
import { SchemaProperties, ExecutionChainItem } from "../types/property.js";
import DatabaseService from "../database.js";

export class RuleTools {
  constructor(
    private sharedDbService: DatabaseService,
    private clientId: string,
    private loadRuleSchemaProperties: () => Promise<SchemaProperties>,
    private createExecutionChain: (properties: SchemaProperties) => ExecutionChainItem[],
    private validateDependencies: (properties: SchemaProperties, args: Record<string, any>, isUpdateContext?: boolean) => boolean,
    private projectTools?: any
  ) {}

  getToolDefinitions(allProperties: Record<string, any>): Tool[] {
    return [
      {
        name: "create_rule",
        description: "Create a rule by following each property's individual prompt instructions exactly. Each field (Title, Description, etc.) has specific formatting requirements - read and follow each property's prompt precisely. Do not impose your own formatting or structure. Each property prompt defines exactly what content and format is required for that field. Use parent_id to create hierarchical rules (e.g., rules under a project).",
        inputSchema: {
          type: "object",
          properties: {
            parent_id: {
              type: "number",
              description: "Optional parent project ID to create hierarchical relationships (rules under parent projects)"
            },
            ...allProperties
          },
          required: ["Title", "Description"],
        },
      } as Tool,
      {
        name: "update_rule",
        description: "Update an existing rule by rule ID. Provide the rule_id and any subset of fields to update. All fields except rule_id are optional. To change a rule's stage, include the 'stage' parameter with one of these values: 'draft', 'backlog', 'doing', 'review', or 'completed'.",
        inputSchema: {
          type: "object",
          properties: {
            rule_id: {
              type: "number",
              description: "The numeric ID of the rule to update"
            },
            parent_id: {
              type: "number",
              description: "Optional parent project ID for hierarchical relationships"
            },
            ...allProperties
          },
          required: ["rule_id"],
        },
      } as Tool,
    ];
  }

  canHandle(toolName: string): boolean {
    return ["create_rule", "update_rule"].includes(toolName);
  }

  async handle(name: string, toolArgs?: Record<string, any>) {
    switch (name) {
      case "create_rule":
        return await this.handleCreateRule(toolArgs);
      case "update_rule":
        return await this.handleUpdateRule(toolArgs);
      default:
        throw new Error(`Unknown rule tool: ${name}`);
    }
  }

  private async handleCreateRule(toolArgs?: Record<string, any>) {
    const dynamicProperties = await this.loadRuleSchemaProperties();

    // Validate dependencies
    if (!this.validateDependencies(dynamicProperties, toolArgs || {}, false)) {
      return {
        content: [
          {
            type: "text",
            text: "Error: Dependency validation failed. Check logs for details.",
          } as TextContent,
        ],
      };
    }

    // Create execution chain
    const executionChain = this.createExecutionChain(dynamicProperties);

    // Prepare rule data - all properties go into blocks now
    const ruleData: Omit<TaskData, 'id'> = {};

    // Handle parent_id for hierarchical rules
    if (toolArgs?.parent_id !== undefined) {
      ruleData.parent_id = toolArgs.parent_id;
      console.log(`Creating rule with parent_id ${toolArgs.parent_id}`);
    } else {
      // If no parent_id is provided, use the selected project from global state
      if (this.projectTools) {
        try {
          // Get the selected project ID from global state
          const selectedProjectId = await this.sharedDbService.getGlobalState('selected_project_id');
          if (selectedProjectId !== null) {
            ruleData.parent_id = selectedProjectId;
            console.log(`Using selected project ID ${selectedProjectId} as parent_id`);
          }
        } catch (error) {
          console.error('Error getting selected project:', error);
        }
      }
    }

    // Set template_id to 4 for rules (create_rule always creates rules)
    ruleData.template_id = 4;

    // Add all properties (including Title and Description) to rule data
    for (const { prop_name } of executionChain) {
      const value = toolArgs?.[prop_name] || "";
      if (value) {
        ruleData[prop_name] = value;
      }
    }

    // Also add any properties not in the execution chain (exclude parent_id as it's already handled)
    for (const [key, value] of Object.entries(toolArgs || {})) {
      if (value && key !== 'parent_id' && !ruleData[key]) {
        ruleData[key] = value;
      }
    }

    // Store rule in database
    let ruleId: number;
    try {
      ruleId = await this.sharedDbService.createTask(ruleData, this.clientId);
    } catch (error) {
      console.error('Error creating rule:', error);
      return {
        content: [
          {
            type: "text",
            text: "Error: Failed to create rule in database.",
          } as TextContent,
        ],
      };
    }

    // Create JSON response with rule data
    const title = toolArgs?.Title || "";
    const description = toolArgs?.Description || "";

    // Get project/parent information if rule has parent_id
    let projectInfo = 'None';
    let projectId = ruleData.parent_id;

    if (projectId) {
      try {
        const parentTask = await this.sharedDbService.getTask(projectId);
        projectInfo = parentTask ? `${parentTask.Title || 'Untitled'}` : 'Unknown';
      } catch (error) {
        console.error('Error loading parent/project task:', error);
        projectInfo = 'Unknown';
      }
    }

    const templateId = ruleData.template_id || 4;
    const typeDisplay = 'Rule';

    // Build JSON response with structured data
    const jsonResponse = {
      success: true,
      rule_id: ruleId,
      type: typeDisplay.toLowerCase(),
      title: title,
      description: description,
      project_id: projectId,
      project_name: projectInfo,
      template_id: templateId,
      stage: ruleData.stage || 'draft',
      // Add all dynamic properties
      ...Object.fromEntries(
        executionChain
          .filter(({ prop_name }) =>
            toolArgs?.[prop_name] &&
            prop_name !== 'Title' &&
            prop_name !== 'Description'
          )
          .map(({ prop_name }) => [prop_name, toolArgs?.[prop_name]])
      )
    };

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(jsonResponse, null, 2),
        } as TextContent,
      ],
    };
  }

  private async handleUpdateRule(toolArgs?: Record<string, any>) {
    // Handle updating an existing rule by ID
    const ruleId = toolArgs?.rule_id;

    // Validate rule ID
    if (!ruleId || typeof ruleId !== 'number' || ruleId < 1) {
      return {
        content: [
          {
            type: "text",
            text: "Error: Valid numeric rule_id is required for update.",
          } as TextContent,
        ],
      };
    }

    // Check if rule exists
    const existingRule = await this.sharedDbService.getTask(ruleId);
    if (!existingRule) {
      return {
        content: [
          {
            type: "text",
            text: `Error: Rule with ID ${ruleId} not found.`,
          } as TextContent,
        ],
      };
    }

    // Verify this is actually a rule (template_id = 4)
    if (existingRule.template_id !== 4) {
      return {
        content: [
          {
            type: "text",
            text: `Error: Object with ID ${ruleId} is not a rule.`,
          } as TextContent,
        ],
      };
    }

    const dynamicProperties = await this.loadRuleSchemaProperties();

    // Filter out rule_id from validation since it's not a content field
    const contentArgs = { ...toolArgs };
    delete contentArgs.rule_id;

    // Prepare update data - all non-stage properties go to blocks
    const updateData: Partial<TaskData> = {};

    // Handle stage, parent_id, and template_id explicitly as they're columns in tasks table
    if (toolArgs?.stage !== undefined) {
      // Validate stage value
      const validStages = ['draft', 'backlog', 'doing', 'review', 'completed'];
      if (validStages.includes(String(toolArgs.stage))) {
        updateData.stage = String(toolArgs.stage) as TaskStage;
      }
    }

    if (toolArgs?.parent_id !== undefined) {
      updateData.parent_id = toolArgs.parent_id;
    }

    // Set template_id to 4 for rules (consistent with create_rule)
    updateData.template_id = 4;

    // Create execution chain to order fields when building markdown
    const executionChain = this.createExecutionChain(dynamicProperties);

    // Add all properties (including Title, Description) to update data
    for (const { prop_name } of executionChain) {
      const value = toolArgs?.[prop_name];
      if (value !== undefined) {
        updateData[prop_name] = value;
      }
    }

    // Also add any properties not in the execution chain (except rule_id, stage, parent_id, and template_id)
    for (const [key, value] of Object.entries(toolArgs || {})) {
      if (key !== 'rule_id' && key !== 'stage' && key !== 'parent_id' && key !== 'template_id' && value !== undefined && !updateData.hasOwnProperty(key)) {
        updateData[key] = value;
      }
    }

    // Update rule in database
    try {
      const updateResult = await this.sharedDbService.updateTask(ruleId, updateData, this.clientId);
      if (!updateResult) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ success: false, message: "No updates were applied." }, null, 2),
            } as TextContent,
          ],
        };
      }
    } catch (error) {
      console.error('Error updating rule:', error);
      return {
        content: [
          {
            type: "text",
            text: "Error: Failed to update rule in database.",
          } as TextContent,
        ],
      };
    }

    // After successful update, return the updated rule details in JSON format
    const updatedRule = await this.sharedDbService.getTask(ruleId);
    if (!updatedRule) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ success: false, message: "Rule not found after update." }, null, 2),
          } as TextContent,
        ],
      };
    }

    // Build blocks object dynamically from rule properties
    const blocks: Record<string, string> = {};
    const systemFields = ['id', 'stage', 'template_id', 'parent_id', 'created_at', 'updated_at', 'created_by', 'updated_by'];
    for (const [key, value] of Object.entries(updatedRule)) {
      if (!systemFields.includes(key) && value) {
        blocks[key] = String(value);
      }
    }

    const jsonResponse = {
      success: true,
      id: updatedRule.id,
      stage: updatedRule.stage || 'draft',
      template_id: 4,
      parent_id: updatedRule.parent_id,
      blocks: blocks
    };

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(jsonResponse, null, 2),
        } as TextContent,
      ],
    };
  }
}

export function createRuleTools(
  sharedDbService: DatabaseService,
  clientId: string,
  loadRuleSchemaProperties: () => Promise<SchemaProperties>,
  createExecutionChain: (properties: SchemaProperties) => ExecutionChainItem[],
  validateDependencies: (properties: SchemaProperties, args: Record<string, any>, isUpdateContext?: boolean) => boolean,
  projectTools?: any
): RuleTools {
  return new RuleTools(
    sharedDbService,
    clientId,
    loadRuleSchemaProperties,
    createExecutionChain,
    validateDependencies,
    projectTools
  );
}
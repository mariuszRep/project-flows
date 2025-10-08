import { Tool, TextContent } from "@modelcontextprotocol/sdk/types.js";
import { TaskData, TaskStage } from "../types/task.js";
import { SchemaProperties, ExecutionChainItem } from "../types/property.js";
import DatabaseService from "../database.js";
import { handleCreate } from "./create-handler.js";

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
    return handleCreate(
      {
        templateId: 4,
        typeName: "Rule",
        responseIdField: "rule_id",
        loadSchema: this.loadRuleSchemaProperties,
      },
      toolArgs,
      this.sharedDbService,
      this.clientId,
      this.createExecutionChain,
      this.validateDependencies,
      this.projectTools
    );
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
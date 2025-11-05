import { Tool, TextContent } from "@modelcontextprotocol/sdk/types.js";
import { TaskData, TaskStage } from "../types/task.js";
import { SchemaProperties, ExecutionChainItem } from "../types/property.js";
import DatabaseService from "../database.js";
import { handleUpdate } from "./update-handler.js";

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
        name: "update_rule",
        description: "Update an existing rule by rule ID. Provide the rule_id and any subset of fields to update. All fields except rule_id are optional. To change a rule's stage, include the 'stage' parameter with one of these values: 'draft', 'backlog', 'doing', 'review', or 'completed'.",
        inputSchema: {
          type: "object",
          properties: {
            rule_id: {
              type: "number",
              description: "The numeric ID of the rule to update"
            },
            stage: {
              type: "string",
              description: "Optional stage: 'draft', 'backlog', 'doing', 'review', or 'completed'",
              enum: ["draft", "backlog", "doing", "review", "completed"]
            },
            related: {
              type: "array",
              description: "Optional parent relationship array (max 1 entry). Provide [{ \"id\": number, \"object\": \"task\" | \"project\" | \"epic\" | \"rule\" }].",
              items: {
                type: "object",
                properties: {
                  id: { type: "number", description: "Parent object ID" },
                  object: { type: "string", description: "Parent object type" }
                },
                required: ["id", "object"]
              }
            },
            ...allProperties
          },
          required: ["rule_id"],
        },
      } as Tool,
    ];
  }

  canHandle(toolName: string): boolean {
    return ["update_rule"].includes(toolName);
  }

  async handle(name: string, toolArgs?: Record<string, any>) {
    switch (name) {
      case "update_rule":
        return await this.handleUpdateRule(toolArgs);
      default:
        throw new Error(`Unknown rule tool: ${name}`);
    }
  }

  private async handleUpdateRule(toolArgs?: Record<string, any>) {
    return handleUpdate(
      {
        templateId: 4,
        typeName: "Rule",
        idField: "rule_id",
        loadSchema: this.loadRuleSchemaProperties,
        validateTemplateId: true, // Prevent cross-type updates (e.g., using rule_id on a project)
      },
      toolArgs,
      this.sharedDbService,
      this.clientId,
      this.createExecutionChain
    );
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

/**
 * TEST SAMPLING TOOL - ISOLATED AND DISPOSABLE
 *
 * This is a minimal, self-contained MCP tool for testing sampling functionality.
 * It can be safely deleted at any time without affecting other parts of the system.
 *
 * Purpose: Test the MCP sampling API by passing prompts to the LLM agent
 */

import { Tool, TextContent } from "@modelcontextprotocol/sdk/types.js";

export class TestSamplingTool {
  private server: any; // MCP Server instance for sampling

  constructor(server: any) {
    this.server = server;
  }

  /**
   * Get tool definitions for MCP
   */
  getToolDefinitions(): Tool[] {
    return [
      {
        name: "test_sampling",
        description: "A test tool for MCP sampling. Sends a prompt to the LLM agent and returns the response. This is for testing purposes only and can be deleted.",
        inputSchema: {
          type: "object",
          properties: {
            prompt: {
              type: "string",
              description: "The prompt to send to the LLM agent for execution"
            },
            max_tokens: {
              type: "number",
              description: "Maximum tokens for the response (default: 1000)",
              default: 1000
            },
            system_prompt: {
              type: "string",
              description: "Optional system prompt to guide the agent's behavior"
            }
          },
          required: ["prompt"]
        }
      } as Tool
    ];
  }

  /**
   * Check if this handler can handle the given tool name
   */
  canHandle(toolName: string): boolean {
    return toolName === "test_sampling";
  }

  /**
   * Handle tool execution
   */
  async handle(name: string, toolArgs?: Record<string, any>) {
    if (name === "test_sampling") {
      return await this.testSampling(toolArgs);
    }
    throw new Error(`Unknown tool: ${name}`);
  }

  /**
   * Test sampling by sending a prompt to the LLM agent
   */
  private async testSampling(toolArgs?: Record<string, any>) {
    const prompt = toolArgs?.prompt;
    const maxTokens = toolArgs?.max_tokens || 1000;
    const systemPrompt = toolArgs?.system_prompt;

    if (!prompt) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              success: false,
              error: "Missing required parameter: prompt"
            }, null, 2)
          } as TextContent
        ]
      };
    }

    console.log(`[TestSampling] Sending prompt to LLM agent (${prompt.length} chars, max_tokens: ${maxTokens})`);

    // Test if server is available
    if (!this.server) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              success: false,
              error: "MCP server instance not available for sampling"
            }, null, 2)
          } as TextContent
        ]
      };
    }

    // Execute sampling request
    try {
      console.log(`[TestSampling] Requesting sampling from MCP client...`);

      const params: any = {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: prompt
            }
          }
        ],
        maxTokens: maxTokens
      };

      // Add system prompt if provided
      if (systemPrompt) {
        params.systemPrompt = systemPrompt;
      }

      const response = await this.server.request({
        method: 'sampling/createMessage',
        params: params
      });

      console.log(`[TestSampling] Received response from MCP client`);

      // Extract text from response
      let responseText: string | null = null;
      if (response && response.content) {
        if (response.content.type === 'text') {
          responseText = response.content.text;
        } else if (Array.isArray(response.content)) {
          // Handle array of content blocks
          const textBlocks = response.content
            .filter((block: any) => block.type === 'text')
            .map((block: any) => block.text);
          responseText = textBlocks.join('\n');
        }
      }

      // Return success result
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              success: true,
              sampling_result: responseText,
              metadata: {
                prompt_length: prompt.length,
                response_length: responseText?.length || 0,
                max_tokens: maxTokens,
                system_prompt_provided: !!systemPrompt
              }
            }, null, 2)
          } as TextContent
        ]
      };

    } catch (error) {
      console.error(`[TestSampling] Sampling failed:`, error);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              success: false,
              error: `Sampling failed: ${(error as Error).message}`,
              error_details: error
            }, null, 2)
          } as TextContent
        ]
      };
    }
  }
}

/**
 * Factory function to create the test sampling tool
 */
export function createTestSamplingTool(server: any): TestSamplingTool {
  return new TestSamplingTool(server);
}

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema, McpError, ErrorCode, } from '@modelcontextprotocol/sdk/types.js';
class MarkdownScriptGenerator {
    server;
    constructor() {
        this.server = new Server({
            name: 'markdown-script-generator',
            version: '1.0.0',
        }, {
            capabilities: {
                tools: {},
            },
        });
        this.setupToolHandlers();
    }
    setupToolHandlers() {
        this.server.setRequestHandler(ListToolsRequestSchema, async () => {
            return {
                tools: [
                    {
                        name: 'generate_markdown_script',
                        description: 'Generate a markdown script based on the provided structure with title, stage, and blocks',
                        inputSchema: {
                            type: 'object',
                            properties: {
                                script: {
                                    type: 'object',
                                    properties: {
                                        title: {
                                            type: 'string',
                                            description: 'The title of the markdown script',
                                        },
                                        stage: {
                                            type: 'string',
                                            description: 'The current stage (e.g., Draft, Review, Final)',
                                        },
                                        blocks: {
                                            type: 'array',
                                            items: {
                                                type: 'object',
                                                additionalProperties: {
                                                    type: 'string',
                                                },
                                            },
                                            description: 'Array of blocks containing section headers and content instructions',
                                        },
                                    },
                                    required: ['title', 'stage', 'blocks'],
                                },
                                headerLevel: {
                                    type: 'number',
                                    description: 'Starting header level (default: 1)',
                                    default: 1,
                                },
                            },
                            required: ['script'],
                        },
                    },
                    {
                        name: 'create_default_script',
                        description: 'Create a default markdown script template with common sections',
                        inputSchema: {
                            type: 'object',
                            properties: {
                                title: {
                                    type: 'string',
                                    description: 'Custom title for the script',
                                    default: 'Generated Script',
                                },
                                includeOptionalSections: {
                                    type: 'boolean',
                                    description: 'Include optional sections like References and Conclusion',
                                    default: false,
                                },
                            },
                        },
                    },
                    {
                        name: 'generate_plan_from_prompt',
                        description: 'Generate a complete markdown plan from a natural language prompt',
                        inputSchema: {
                            type: 'object',
                            properties: {
                                prompt: {
                                    type: 'string',
                                    description: 'Natural language prompt describing what to create a plan for',
                                },
                                headerLevel: {
                                    type: 'number',
                                    description: 'Starting header level (default: 1)',
                                    default: 1,
                                },
                            },
                            required: ['prompt'],
                        },
                    },
                ],
            };
        });
        this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
            const { name, arguments: args } = request.params;
            try {
                switch (name) {
                    case 'generate_markdown_script':
                        return await this.generateMarkdownScript(args);
                    case 'create_default_script':
                        return await this.createDefaultScript(args);
                    case 'generate_plan_from_prompt':
                        return await this.generatePlanFromPrompt(args);
                    default:
                        throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
                }
            }
            catch (error) {
                throw new McpError(ErrorCode.InternalError, `Error executing tool ${name}: ${error instanceof Error ? error.message : String(error)}`);
            }
        });
    }
    async generateMarkdownScript(args) {
        const { script, headerLevel = 1 } = args;
        if (!script || !script.title || !script.stage || !script.blocks) {
            throw new Error('Invalid script structure. Required: title, stage, and blocks');
        }
        let markdown = '';
        // Add title and metadata
        markdown += `${'#'.repeat(headerLevel)} ${script.title}\n\n`;
        markdown += `**Stage:** ${script.stage}\n\n`;
        markdown += `---\n\n`;
        // Process each block
        for (const block of script.blocks) {
            for (const [sectionName, instruction] of Object.entries(block)) {
                // Create section header
                markdown += `${'#'.repeat(headerLevel + 1)} ${sectionName}\n\n`;
                // Add instruction as a blockquote or comment
                if (instruction.trim()) {
                    markdown += `> **LLM Instruction:** ${instruction}\n\n`;
                }
                // Add placeholder for generated content
                markdown += `<!-- Generated content for ${sectionName} will appear here -->\n\n`;
                markdown += `---\n\n`;
            }
        }
        return {
            content: [
                {
                    type: 'text',
                    text: markdown,
                },
            ],
        };
    }
    async generatePlanFromPrompt(args) {
        const { prompt, headerLevel = 1 } = args;
        if (!prompt || !prompt.trim()) {
            throw new Error('Prompt is required');
        }
        // Create a template based on the prompt
        const template = this.createTemplateFromPrompt(prompt);
        // Use the existing generateMarkdownScript method
        return await this.generateMarkdownScript({
            script: template,
            headerLevel
        });
    }
    createTemplateFromPrompt(prompt) {
        // Extract key information from prompt
        const promptLower = prompt.toLowerCase();
        // Determine title based on prompt content
        let title = 'Web Application Development Plan';
        if (promptLower.includes('todo') || promptLower.includes('task')) {
            title = 'Todo Web Application Development Plan';
        }
        else if (promptLower.includes('chat') || promptLower.includes('messaging')) {
            title = 'Chat Application Development Plan';
        }
        else if (promptLower.includes('blog') || promptLower.includes('cms')) {
            title = 'Blog/CMS Application Development Plan';
        }
        else if (promptLower.includes('ecommerce') || promptLower.includes('shop')) {
            title = 'E-commerce Application Development Plan';
        }
        // Return template with instruction blocks
        return {
            title,
            stage: 'Draft',
            blocks: [
                {
                    'Introduction': 'Introduce the application, its purpose, and benefits for users'
                },
                {
                    'Requirements': 'List functional and technical requirements for the application'
                },
                {
                    'Technology Stack': 'Explain the chosen technologies, frameworks, and tools'
                },
                {
                    'Architecture': 'Provide overview of system architecture and design patterns'
                },
                {
                    'Implementation Steps': 'Show practical implementation steps with code examples'
                },
                {
                    'Testing Strategy': 'Demonstrate testing approaches and quality assurance methods'
                },
                {
                    'Deployment': 'Share deployment strategies and production considerations'
                },
                {
                    'Maintenance': 'Address ongoing maintenance and optimization practices'
                }
            ]
        };
    }
    async createDefaultScript(args) {
        const { title = 'Generated Script', includeOptionalSections = false } = args;
        const defaultScript = {
            title,
            stage: 'Draft',
            blocks: [
                {
                    'Prompt': 'Refine and enhance the original user request to be more specific and actionable',
                },
                {
                    'Notes': 'Analyze the requirements and provide detailed reasoning for the approach',
                },
                {
                    'Items': 'Break down the task into sequential, actionable steps',
                },
            ],
        };
        // Add optional sections if requested
        if (includeOptionalSections) {
            defaultScript.blocks.push({
                'References': 'List relevant sources, documentation, or external resources needed for the task',
            }, {
                'Conclusion': 'Summarize the expected outcome and next steps after task completion',
            });
        }
        return await this.generateMarkdownScript({ script: defaultScript });
    }
    async run() {
        const transport = new StdioServerTransport();
        await this.server.connect(transport);
        console.error('Markdown Script Generator MCP server running on stdio');
    }
}
// Example usage and testing
export class MarkdownScriptTester {
    static async testGeneration() {
        const generator = new MarkdownScriptGenerator();
        // Test with custom script
        const customScript = {
            title: 'API Integration Task',
            stage: 'Planning',
            blocks: [
                {
                    'Prompt': 'Create a comprehensive plan for integrating a third-party API into our application',
                },
                {
                    'Analysis': 'Examine the API documentation and identify key endpoints, authentication requirements, and data structures',
                },
                {
                    'Implementation Steps': 'Define the sequential steps needed to implement the API integration with proper error handling',
                },
                {
                    'Testing Strategy': 'Outline the testing approach including unit tests, integration tests, and error scenarios',
                },
            ],
        };
        try {
            const result = await generator['generateMarkdownScript']({ script: customScript });
            console.log('Generated Markdown:');
            console.log(result.content[0].text);
        }
        catch (error) {
            console.error('Error:', error);
        }
    }
}
// Main execution
if (import.meta.url === `file://${process.argv[1]}`) {
    const generator = new MarkdownScriptGenerator();
    generator.run().catch(console.error);
}
export default MarkdownScriptGenerator;
//# sourceMappingURL=index.js.map
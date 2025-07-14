#!/usr/bin/env node
/**
 * Simple Hello World MCP Server in TypeScript
 */
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema, } from "@modelcontextprotocol/sdk/types.js";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const server = new Server({
    name: "hello-world-server",
    version: "1.0.0",
}, {
    capabilities: {
        tools: {},
    },
});
function loadDynamicSchemaProperties() {
    /**
     * Load schema properties from external file.
     */
    try {
        const schemaFile = join(__dirname, "..", "schema_properties.json");
        const data = readFileSync(schemaFile, "utf8");
        return JSON.parse(data);
    }
    catch (error) {
        return {};
    }
}
function createExecutionChain(properties) {
    /**
     * Create execution chain based on dependencies and execution order.
     */
    const sortedProps = [];
    for (const [propName, propConfig] of Object.entries(properties)) {
        const executionOrder = propConfig.execution_order ?? 999;
        sortedProps.push({
            execution_order: executionOrder,
            prop_name: propName,
            prop_config: propConfig,
        });
    }
    return sortedProps.sort((a, b) => a.execution_order - b.execution_order);
}
function validateDependencies(properties, args) {
    /**
     * Validate that dependencies are satisfied for each property that has a value.
     */
    for (const [propName, propConfig] of Object.entries(properties)) {
        const dependencies = propConfig.dependencies || [];
        // Only validate dependencies for properties that are actually provided and have values
        if (propName in args && args[propName]) {
            for (const dep of dependencies) {
                if (!(dep in args) || !args[dep]) {
                    return false;
                }
            }
        }
    }
    return true;
}
server.setRequestHandler(ListToolsRequestSchema, async () => {
    /**
     * List available tools.
     */
    const baseProperties = {
        Title: {
            type: "string",
            description: "Clear, specific, and actionable task title. Use action verbs and be precise about what needs to be accomplished. Examples: 'Implement user login with OAuth', 'Fix database connection timeout issue', 'Design API endpoints for user management'",
            execution_order: 1,
        },
        Summary: {
            type: "string",
            description: "Description of the original request or problem statement. Include the 'what' and 'why' - what needs to be accomplished and why it's important.",
            execution_order: 2,
        },
    };
    const dynamicProperties = loadDynamicSchemaProperties();
    // Clean properties for schema (remove execution metadata)
    const schemaProperties = {};
    for (const [propName, propConfig] of Object.entries(dynamicProperties)) {
        const cleanConfig = {};
        for (const [key, value] of Object.entries(propConfig)) {
            if (!["dependencies", "execution_order"].includes(key)) {
                cleanConfig[key] = value;
            }
        }
        schemaProperties[propName] = cleanConfig;
    }
    const allProperties = { ...baseProperties, ...schemaProperties };
    return {
        tools: [
            {
                name: "create_task",
                description: "Create a detailed task plan with markdown formatting, make sure you populate 'Title' and 'Summary' and later all the rest of the properties",
                inputSchema: {
                    type: "object",
                    properties: allProperties,
                    required: ["Title", "Summary"],
                },
            },
        ],
    };
});
server.setRequestHandler(CallToolRequestSchema, async (request) => {
    /**
     * Handle tool calls.
     */
    const { name, arguments: toolArgs } = request.params;
    if (name === "create_task") {
        const title = toolArgs?.Title || "";
        const summary = toolArgs?.Summary || "";
        const dynamicProperties = loadDynamicSchemaProperties();
        // Validate dependencies
        if (!validateDependencies(dynamicProperties, toolArgs || {})) {
            return {
                content: [
                    {
                        type: "text",
                        text: "Error: Dependency validation failed. Check logs for details.",
                    },
                ],
            };
        }
        // Create execution chain
        const executionChain = createExecutionChain(dynamicProperties);
        // Create the markdown formatted task plan
        let markdownContent = `# Task

**Title:** ${title}

## Summary

${summary}
`;
        // Process properties in execution order
        for (const { prop_name } of executionChain) {
            const value = toolArgs?.[prop_name] || "";
            if (value) {
                markdownContent += `\n## ${prop_name}\n\n${value}\n`;
            }
        }
        return {
            content: [
                {
                    type: "text",
                    text: markdownContent,
                },
            ],
        };
    }
    else {
        throw new Error(`Unknown tool: ${name}`);
    }
});
async function main() {
    /**
     * Main entry point for the server.
     */
    const transport = new StdioServerTransport();
    await server.connect(transport);
}
if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch((error) => {
        console.error("Server error:", error);
        process.exit(1);
    });
}
//# sourceMappingURL=index.js.map
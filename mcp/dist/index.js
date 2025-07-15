#!/usr/bin/env node
/**
 * Simple Hello World MCP Server in TypeScript
 */
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import express from "express";
import cors from "cors";
import { CallToolRequestSchema, ListToolsRequestSchema, } from "@modelcontextprotocol/sdk/types.js";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import DatabaseService from "./database.js";
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// Initialize shared database service for all connections
const sharedDbService = new DatabaseService();
// Factory function to create a configured MCP server instance
function createMcpServer() {
    const server = new Server({
        name: "project-flows",
        version: "1.0.0",
    }, {
        capabilities: {
            tools: {},
        },
    });
    async function loadDynamicSchemaProperties() {
        /**
         * Load schema properties from database.
         */
        try {
            return await sharedDbService.getSchemaProperties();
        }
        catch (error) {
            console.error('Error loading schema properties from database:', error);
            // Fallback to file-based loading
            try {
                const schemaFile = join(__dirname, "..", "schema_properties.json");
                const data = readFileSync(schemaFile, "utf8");
                return JSON.parse(data);
            }
            catch (fallbackError) {
                console.error('Fallback file loading also failed:', fallbackError);
                return {};
            }
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
    function validateDependencies(properties, args, isUpdateContext = false) {
        /**
         * Validate that dependencies are satisfied for each property that has a value.
         * In update context, all dependencies must be provided in the same call.
         */
        for (const [propName, propConfig] of Object.entries(properties)) {
            const dependencies = propConfig.dependencies || [];
            // Only validate dependencies for properties that are actually provided and have values
            if (propName in args && args[propName]) {
                for (const dep of dependencies) {
                    if (isUpdateContext) {
                        // In update context, dependency must be provided in the same call
                        if (!(dep in args) || !args[dep]) {
                            return false;
                        }
                    }
                    else {
                        // In create context, allow base properties to be missing if they have defaults
                        if (!(dep in args) || !args[dep]) {
                            return false;
                        }
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
        const dynamicProperties = await loadDynamicSchemaProperties();
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
                {
                    name: "update_task",
                    description: "Update an existing task plan by task ID. Provide the task_id and any subset of fields to update. All fields except task_id are optional.",
                    inputSchema: {
                        type: "object",
                        properties: {
                            task_id: {
                                type: "number",
                                description: "The numeric ID of the task to update"
                            },
                            ...allProperties
                        },
                        required: ["task_id"],
                    },
                },
                {
                    name: "get_task",
                    description: "Retrieve a task by its numeric ID. Returns the complete task data in markdown format.",
                    inputSchema: {
                        type: "object",
                        properties: {
                            task_id: {
                                type: "number",
                                description: "The numeric ID of the task to retrieve"
                            }
                        },
                        required: ["task_id"],
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
            const dynamicProperties = await loadDynamicSchemaProperties();
            // Validate dependencies
            if (!validateDependencies(dynamicProperties, toolArgs || {}, false)) {
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
            // Prepare task data
            const taskData = {
                title: String(title),
                summary: String(summary),
            };
            // Add dynamic properties to task data
            for (const { prop_name } of executionChain) {
                const value = toolArgs?.[prop_name] || "";
                if (value) {
                    taskData[prop_name] = value;
                }
            }
            // Store task in database
            let taskId;
            try {
                taskId = await sharedDbService.createTask(taskData);
            }
            catch (error) {
                console.error('Error creating task:', error);
                return {
                    content: [
                        {
                            type: "text",
                            text: "Error: Failed to create task in database.",
                        },
                    ],
                };
            }
            // Create the markdown formatted task plan
            let markdownContent = `# Task
**Task ID:** ${taskId}

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
        else if (name === "update_task") {
            // Handle updating an existing task by ID
            const taskId = toolArgs?.task_id;
            // Validate task ID
            if (!taskId || typeof taskId !== 'number' || taskId < 1) {
                return {
                    content: [
                        {
                            type: "text",
                            text: "Error: Valid numeric task_id is required for update.",
                        },
                    ],
                };
            }
            // Check if task exists
            const existingTask = await sharedDbService.getTask(taskId);
            if (!existingTask) {
                return {
                    content: [
                        {
                            type: "text",
                            text: `Error: Task with ID ${taskId} not found.`,
                        },
                    ],
                };
            }
            const dynamicProperties = await loadDynamicSchemaProperties();
            // Filter out task_id from validation since it's not a content field
            const contentArgs = { ...toolArgs };
            delete contentArgs.task_id;
            // For updates, we don't validate dependencies since we're only updating partial fields
            // The original task creation would have validated dependencies already
            // Prepare update data
            const updateData = {};
            if (toolArgs?.Title !== undefined) {
                updateData.title = String(toolArgs.Title);
            }
            if (toolArgs?.Summary !== undefined) {
                updateData.summary = String(toolArgs.Summary);
            }
            // Create execution chain to order fields when building markdown
            const executionChain = createExecutionChain(dynamicProperties);
            // Add dynamic properties to update data
            for (const { prop_name } of executionChain) {
                const value = toolArgs?.[prop_name];
                if (value !== undefined) {
                    updateData[prop_name] = value;
                }
            }
            // Update task in database
            try {
                await sharedDbService.updateTask(taskId, updateData);
            }
            catch (error) {
                console.error('Error updating task:', error);
                return {
                    content: [
                        {
                            type: "text",
                            text: "Error: Failed to update task in database.",
                        },
                    ],
                };
            }
            let markdownContent = `# Task Update
**Task ID:** ${taskId}

`;
            // Include provided core fields first
            if (toolArgs?.Title) {
                markdownContent += `**Title (updated):** ${toolArgs.Title}\n\n`;
            }
            if (toolArgs?.Summary) {
                markdownContent += `## Summary (updated)\n\n${toolArgs.Summary}\n`;
            }
            // Append any dynamic property updates in order
            for (const { prop_name } of executionChain) {
                const value = toolArgs?.[prop_name];
                if (value) {
                    markdownContent += `\n## ${prop_name} (updated)\n\n${value}\n`;
                }
            }
            // If no content fields were supplied, inform user
            const hasContentUpdates = Object.keys(contentArgs).length > 0;
            if (!hasContentUpdates) {
                markdownContent += "No fields supplied for update.";
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
        else if (name === "get_task") {
            // Handle retrieving a task by ID
            const taskId = toolArgs?.task_id;
            // Validate task ID
            if (!taskId || typeof taskId !== 'number' || taskId < 1) {
                return {
                    content: [
                        {
                            type: "text",
                            text: "Error: Valid numeric task_id is required for retrieval.",
                        },
                    ],
                };
            }
            // Get task from database
            const task = await sharedDbService.getTask(taskId);
            if (!task) {
                return {
                    content: [
                        {
                            type: "text",
                            text: `Error: Task with ID ${taskId} not found.`,
                        },
                    ],
                };
            }
            const dynamicProperties = await loadDynamicSchemaProperties();
            const executionChain = createExecutionChain(dynamicProperties);
            // Generate markdown for the complete task
            let markdownContent = `# Task
**Task ID:** ${task.id}

**Title:** ${task.title}

## Summary

${task.summary}
`;
            // Add dynamic properties in execution order
            for (const { prop_name } of executionChain) {
                const value = task[prop_name];
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
    return server;
}
// Create Express app
const app = express();
// Enable CORS for all routes
app.use(cors());
// Add request timeout and connection limits (but skip for SSE connections)
app.use((req, res, next) => {
    // Skip timeout for SSE connections since they're meant to be long-lived
    if (req.url !== '/sse') {
        res.setTimeout(30000, () => {
            console.log('Request timeout for', req.url);
            if (!res.headersSent) {
                res.status(408).send('Request timeout');
            }
        });
    }
    next();
});
// Support multiple simultaneous connections with per-session MCP servers
const connections = {};
app.get("/", async (_, res) => {
    res.status(200).send('Project Flows MCP Server - Multiple clients supported with shared database');
});
app.get("/sse", async (_, res) => {
    try {
        const transport = new SSEServerTransport('/messages', res);
        const serverInstance = createMcpServer(); // Create new MCP server instance per connection
        connections[transport.sessionId] = { transport, server: serverInstance };
        // Clean up connection on close
        res.on("close", () => {
            console.log(`Connection closed for session: ${transport.sessionId}`);
            delete connections[transport.sessionId];
        });
        console.log(`New connection established with session: ${transport.sessionId}`);
        console.log(`Active connections: ${Object.keys(connections).length}`);
        // Each server connects to its own transport
        await serverInstance.connect(transport);
    }
    catch (error) {
        console.error('Error establishing SSE connection:', error);
        res.status(500).send('Failed to establish connection');
    }
});
app.post("/messages", async (req, res) => {
    const sessionId = req.query.sessionId;
    const connection = connections[sessionId];
    if (connection) {
        try {
            await connection.transport.handlePostMessage(req, res);
        }
        catch (error) {
            console.error(`Error handling message for session ${sessionId}:`, error);
            res.status(500).send('Error processing message');
        }
    }
    else {
        console.warn(`No connection found for sessionId: ${sessionId}`);
        console.log(`Available sessions: ${Object.keys(connections).join(', ')}`);
        res.status(400).send('No connection found for sessionId');
    }
});
async function main() {
    /**
     * Main entry point for the server.
     */
    // Initialize database connection
    try {
        await sharedDbService.initialize();
    }
    catch (error) {
        console.error('Failed to initialize database:', error);
        process.exit(1);
    }
    // Cleanup database connection on exit
    process.on('SIGINT', async () => {
        console.log('Closing database connection...');
        await sharedDbService.close();
        process.exit(0);
    });
    process.on('SIGTERM', async () => {
        console.log('Closing database connection...');
        await sharedDbService.close();
        process.exit(0);
    });
    const port = process.env.PORT || 3001;
    app.listen(port, () => {
        console.log(`🚀 Project Flows MCP Server running on port ${port}`);
        console.log('📊 Multiple clients can now connect simultaneously');
        console.log('🗄️ Shared database ensures all clients see the same data');
        console.log(`🔗 Connect to: http://localhost:${port}/sse`);
    });
}
if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch((error) => {
        console.error("Server error:", error);
        process.exit(1);
    });
}
//# sourceMappingURL=index.js.map
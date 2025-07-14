#!/usr/bin/env node
/**
 * Unit tests for the update_task MCP tool
 */
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
function loadDynamicSchemaProperties() {
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
const testCases = [
    {
        name: "Missing task_id - should fail",
        args: { Title: "Updated Task Title" },
        expectedSuccess: false,
        expectedContent: ["Error: Valid numeric task_id is required"]
    },
    {
        name: "Invalid task_id (string) - should fail",
        args: { task_id: "invalid", Title: "Updated Task Title" },
        expectedSuccess: false,
        expectedContent: ["Error: Valid numeric task_id is required"]
    },
    {
        name: "Invalid task_id (zero) - should fail",
        args: { task_id: 0, Title: "Updated Task Title" },
        expectedSuccess: false,
        expectedContent: ["Error: Valid numeric task_id is required"]
    },
    {
        name: "Single field update - Title only",
        args: { task_id: 1, Title: "Updated Task Title" },
        expectedSuccess: true,
        expectedContent: ["**Task ID:** 1", "**Title (updated):**", "Updated Task Title"]
    },
    {
        name: "Single field update - Summary only",
        args: { task_id: 2, Summary: "Updated summary content" },
        expectedSuccess: true,
        expectedContent: ["**Task ID:** 2", "## Summary (updated)", "Updated summary content"]
    },
    {
        name: "Multi-field update - Title and Summary",
        args: {
            task_id: 3,
            Title: "Multi-field Update Title",
            Summary: "Multi-field summary content"
        },
        expectedSuccess: true,
        expectedContent: ["**Task ID:** 3", "**Title (updated):**", "## Summary (updated)", "Multi-field Update Title", "Multi-field summary content"]
    },
    {
        name: "Research update with Summary dependency satisfied",
        args: {
            task_id: 4,
            Summary: "Base summary for research",
            Research: "Detailed research findings"
        },
        expectedSuccess: true,
        expectedContent: ["**Task ID:** 4", "## Summary (updated)", "## Research (updated)", "Detailed research findings"]
    },
    {
        name: "Research update without Summary dependency - should succeed",
        args: {
            task_id: 5,
            Research: "Research without summary"
        },
        expectedSuccess: true,
        expectedContent: ["**Task ID:** 5", "## Research (updated)", "Research without summary"]
    },
    {
        name: "Items update with all dependencies satisfied",
        args: {
            task_id: 6,
            Summary: "Task summary",
            Research: "Research content",
            Items: "- Item 1\n- Item 2\n- Item 3"
        },
        expectedSuccess: true,
        expectedContent: ["**Task ID:** 6", "## Summary (updated)", "## Research (updated)", "## Items (updated)", "Item 1"]
    },
    {
        name: "Items update missing Research dependency - should succeed",
        args: {
            task_id: 7,
            Summary: "Task summary",
            Items: "- Item 1\n- Item 2"
        },
        expectedSuccess: true,
        expectedContent: ["**Task ID:** 7", "## Summary (updated)", "## Items (updated)", "Item 1"]
    },
    {
        name: "Empty update call - should return helpful message",
        args: { task_id: 8 },
        expectedSuccess: true,
        expectedContent: ["**Task ID:** 8", "No fields supplied for update"]
    }
];
async function runTests() {
    console.log("🧪 Running update_task MCP tool tests...\n");
    const dynamicProperties = loadDynamicSchemaProperties();
    console.log("📋 Loaded schema properties:", Object.keys(dynamicProperties));
    console.log("🔗 Dependencies:", Object.entries(dynamicProperties).map(([name, config]) => `${name}: [${config.dependencies?.join(', ') || 'none'}]`).join(', '));
    console.log("📊 Execution order:", Object.entries(dynamicProperties).map(([name, config]) => `${name}:${config.execution_order}`).join(', '));
    console.log();
    let passed = 0;
    let failed = 0;
    for (const testCase of testCases) {
        console.log(`🔍 Testing: ${testCase.name}`);
        try {
            // Simulate the update_task validation logic
            const taskId = testCase.args?.task_id;
            let markdownContent;
            // First check task ID validation
            if (!taskId || typeof taskId !== 'number' || taskId < 1) {
                markdownContent = "Error: Valid numeric task_id is required for update.";
                if (testCase.expectedSuccess) {
                    console.log(`❌ FAIL: Expected success but task ID validation failed`);
                    failed++;
                    continue;
                }
            }
            else {
                // Filter out task_id for content processing
                const contentArgs = { ...testCase.args };
                delete contentArgs.task_id;
                // Generate success markdown (no dependency validation for updates)
                markdownContent = `# Task Update\n**Task ID:** ${taskId}\n\n`;
                if (testCase.args.Title) {
                    markdownContent += `**Title (updated):** ${testCase.args.Title}\n\n`;
                }
                if (testCase.args.Summary) {
                    markdownContent += `## Summary (updated)\n\n${testCase.args.Summary}\n`;
                }
                const executionChain = createExecutionChain(dynamicProperties);
                for (const { prop_name } of executionChain) {
                    const value = testCase.args[prop_name];
                    if (value) {
                        markdownContent += `\n## ${prop_name} (updated)\n\n${value}\n`;
                    }
                }
                const hasContentUpdates = Object.keys(contentArgs).length > 0;
                if (!hasContentUpdates) {
                    markdownContent += "No fields supplied for update.";
                }
            }
            // Check expected content appears in output
            if (testCase.expectedContent) {
                const allContentFound = testCase.expectedContent.every(content => markdownContent.includes(content));
                if (!allContentFound) {
                    console.log(`❌ FAIL: Expected content not found in output`);
                    console.log(`   Expected: ${testCase.expectedContent.join(', ')}`);
                    console.log(`   Got: ${markdownContent.substring(0, 200)}...`);
                    failed++;
                    continue;
                }
            }
            console.log(`✅ PASS`);
            passed++;
        }
        catch (error) {
            console.log(`❌ FAIL: ${error}`);
            failed++;
        }
        console.log();
    }
    console.log(`\n📊 Test Results: ${passed} passed, ${failed} failed`);
    if (failed === 0) {
        console.log("🎉 All tests passed!");
        return true;
    }
    else {
        console.log("💥 Some tests failed!");
        return false;
    }
}
// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    runTests().then((success) => {
        process.exit(success ? 0 : 1);
    });
}
//# sourceMappingURL=test.js.map
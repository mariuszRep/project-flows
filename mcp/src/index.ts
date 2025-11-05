#!/usr/bin/env node

/**
 * Project Flows MCP Server - Main Entry Point
 *
 * A TypeScript MCP server with Streamable HTTP transport for real-time multi-client communication,
 * PostgreSQL integration for persistent task storage, and dynamic schema system.
 */

import DatabaseService from "./database.js";
import { createExpressApp } from "./server/express-server.js";
import { ConnectionManager } from "./server/connection-manager.js";
import { createMcpServer, registerWorkflow, unregisterWorkflow, listDynamicWorkflows, getWorkflow } from "./mcp/server-factory.js";
import { createNotificationHandler } from "./server/notification-handler.js";
import { functionRegistry } from "./workflow-functions/function-registry.js";

// Initialize shared database service for all connections
const sharedDbService = new DatabaseService();

// Create Express app and connection manager
const app = createExpressApp();
const connectionManager = new ConnectionManager();

// Root endpoint
app.get("/", async (_: any, res: any) => {
  res.status(200).send('Project Flows MCP Server - Streamable HTTP transport with shared database');
});

// Unified MCP endpoint for Streamable HTTP transport (GET, POST, DELETE)
app.all("/mcp", async (req: any, res: any) => {
  await connectionManager.handleStreamableHTTPRequest(req, res, (clientId) =>
    createMcpServer(clientId, sharedDbService)
  );
});

// SSE endpoint for notifications only (separate from MCP)
const notificationHandler = createNotificationHandler();
app.get("/notifications", async (req: any, res: any) => {
  await notificationHandler.handleConnection(req, res);
});

// REST API endpoints for session management
app.get("/api/sessions", async (_: any, res: any) => {
  try {
    const sessions = connectionManager.getActiveSessions();
    res.status(200).json({
      success: true,
      count: sessions.length,
      sessions
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: (error as Error).message
    });
  }
});

app.post("/api/sessions/:sessionId/disconnect", async (req: any, res: any) => {
  try {
    const { sessionId } = req.params;
    const success = await connectionManager.disconnectSession(sessionId);

    if (success) {
      res.status(200).json({
        success: true,
        message: `Session ${sessionId} disconnected successfully`
      });
    } else {
      res.status(404).json({
        success: false,
        error: `Session ${sessionId} not found`
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: (error as Error).message
    });
  }
});

// REST API endpoints for dynamic workflow management
app.post("/api/workflows", async (req: any, res: any) => {
  try {
    const workflow = req.body;
    const result = registerWorkflow(workflow);
    
    if (result.success) {
      res.status(201).json({
        success: true,
        message: `Workflow '${workflow.name}' registered successfully`,
        workflow: workflow.name
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: (error as Error).message
    });
  }
});

app.delete("/api/workflows/:name", async (req: any, res: any) => {
  try {
    const { name } = req.params;
    const result = unregisterWorkflow(name);
    
    if (result.success) {
      res.status(200).json({
        success: true,
        message: `Workflow '${name}' unregistered successfully`
      });
    } else {
      res.status(404).json({
        success: false,
        error: result.error
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: (error as Error).message
    });
  }
});

app.get("/api/workflows", async (req: any, res: any) => {
  try {
    const workflows = listDynamicWorkflows();
    res.status(200).json({
      success: true,
      count: workflows.length,
      workflows: workflows.map(w => ({
        name: w.name,
        description: w.description,
        inputSchema: w.inputSchema,
        stepCount: w.steps.length
      }))
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: (error as Error).message
    });
  }
});

app.get("/api/workflows/:name", async (req: any, res: any) => {
  try {
    const { name } = req.params;
    const workflow = getWorkflow(name);

    if (workflow) {
      res.status(200).json({
        success: true,
        workflow
      });
    } else {
      res.status(404).json({
        success: false,
        error: `Workflow '${name}' not found`
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: (error as Error).message
    });
  }
});

// REST API endpoint for available workflow functions
app.get("/api/functions", async (_: any, res: any) => {
  try {
    const functions = functionRegistry.getDefinitions();
    res.status(200).json({
      success: true,
      count: functions.length,
      functions
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: (error as Error).message
    });
  }
});

async function main() {
  /**
   * Main entry point for the server.
   */
  // Initialize database connection
  try {
    await sharedDbService.initialize();
  } catch (error) {
    console.error('Failed to initialize database:', error);
    process.exit(1);
  }

  // Cleanup database connection and active transports on exit
  process.on('SIGINT', async () => {
    console.log('Shutting down server...');
    await connectionManager.cleanup();
    console.log('Closing database connection...');
    await sharedDbService.close();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.log('Shutting down server...');
    await connectionManager.cleanup();
    console.log('Closing database connection...');
    await sharedDbService.close();
    process.exit(0);
  });
  
  const port = process.env.PORT || 3001;
  app.listen(port, () => {
    console.log(`🚀 Project Flows MCP Server running on port ${port}`);
    console.log('📊 Multiple clients can now connect simultaneously');
    console.log('🗄️ Shared database ensures all clients see the same data');
    console.log('🔄 Streamable HTTP transport with session management and resumability');
    console.log(`🔗 Connect to: http://localhost:${port}/mcp`);
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error("Server error:", error);
    process.exit(1);
  });
}